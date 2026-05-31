import { cookies } from "next/headers";
import { ApiError } from "@/lib/http";
import { verifyAccessToken } from "@/lib/auth/tokens";

export const ACCESS_COOKIE = "pmp_access";
export const REFRESH_COOKIE = "pmp_refresh";

const isProd = process.env.NODE_ENV === "production";
const ACCESS_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  const base = { httpOnly: true, sameSite: "lax" as const, secure: isProd, path: "/" };
  jar.set(ACCESS_COOKIE, accessToken, { ...base, maxAge: ACCESS_MAX_AGE });
  jar.set(REFRESH_COOKIE, refreshToken, { ...base, maxAge: REFRESH_MAX_AGE });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getRefreshTokenCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value;
}

/** Returns the authenticated user from the access-token cookie, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const claims = await verifyAccessToken(token);
    return { id: claims.sub, email: claims.email, name: claims.name };
  } catch {
    return null;
  }
}

/** Like getCurrentUser, but throws a 401 when there is no valid session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Authentication required");
  return user;
}
