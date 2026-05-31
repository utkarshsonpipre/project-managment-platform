import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";
import { createSprintSchema } from "@/lib/validation";
import { publishProjectUpdate } from "@/lib/services/realtime";

type Ctx = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/sprints
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  await requireProjectRole(user.id, projectId, Role.VIEWER);

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      startDate: true,
      endDate: true,
      _count: { select: { tasks: true } },
    },
  });

  return Response.json({
    sprints: sprints.map((s) => ({
      id: s.id,
      name: s.name,
      goal: s.goal,
      status: s.status,
      startDate: s.startDate,
      endDate: s.endDate,
      taskCount: s._count.tasks,
    })),
  });
});

// POST /api/projects/:projectId/sprints — MEMBER or higher.
export const POST = route(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  await requireProjectRole(user.id, projectId, Role.MEMBER);

  const data = await readJson(req, createSprintSchema);

  const sprint = await prisma.sprint.create({
    data: {
      projectId,
      name: data.name,
      goal: data.goal,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
    select: {
      id: true,
      name: true,
      goal: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  });

  await publishProjectUpdate(projectId);

  return Response.json({ sprint: { ...sprint, taskCount: 0 } }, { status: 201 });
});
