import { prisma } from "@/lib/db";
import { ApiError, route } from "@/lib/http";
import { signAccessToken, rotateRefreshToken } from "@/lib/auth/tokens";
import {
  getRefreshTokenCookie,
  setAuthCookies,
  clearAuthCookies,
} from "@/lib/auth/session";

// POST /api/auth/refresh — rotate the refresh token and mint a new access token.
export const POST = route(async () => {
  const current = await getRefreshTokenCookie();
  if (!current) throw new ApiError(401, "No refresh token");

  const rotated = await rotateRefreshToken(current);
  if (!rotated) {
    await clearAuthCookies();
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: rotated.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    await clearAuthCookies();
    throw new ApiError(401, "User no longer exists");
  }

  const accessToken = await signAccessToken(user);
  await setAuthCookies(accessToken, rotated.newToken);

  return Response.json({ user });
});
