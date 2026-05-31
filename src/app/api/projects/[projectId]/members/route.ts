import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";

type Ctx = { params: Promise<{ projectId: string }> };

// GET /api/projects/:projectId/members — members of the project's organization
// (used to populate assignee pickers).
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  const { project } = await requireProjectRole(user.id, projectId, Role.VIEWER);

  const memberships = await prisma.membership.findMany({
    where: { orgId: project.orgId },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return Response.json({
    members: memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
  });
});
