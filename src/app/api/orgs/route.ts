import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { createOrgSchema } from "@/lib/validation";
import { slugify } from "@/lib/slug";

// GET /api/orgs — organizations the current user belongs to.
export const GET = route(async () => {
  const user = await requireUser();
  const orgs = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      memberships: { where: { userId: user.id }, select: { role: true } },
      _count: { select: { projects: true } },
    },
  });

  return Response.json({
    organizations: orgs.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      createdAt: o.createdAt,
      role: o.memberships[0]?.role ?? null,
      projectCount: o._count.projects,
    })),
  });
});

// POST /api/orgs — create an organization (creator becomes OWNER).
export const POST = route(async (req) => {
  const user = await requireUser();
  const { name } = await readJson(req, createOrgSchema);
  const slug = `${slugify(name)}-${crypto.randomBytes(3).toString("hex")}`;

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      memberships: { create: { userId: user.id, role: Role.OWNER } },
    },
    select: { id: true, name: true, slug: true, createdAt: true },
  });

  return Response.json({ organization: { ...org, role: Role.OWNER, projectCount: 0 } }, { status: 201 });
});
