import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";

type Ctx = { params: Promise<{ boardId: string }> };

// GET /api/boards/:boardId — full board with columns and their tasks.
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { boardId } = await ctx.params;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { projectId: true },
  });
  if (!board) throw new ApiError(404, "Board not found");
  await requireProjectRole(user.id, board.projectId, Role.VIEWER);

  const full = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      name: true,
      projectId: true,
      columns: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          position: true,
          tasks: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              title: true,
              priority: true,
              position: true,
              dueDate: true,
              assignee: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  return Response.json({ board: full });
});
