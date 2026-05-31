import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";

// POST /api/notifications/read — mark all of the user's notifications as read.
export const POST = route(async () => {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  return Response.json({ ok: true });
});
