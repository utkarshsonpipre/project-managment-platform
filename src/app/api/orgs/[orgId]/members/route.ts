import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireOrgRole } from "@/lib/auth/rbac";
import { addMemberSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ orgId: string }> };

// GET /api/orgs/:orgId/members
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { orgId } = await ctx.params;
  await requireOrgRole(user.id, orgId, Role.VIEWER);

  const memberships = await prisma.membership.findMany({
    where: { orgId },
    orderBy: { user: { name: "asc" } },
    select: {
      role: true,
      user: { select: { id: true, name: true, email: true } },
    },
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

// POST /api/orgs/:orgId/members — add an existing user by email. ADMIN or OWNER.
export const POST = route(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { orgId } = await ctx.params;
  await requireOrgRole(user.id, orgId, Role.ADMIN);

  const { email, role } = await readJson(req, addMemberSchema);

  const invitee = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!invitee) throw new ApiError(404, "No user found with that email");

  const existing = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: invitee.id, orgId } },
    select: { id: true },
  });
  if (existing) throw new ApiError(409, "User is already a member");

  await prisma.membership.create({
    data: { userId: invitee.id, orgId, role: role ?? Role.MEMBER },
  });

  return Response.json(
    { member: { ...invitee, role: role ?? Role.MEMBER } },
    { status: 201 },
  );
});
