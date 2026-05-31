import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";

type Ctx = { params: Promise<{ boardId: string }> };

const reorderSchema = z.object({
  columns: z.array(
    z.object({
      columnId: z.string(),
      taskIds: z.array(z.string()),
    }),
  ),
});

// PATCH /api/boards/:boardId/reorder
// Persists the full ordering after a drag: each task gets its new columnId + position.
export const PATCH = route(async (req, ctx: Ctx) => {
  const user = await requireUser();
  const { boardId } = await ctx.params;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      projectId: true,
      columns: { select: { id: true } },
    },
  });
  if (!board) throw new ApiError(404, "Board not found");
  await requireProjectRole(user.id, board.projectId, Role.MEMBER);

  const { columns } = await readJson(req, reorderSchema);

  // Every targeted column must belong to this board.
  const validColumnIds = new Set(board.columns.map((c) => c.id));
  for (const col of columns) {
    if (!validColumnIds.has(col.columnId)) {
      throw new ApiError(400, "Column does not belong to this board");
    }
  }

  // All referenced tasks must belong to this board's project.
  const allTaskIds = columns.flatMap((c) => c.taskIds);
  if (allTaskIds.length > 0) {
    const owned = await prisma.task.count({
      where: { id: { in: allTaskIds }, projectId: board.projectId },
    });
    if (owned !== allTaskIds.length) {
      throw new ApiError(400, "One or more tasks do not belong to this board");
    }
  }

  // Apply all position/column updates atomically.
  await prisma.$transaction(
    columns.flatMap((col) =>
      col.taskIds.map((taskId, index) =>
        prisma.task.update({
          where: { id: taskId },
          data: { columnId: col.columnId, position: index },
        }),
      ),
    ),
  );

  return Response.json({ ok: true });
});
