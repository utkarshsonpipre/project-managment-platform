import { Queue, type ConnectionOptions } from "bullmq";

export const EMAIL_QUEUE = "emails";

export interface EmailJob {
  userId: string;
  subject: string;
  body: string;
}

// Build BullMQ connection options from REDIS_URL. Using a plain options object
// (rather than an ioredis instance) avoids type clashes with the ioredis copy
// bundled inside bullmq.
export function redisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

const globalForQueue = globalThis as unknown as { emailQueue?: Queue<EmailJob> };

function emailQueue(): Queue<EmailJob> {
  if (!globalForQueue.emailQueue) {
    globalForQueue.emailQueue = new Queue<EmailJob>(EMAIL_QUEUE, {
      connection: redisConnection(),
    });
  }
  return globalForQueue.emailQueue;
}

/** Enqueue a notification email for the worker to deliver. Best-effort. */
export async function enqueueEmail(job: EmailJob): Promise<void> {
  try {
    await emailQueue().add("send", job, {
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  } catch (err) {
    console.error("[queue] failed to enqueue email:", err);
  }
}
