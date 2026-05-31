import { ActivityVerb, Priority, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";
import { createTaskSchema } from "@/lib/validation";
import { recordActivity } from "@/lib/services/activity";
import { publishProjectUpdate } from "@/lib/services/realtime";

type Ctx = { params: Promise<{ projectId: string }> };

// POST /api/projects/:projectId/tasks — MEMBER or higher.
export const POST = route(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  await requireProjectRole(user.id, projectId, Role.MEMBER);

  const data = await readJson(req, createTaskSchema);

  // A column, if supplied, must belong to this project.
  if (data.columnId) {
    const column = await prisma.column.findUnique({
      where: { id: data.columnId },
      select: { board: { select: { projectId: true } } },
    });
    if (!column || column.board.projectId !== projectId) {
      throw new ApiError(400, "Column does not belong to this project");
    }
  }

  const position = data.columnId
    ? await prisma.task.count({ where: { columnId: data.columnId } })
    : 0;

  const task = await prisma.task.create({
    data: {
      projectId,
      title: data.title,
      description: data.description,
      priority: data.priority ?? Priority.MEDIUM,
      columnId: data.columnId,
      assigneeId: data.assigneeId,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      position,
      creatorId: user.id,
    },
    select: {
      id: true,
      title: true,
      priority: true,
      position: true,
      columnId: true,
      dueDate: true,
      assignee: { select: { id: true, name: true } },
    },
  });

  await recordActivity({
    projectId,
    actorId: user.id,
    verb: ActivityVerb.CREATED,
    entity: "task",
    entityId: task.id,
    summary: `${user.name} created "${task.title}"`,
  });
  await publishProjectUpdate(projectId);

  return Response.json({ task }, { status: 201 });
});
