import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { getCurrentUser } from "@/lib/auth/session";

// GET /api/auth/me — current user + their org memberships (null if logged out).
export const GET = route(async () => {
  const session = await getCurrentUser();
  if (!session) return Response.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      memberships: {
        select: {
          role: true,
          org: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return Response.json({ user });
});
