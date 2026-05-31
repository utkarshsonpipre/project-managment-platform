import { ActivityVerb, NotificationType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";
import { updateTaskSchema } from "@/lib/validation";
import { recordActivity } from "@/lib/services/activity";
import { notify } from "@/lib/services/notifications";
import { publishProjectUpdate } from "@/lib/services/realtime";

type Ctx = { params: Promise<{ taskId: string }> };

async function loadTaskProject(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, title: true, assigneeId: true },
  });
  if (!task) throw new ApiError(404, "Task not found");
  return task;
}

// GET /api/tasks/:taskId — full task detail.
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { taskId } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      title: true,
      description: true,
      priority: true,
      position: true,
      columnId: true,
      dueDate: true,
      assignee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
  if (!task) throw new ApiError(404, "Task not found");
  await requireProjectRole(user.id, task.projectId, Role.VIEWER);
  return Response.json({ task });
});

// PATCH /api/tasks/:taskId — update fields and/or move between columns.
export const PATCH = route(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { taskId } = await ctx.params;
  const task = await loadTaskProject(taskId);
  await requireProjectRole(user.id, task.projectId, Role.MEMBER);

  const data = await readJson(req, updateTaskSchema);

  // If moving to a column, validate it belongs to the same project.
  if (data.columnId) {
    const column = await prisma.column.findUnique({
      where: { id: data.columnId },
      select: { board: { select: { projectId: true } } },
    });
    if (!column || column.board.projectId !== task.projectId) {
      throw new ApiError(400, "Column does not belong to this project");
    }
  }

  const updateData: Prisma.TaskUpdateInput = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.columnId !== undefined) {
    updateData.column = data.columnId
      ? { connect: { id: data.columnId } }
      : { disconnect: true };
  }
  if (data.assigneeId !== undefined) {
    updateData.assignee = data.assigneeId
      ? { connect: { id: data.assigneeId } }
      : { disconnect: true };
  }
  if (data.sprintId !== undefined) {
    if (data.sprintId) {
      const sprint = await prisma.sprint.findUnique({
        where: { id: data.sprintId },
        select: { projectId: true },
      });
      if (!sprint || sprint.projectId !== task.projectId) {
        throw new ApiError(400, "Sprint does not belong to this project");
      }
      updateData.sprint = { connect: { id: data.sprintId } };
    } else {
      updateData.sprint = { disconnect: true };
    }
  }
  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      position: true,
      columnId: true,
      dueDate: true,
      assignee: { select: { id: true, name: true } },
    },
  });

  // Record + notify when the assignee changes to a new person.
  if (
    data.assigneeId !== undefined &&
    updated.assignee &&
    updated.assignee.id !== task.assigneeId
  ) {
    await recordActivity({
      projectId: task.projectId,
      actorId: user.id,
      verb: ActivityVerb.ASSIGNED,
      entity: "task",
      entityId: task.id,
      summary: `${user.name} assigned "${updated.title}" to ${updated.assignee.name}`,
    });
    if (updated.assignee.id !== user.id) {
      await notify({
        userId: updated.assignee.id,
        type: NotificationType.TASK_ASSIGNED,
        message: `${user.name} assigned you "${updated.title}"`,
        link: `/projects/${task.projectId}`,
      });
    }
  }

  await publishProjectUpdate(task.projectId);

  return Response.json({ task: updated });
});

// DELETE /api/tasks/:taskId
export const DELETE = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { taskId } = await ctx.params;
  const task = await loadTaskProject(taskId);
  await requireProjectRole(user.id, task.projectId, Role.MEMBER);

  await prisma.task.delete({ where: { id: taskId } });

  await recordActivity({
    projectId: task.projectId,
    actorId: user.id,
    verb: ActivityVerb.DELETED,
    entity: "task",
    entityId: task.id,
    summary: `${user.name} deleted "${task.title}"`,
  });
  await publishProjectUpdate(task.projectId);

  return Response.json({ ok: true });
});
