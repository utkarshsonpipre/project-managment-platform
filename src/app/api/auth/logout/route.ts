import { route } from "@/lib/http";
import { revokeRefreshToken } from "@/lib/auth/tokens";
import { getRefreshTokenCookie, clearAuthCookies } from "@/lib/auth/session";

// POST /api/auth/logout — revoke the refresh token and clear cookies.
export const POST = route(async () => {
  const current = await getRefreshTokenCookie();
  if (current) await revokeRefreshToken(current);
  await clearAuthCookies();
  return Response.json({ ok: true });
});
