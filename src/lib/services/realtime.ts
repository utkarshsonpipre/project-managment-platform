import { getRedisPublisher, REALTIME_CHANNEL } from "@/lib/redis";

// Publishes a {room, event} message to Redis. The standalone Socket.IO server
// (server/realtime.ts) subscribes and relays it to connected clients in `room`.
// Best-effort: a Redis hiccup must never break the originating request.
async function publish(room: string, event: string): Promise<void> {
  try {
    await getRedisPublisher().publish(
      REALTIME_CHANNEL,
      JSON.stringify({ room, event }),
    );
  } catch (err) {
    console.error("[realtime] publish failed:", err);
  }
}

/** Tell everyone viewing a project that its boards/tasks/sprints changed. */
export function publishProjectUpdate(projectId: string): Promise<void> {
  return publish(`project:${projectId}`, "project:updated");
}

/** Tell a specific user they have a new notification. */
export function publishUserNotification(userId: string): Promise<void> {
  return publish(`user:${userId}`, "notification");
}
