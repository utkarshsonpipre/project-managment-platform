import { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { publishUserNotification } from "@/lib/services/realtime";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  message: string;
  link?: string | null;
}

/**
 * Creates a notification for a user. Best-effort: failures are logged but never
 * break the originating request.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        message: input.message,
        link: input.link ?? null,
      },
    });
    await publishUserNotification(input.userId);
  } catch (err) {
    console.error("[notify] failed to create notification:", err);
  }
}
