import { ActivityVerb, NotificationType, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";
import { createCommentSchema } from "@/lib/validation";
import { recordActivity } from "@/lib/services/activity";
import { notify } from "@/lib/services/notifications";
import { publishProjectUpdate } from "@/lib/services/realtime";

type Ctx = { params: Promise<{ taskId: string }> };

async function loadTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, title: true, assigneeId: true },
  });
  if (!task) throw new ApiError(404, "Task not found");
  return task;
}

// GET /api/tasks/:taskId/comments
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { taskId } = await ctx.params;
  const task = await loadTask(taskId);
  await requireProjectRole(user.id, task.projectId, Role.VIEWER);

  const comments = await prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });

  return Response.json({ comments });
});

// POST /api/tasks/:taskId/comments — MEMBER or higher.
export const POST = route(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { taskId } = await ctx.params;
  const task = await loadTask(taskId);
  await requireProjectRole(user.id, task.projectId, Role.MEMBER);

  const { body } = await readJson(req, createCommentSchema);

  const comment = await prisma.comment.create({
    data: { taskId, authorId: user.id, body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });

  await recordActivity({
    projectId: task.projectId,
    actorId: user.id,
    verb: ActivityVerb.COMMENTED,
    entity: "task",
    entityId: task.id,
    summary: `${user.name} commented on "${task.title}"`,
  });

  // Notify the assignee (unless they wrote the comment themselves).
  if (task.assigneeId && task.assigneeId !== user.id) {
    await notify({
      userId: task.assigneeId,
      type: NotificationType.TASK_COMMENTED,
      message: `${user.name} commented on "${task.title}"`,
      link: `/projects/${task.projectId}`,
    });
  }

  await publishProjectUpdate(task.projectId);

  return Response.json({ comment }, { status: 201 });
});
