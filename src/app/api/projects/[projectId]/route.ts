import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";

type Ctx = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId — project detail with its boards.
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  await requireProjectRole(user.id, projectId, Role.VIEWER);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      orgId: true,
      createdAt: true,
      boards: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          position: true,
          _count: { select: { columns: true } },
        },
      },
    },
  });

  return Response.json({ project });
});
