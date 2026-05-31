import crypto from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { prisma } from "@/lib/db";

// ---- Access tokens (short-lived, stateless JWT) ----

function accessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");
  return new TextEncoder().encode(secret);
}

const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "15m";

export interface AccessClaims extends JWTPayload {
  sub: string;
  email: string;
  name: string;
}

export async function signAccessToken(user: {
  id: string;
  email: string;
  name: string;
}): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessSecret());
  return payload as AccessClaims;
}

// ---- Refresh tokens (opaque, stored hashed for revocation) ----

const REFRESH_TTL_DAYS = 7;

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Create a new opaque refresh token and persist its hash for the user. */
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  return token;
}

/**
 * Validate an incoming refresh token and rotate it: the old token is revoked
 * and a fresh one is issued. Returns the user id + new token, or null if the
 * token is unknown / expired / already revoked.
 */
export async function rotateRefreshToken(
  token: string,
): Promise<{ userId: string; newToken: string } | null> {
  const tokenHash = hashToken(token);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const newToken = await issueRefreshToken(existing.userId);
  return { userId: existing.userId, newToken };
}

/** Revoke a refresh token (used on logout). Safe to call with an unknown token. */
export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
