import { Priority, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { requireProjectRole } from "@/lib/auth/rbac";
import { cacheGet, cacheSet } from "@/lib/redis";

type Ctx = { params: Promise<{ projectId: string }> };

const CACHE_TTL_SECONDS = 30;
const PRIORITIES: Priority[] = [
  Priority.LOW,
  Priority.MEDIUM,
  Priority.HIGH,
  Priority.URGENT,
];

interface Analytics {
  totals: { tasks: number; completed: number; sprints: number; members: number };
  byPriority: { priority: Priority; count: number }[];
  byColumn: { name: string; count: number }[];
  byAssignee: { name: string; count: number }[];
  velocity: { sprint: string; count: number; status: string }[];
  throughput: { date: string; created: number; cumulative: number }[];
  cached: boolean;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// GET /api/projects/:projectId/analytics — aggregated project metrics (cached).
export const GET = route(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { projectId } = await ctx.params;
  const { project } = await requireProjectRole(user.id, projectId, Role.VIEWER);

  const cacheKey = `analytics:${projectId}`;
  const cached = await cacheGet<Analytics>(cacheKey);
  if (cached) return Response.json({ analytics: { ...cached, cached: true } });

  const [tasks, sprints, members] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      select: {
        priority: true,
        createdAt: true,
        assignee: { select: { name: true } },
        column: { select: { name: true } },
      },
    }),
    prisma.sprint.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      select: { name: true, status: true, _count: { select: { tasks: true } } },
    }),
    prisma.membership.count({ where: { orgId: project.orgId } }),
  ]);

  // Priority distribution (always include all four buckets).
  const priorityCounts = new Map<Priority, number>(PRIORITIES.map((p) => [p, 0]));
  // Column / status distribution.
  const columnCounts = new Map<string, number>();
  // Assignee workload.
  const assigneeCounts = new Map<string, number>();
  let completed = 0;

  for (const t of tasks) {
    priorityCounts.set(t.priority, (priorityCounts.get(t.priority) ?? 0) + 1);

    const colName = t.column?.name ?? "Backlog";
    columnCounts.set(colName, (columnCounts.get(colName) ?? 0) + 1);
    if (/done|complete/i.test(colName)) completed += 1;

    const who = t.assignee?.name ?? "Unassigned";
    assigneeCounts.set(who, (assigneeCounts.get(who) ?? 0) + 1);
  }

  // Throughput over the last 14 days.
  const WINDOW = 14;
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (WINDOW - 1));
  start.setUTCHours(0, 0, 0, 0);

  const perDay = new Map<string, number>();
  for (let i = 0; i < WINDOW; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    perDay.set(dayKey(d), 0);
  }
  let baseline = 0; // tasks created before the window
  for (const t of tasks) {
    const created = new Date(t.createdAt);
    if (created < start) {
      baseline += 1;
      continue;
    }
    const key = dayKey(created);
    if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  let running = baseline;
  const throughput = Array.from(perDay.entries()).map(([date, created]) => {
    running += created;
    return { date, created, cumulative: running };
  });

  const analytics: Analytics = {
    totals: {
      tasks: tasks.length,
      completed,
      sprints: sprints.length,
      members,
    },
    byPriority: PRIORITIES.map((p) => ({ priority: p, count: priorityCounts.get(p) ?? 0 })),
    byColumn: Array.from(columnCounts.entries()).map(([name, count]) => ({ name, count })),
    byAssignee: Array.from(assigneeCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    velocity: sprints.map((s) => ({
      sprint: s.name,
      count: s._count.tasks,
      status: s.status,
    })),
    throughput,
    cached: false,
  };

  await cacheSet(cacheKey, analytics, CACHE_TTL_SECONDS);
  return Response.json({ analytics });
});
