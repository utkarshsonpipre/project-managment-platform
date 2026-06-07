import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import Redis from "ioredis";
import { jwtVerify } from "jose";

// Standalone realtime server. Verifies the JWT from the same httpOnly cookie the
// app uses, lets clients join project/user rooms, and relays events published to
// Redis (by the Next.js API) out to those rooms.

// Render (and most PaaS) inject PORT; fall back to REALTIME_PORT locally.
const PORT = Number(process.env.PORT ?? process.env.REALTIME_PORT ?? 4001);
const REALTIME_CHANNEL = "pmp:realtime";
const ACCESS_COOKIE = "pmp_access";

function accessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");
  return new TextEncoder().encode(secret);
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("realtime ok");
});

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

// Authenticate every socket via the access-token cookie (or an explicit auth token).
io.use(async (socket, next) => {
  try {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token =
      (socket.handshake.auth as { token?: string }).token ?? cookies[ACCESS_COOKIE];
    if (!token) return next(new Error("unauthorized"));
    const { payload } = await jwtVerify(token, accessSecret());
    socket.data.userId = payload.sub as string;
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string | undefined;
  if (userId) socket.join(`user:${userId}`);

  socket.on("join:project", (projectId: unknown) => {
    if (typeof projectId === "string") socket.join(`project:${projectId}`);
  });
  socket.on("leave:project", (projectId: unknown) => {
    if (typeof projectId === "string") socket.leave(`project:${projectId}`);
  });
});

// Subscribe to Redis and relay published events into Socket.IO rooms.
const subscriber = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
subscriber.subscribe(REALTIME_CHANNEL, (err) => {
  if (err) console.error("[realtime] subscribe error:", err.message);
  else console.log(`[realtime] subscribed to ${REALTIME_CHANNEL}`);
});
subscriber.on("message", (_channel: string, message: string) => {
  try {
    const { room, event } = JSON.parse(message) as { room?: string; event?: string };
    if (room && event) io.to(room).emit(event);
  } catch (err) {
    console.error("[realtime] bad message:", err);
  }
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] Socket.IO listening on :${PORT}`);
});
