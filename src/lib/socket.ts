"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

/** Returns a shared Socket.IO client connected to the realtime server. */
export function getSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001";
    socket = io(url, {
      withCredentials: true, // send the httpOnly access-token cookie for auth
      transports: ["websocket"],
    });
  }
  return socket;
}
