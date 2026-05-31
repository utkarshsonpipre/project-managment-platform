import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { getMembership, hasAtLeast } from "@/lib/auth/rbac";

type Ctx = { params: Promise<{ commentId: string }> };

// DELETE /api/comments/:commentId — author, or an org ADMIN/OWNER.
export const DELETE = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { commentId } = await ctx.params;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      authorId: true,
      task: { select: { project: { select: { orgId: true } } } },
    },
  });
  if (!comment) throw new ApiError(404, "Comment not found");

  const membership = await getMembership(user.id, comment.task.project.orgId);
  if (!membership) throw new ApiError(404, "Comment not found");

  const isAuthor = comment.authorId === user.id;
  const isModerator = hasAtLeast(membership.role, Role.ADMIN);
  if (!isAuthor && !isModerator) {
    throw new ApiError(403, "You can only delete your own comments");
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return Response.json({ ok: true });
});
