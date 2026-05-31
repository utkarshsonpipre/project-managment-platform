import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";
import { createBoardSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ projectId: string }> };

const DEFAULT_COLUMNS = [
  { name: "To Do", position: 0 },
  { name: "In Progress", position: 1 },
  { name: "Done", position: 2 },
];

// GET /api/projects/:projectId/boards
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  await requireProjectRole(user.id, projectId, Role.VIEWER);

  const boards = await prisma.board.findMany({
    where: { projectId },
    orderBy: { position: "asc" },
    select: { id: true, name: true, position: true },
  });
  return Response.json({ boards });
});

// POST /api/projects/:projectId/boards — creates a board with default columns.
export const POST = route(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  await requireProjectRole(user.id, projectId, Role.MEMBER);

  const { name } = await readJson(req, createBoardSchema);
  const position = await prisma.board.count({ where: { projectId } });

  const board = await prisma.board.create({
    data: {
      projectId,
      name,
      position,
      columns: { create: DEFAULT_COLUMNS },
    },
    select: { id: true, name: true, position: true },
  });

  return Response.json({ board }, { status: 201 });
});
