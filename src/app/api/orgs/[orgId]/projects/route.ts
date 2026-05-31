import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireOrgRole } from "@/lib/auth/rbac";
import { createProjectSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ orgId: string }> };

// GET /api/orgs/:orgId/projects
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { orgId } = await ctx.params;
  await requireOrgRole(user.id, orgId, Role.VIEWER);

  const projects = await prisma.project.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      createdAt: true,
      _count: { select: { boards: true, tasks: true } },
    },
  });

  return Response.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      description: p.description,
      createdAt: p.createdAt,
      boardCount: p._count.boards,
      taskCount: p._count.tasks,
    })),
  });
});

// POST /api/orgs/:orgId/projects — MEMBER or higher.
export const POST = route(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { orgId } = await ctx.params;
  await requireOrgRole(user.id, orgId, Role.MEMBER);

  const { name, key, description } = await readJson(req, createProjectSchema);

  const clash = await prisma.project.findUnique({
    where: { orgId_key: { orgId, key } },
    select: { id: true },
  });
  if (clash) throw new ApiError(409, `Project key "${key}" already exists in this organization`);

  const project = await prisma.project.create({
    data: { orgId, name, key, description },
    select: { id: true, name: true, key: true, description: true, createdAt: true },
  });

  return Response.json({ project }, { status: 201 });
});
