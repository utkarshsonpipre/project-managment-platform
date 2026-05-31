import crypto from "node:crypto";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/http";
import { registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken, issueRefreshToken } from "@/lib/auth/tokens";
import { setAuthCookies } from "@/lib/auth/session";
import { slugify } from "@/lib/slug";

// POST /api/auth/register — create a user, bootstrap their workspace, log them in.
export const POST = route(async (req) => {
  const { name, email, password } = await readJson(req, registerSchema);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "Email is already registered");

  const passwordHash = await hashPassword(password);
  const slug = `${slugify(name)}-${crypto.randomBytes(3).toString("hex")}`;

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      memberships: {
        create: {
          role: Role.OWNER,
          org: { create: { name: `${name}'s Workspace`, slug } },
        },
      },
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  const accessToken = await signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  await setAuthCookies(accessToken, refreshToken);

  return Response.json({ user }, { status: 201 });
});
