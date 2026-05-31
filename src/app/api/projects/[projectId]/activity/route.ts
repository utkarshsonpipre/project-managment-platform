import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";

type Ctx = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/activity — most recent project activity.
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  await requireProjectRole(user.id, projectId, Role.VIEWER);

  const activity = await prisma.activityLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      verb: true,
      entity: true,
      summary: true,
      createdAt: true,
      actor: { select: { id: true, name: true } },
    },
  });

  return Response.json({ activity });
});
