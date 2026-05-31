import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";

type Ctx = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/planning
// Everything the sprint-planning board needs in one call: the backlog plus
// each sprint with its tasks.
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  await requireProjectRole(user.id, projectId, Role.VIEWER);

  const taskSelect = {
    id: true,
    title: true,
    priority: true,
    assignee: { select: { id: true, name: true } },
  } as const;

  const [backlog, sprints] = await Promise.all([
    prisma.task.findMany({
      where: { projectId, sprintId: null },
      orderBy: { createdAt: "asc" },
      select: taskSelect,
    }),
    prisma.sprint.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        goal: true,
        status: true,
        startDate: true,
        endDate: true,
        tasks: { orderBy: { position: "asc" }, select: taskSelect },
      },
    }),
  ]);

  return Response.json({ backlog, sprints });
});
