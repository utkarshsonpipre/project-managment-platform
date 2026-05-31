import { ActivityVerb, Prisma, Role, SprintStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";
import { updateSprintSchema } from "@/lib/validation";
import { recordActivity } from "@/lib/services/activity";
import { publishProjectUpdate } from "@/lib/services/realtime";

type Ctx = { params: Promise<{ sprintId: string }> };

async function loadSprint(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, projectId: true, name: true, startDate: true, endDate: true },
  });
  if (!sprint) throw new ApiError(404, "Sprint not found");
  return sprint;
}

// GET /api/sprints/:sprintId — sprint with its tasks.
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { sprintId } = await ctx.params;
  const sprint = await loadSprint(sprintId);
  await requireProjectRole(user.id, sprint.projectId, Role.VIEWER);

  const full = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      startDate: true,
      endDate: true,
      tasks: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          priority: true,
          assignee: { select: { id: true, name: true } },
        },
      },
    },
  });

  return Response.json({ sprint: full });
});

// PATCH /api/sprints/:sprintId — update fields / status (start, complete).
export const PATCH = route(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { sprintId } = await ctx.params;
  const sprint = await loadSprint(sprintId);
  await requireProjectRole(user.id, sprint.projectId, Role.MEMBER);

  const data = await readJson(req, updateSprintSchema);
  const updateData: Prisma.SprintUpdateInput = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.goal !== undefined) updateData.goal = data.goal;
  if (data.startDate !== undefined) {
    updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  }
  if (data.endDate !== undefined) {
    updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
    // Convenience: stamp dates on transitions when not explicitly provided.
    if (
      data.status === SprintStatus.ACTIVE &&
      data.startDate === undefined &&
      !sprint.startDate
    ) {
      updateData.startDate = new Date();
    }
    if (
      data.status === SprintStatus.COMPLETED &&
      data.endDate === undefined &&
      !sprint.endDate
    ) {
      updateData.endDate = new Date();
    }
  }

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data: updateData,
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  });

  if (data.status === SprintStatus.ACTIVE || data.status === SprintStatus.COMPLETED) {
    const started = data.status === SprintStatus.ACTIVE;
    await recordActivity({
      projectId: sprint.projectId,
      actorId: user.id,
      verb: started ? ActivityVerb.SPRINT_STARTED : ActivityVerb.SPRINT_COMPLETED,
      entity: "sprint",
      entityId: sprint.id,
      summary: `${user.name} ${started ? "started" : "completed"} sprint "${updated.name}"`,
    });
  }

  await publishProjectUpdate(sprint.projectId);

  return Response.json({ sprint: updated });
});

// DELETE /api/sprints/:sprintId — tasks are detached (sprintId set null), not deleted.
export const DELETE = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { sprintId } = await ctx.params;
  const sprint = await loadSprint(sprintId);
  await requireProjectRole(user.id, sprint.projectId, Role.MEMBER);

  await prisma.sprint.delete({ where: { id: sprintId } });
  await publishProjectUpdate(sprint.projectId);
  return Response.json({ ok: true });
});
