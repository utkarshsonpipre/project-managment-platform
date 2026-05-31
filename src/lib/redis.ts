import Redis from "ioredis";

/** Redis channel used to fan realtime events out to the Socket.IO server. */
export const REALTIME_CHANNEL = "pmp:realtime";

const globalForRedis = globalThis as unknown as { redisClient?: Redis };

/**
 * Lazily-created shared Redis client (reused across hot reloads). Used for both
 * pub/sub publishing and key/value caching — safe because this connection is
 * never put into subscriber mode.
 */
export function getRedis(): Redis {
  if (!globalForRedis.redisClient) {
    const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    client.on("error", (err) => console.error("[redis] error:", err.message));
    globalForRedis.redisClient = client;
  }
  return globalForRedis.redisClient;
}

/** Alias kept for the realtime publisher call sites. */
export const getRedisPublisher = getRedis;

/** Read + parse a cached JSON value. Returns null on miss or any error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedis().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Cache a JSON value with a TTL (seconds). Best-effort. */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // ignore cache write failures
  }
}

/** Delete cached keys. Best-effort. */
export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    if (keys.length) await getRedis().del(...keys);
  } catch {
    // ignore
  }
}
