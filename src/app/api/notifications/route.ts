import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";

// GET /api/notifications — current user's notifications + unread count.
export const GET = route(async () => {
  const user = await requireUser();

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        message: true,
        link: true,
        read: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return Response.json({ notifications, unreadCount });
});
