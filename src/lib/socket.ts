"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let pending: Promise<Socket> | null = null;

const DEFAULT_URL = "http://localhost:4001";

/**
 * Connects (once) to the realtime server. Fetches the realtime URL + a fresh
 * handshake token from /api/realtime-info, so it works whether the realtime
 * server is same-origin (dev) or a separate host (production / Render).
 */
export async function connectSocket(): Promise<Socket> {
  if (socket) return socket;
  if (pending) return pending;

  pending = (async () => {
    let url = DEFAULT_URL;
    let token: string | undefined;
    try {
      const res = await fetch("/api/realtime-info", { credentials: "same-origin" });
      if (res.ok) {
        const info = (await res.json()) as { url?: string; token?: string | null };
        if (info.url) url = info.url;
        if (info.token) token = info.token;
      }
    } catch {
      // fall back to defaults
    }
    socket = io(url, {
      transports: ["websocket"],
      auth: token ? { token } : undefined,
    });
    return socket;
  })();

  return pending;
}

/** Returns the socket only if it has already been created. */
export function getSocketIfReady(): Socket | null {
  return socket;
}
