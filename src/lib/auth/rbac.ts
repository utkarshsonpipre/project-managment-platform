import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";

/**
 * Role hierarchy. Higher rank implies all permissions of lower ranks.
 * OWNER > ADMIN > MEMBER > VIEWER
 */
export const ROLE_RANK: Record<Role, number> = {
  [Role.VIEWER]: 1,
  [Role.MEMBER]: 2,
  [Role.ADMIN]: 3,
  [Role.OWNER]: 4,
};

export function hasAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Returns the user's membership in an org, or null if they're not a member. */
export async function getMembership(userId: string, orgId: string) {
  return prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
}

/**
 * Asserts that the user is a member of the org with at least `minimum` role.
 * Returns the membership on success; throws 403 (or 404 if not a member) otherwise.
 */
export async function requireOrgRole(
  userId: string,
  orgId: string,
  minimum: Role = Role.VIEWER,
) {
  const membership = await getMembership(userId, orgId);
  if (!membership) {
    // Hide existence of orgs the user has no access to.
    throw new ApiError(404, "Organization not found");
  }
  if (!hasAtLeast(membership.role, minimum)) {
    throw new ApiError(403, `Requires ${minimum} role or higher`);
  }
  return membership;
}

/**
 * Resolves the org that owns a project, then asserts the user's role within it.
 * Returns { project, membership }.
 */
export async function requireProjectRole(
  userId: string,
  projectId: string,
  minimum: Role = Role.VIEWER,
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ApiError(404, "Project not found");
  const membership = await requireOrgRole(userId, project.orgId, minimum);
  return { project, membership };
}
