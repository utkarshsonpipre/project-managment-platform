import { route } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";
import { signAccessToken } from "@/lib/auth/tokens";

// GET /api/realtime-info — tells the browser where the realtime server is and
// gives it a fresh access token to authenticate the socket handshake.
//
// We use a handshake token (not the cookie) because in production the realtime
// server runs on a different host/subdomain, where the httpOnly cookie is not
// sent. The server (server/realtime.ts) already accepts `auth.token`.
function realtimeUrl(): string {
  if (process.env.REALTIME_PUBLIC_URL) return process.env.REALTIME_PUBLIC_URL;
  if (process.env.REALTIME_PUBLIC_HOST) {
    return `https://${process.env.REALTIME_PUBLIC_HOST}`;
  }
  return ""; // empty → client falls back to its local default
}

export const GET = route(async () => {
  const user = await getCurrentUser();
  const url = realtimeUrl();
  if (!user) return Response.json({ url, token: null });

  const token = await signAccessToken(user);
  return Response.json({ url, token });
});
