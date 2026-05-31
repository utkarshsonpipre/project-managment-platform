import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";

type Ctx = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/backlog — tasks not assigned to any sprint.
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  await requireProjectRole(user.id, projectId, Role.VIEWER);

  const tasks = await prisma.task.findMany({
    where: { projectId, sprintId: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      priority: true,
      assignee: { select: { id: true, name: true } },
    },
  });

  return Response.json({ tasks });
});
