import { prisma } from "@/lib/db";
import { ApiError, readJson, route } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, issueRefreshToken } from "@/lib/auth/tokens";
import { setAuthCookies } from "@/lib/auth/session";

// POST /api/auth/login
export const POST = route(async (req) => {
  const { email, password } = await readJson(req, loginSchema);

  const user = await prisma.user.findUnique({ where: { email } });
  // Constant-ish response: same error whether the email or password is wrong.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new ApiError(401, "Invalid email or password");
  }

  const accessToken = await signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  await setAuthCookies(accessToken, refreshToken);

  return Response.json({
    user: { id: user.id, name: user.name, email: user.email },
  });
});
