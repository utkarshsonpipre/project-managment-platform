import "dotenv/config";
import { Worker, type ConnectionOptions } from "bullmq";

// Background worker: consumes the email queue and "delivers" notification emails.
// Swap the body of the processor for a real provider (SES / Nodemailer) in prod.

const EMAIL_QUEUE = "emails";

interface EmailJob {
  userId: string;
  subject: string;
  body: string;
}

function redisConnection(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

const worker = new Worker<EmailJob>(
  EMAIL_QUEUE,
  async (job) => {
    const { userId, subject, body } = job.data;
    console.log(`[worker] sending email -> user ${userId}: "${subject}" — ${body}`);
    return { delivered: true };
  },
  { connection: redisConnection(), concurrency: 5 },
);

worker.on("completed", (job) => console.log(`[worker] job ${job.id} completed`));
worker.on("failed", (job, err) =>
  console.error(`[worker] job ${job?.id} failed:`, err.message),
);

console.log(`[worker] listening on queue "${EMAIL_QUEUE}"`);
