import Redis from "ioredis";

/** Redis channel used to fan realtime events out to the Socket.IO server. */
export const REALTIME_CHANNEL = "pmp:realtime";

const globalForRedis = globalThis as unknown as { redisPublisher?: Redis };

/** Lazily-created shared Redis publisher (reused across hot reloads). */
export function getRedisPublisher(): Redis {
  if (!globalForRedis.redisPublisher) {
    const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    client.on("error", (err) =>
      console.error("[redis] publisher error:", err.message),
    );
    globalForRedis.redisPublisher = client;
  }
  return globalForRedis.redisPublisher;
}
