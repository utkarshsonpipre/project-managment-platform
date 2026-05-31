"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  Loader2,
  Rocket,
  Users,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIORITY_META } from "@/lib/ui";
import type { Analytics, Priority } from "@/lib/types";

const PRIMARY = "#6366f1";
const BAR_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#64748b",
];

// Theme-aware axis/grid styling (currentColor inherits from the muted parent).
const AXIS_TICK = { fontSize: 12, fill: "currentColor" } as const;
const GRID = { stroke: "currentColor", strokeOpacity: 0.15 } as const;

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { analytics } = await api.get<{ analytics: Analytics }>(
          `/api/projects/${projectId}/analytics`,
        );
        setData(analytics);
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          router.replace("/login");
          return;
        }
        toast.error(err instanceof ApiClientError ? err.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 animate-spin" /> Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-muted/30">
        <TopBar />
        <p className="p-10 text-destructive">Could not load analytics.</p>
      </div>
    );
  }

  const completionRate =
    data.totals.tasks > 0
      ? Math.round((data.totals.completed / data.totals.tasks) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-muted/30">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Project
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Analytics</h1>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<ListChecks className="size-5" />} label="Total tasks" value={data.totals.tasks} />
          <Stat
            icon={<CheckCircle2 className="size-5" />}
            label="Completed"
            value={`${data.totals.completed} (${completionRate}%)`}
          />
          <Stat icon={<Rocket className="size-5" />} label="Sprints" value={data.totals.sprints} />
          <Stat icon={<Users className="size-5" />} label="Members" value={data.totals.members} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Priority pie + theme-safe legend */}
          <ChartCard title="Tasks by priority">
            <ResponsiveContainer width="100%" height={220} className="text-muted-foreground">
              <PieChart>
                <Pie
                  data={data.byPriority}
                  dataKey="count"
                  nameKey="priority"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.byPriority.map((p) => (
                    <Cell key={p.priority} fill={PRIORITY_META[p.priority as Priority].hex} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
              {data.byPriority.map((p) => (
                <span key={p.priority} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: PRIORITY_META[p.priority as Priority].hex }}
                  />
                  {PRIORITY_META[p.priority as Priority].label}
                  <span className="text-muted-foreground">{p.count}</span>
                </span>
              ))}
            </div>
          </ChartCard>

          {/* Status bar */}
          <ChartCard title="Tasks by status">
            <ResponsiveContainer width="100%" height={260} className="text-muted-foreground">
              <BarChart data={data.byColumn}>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} />
                <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.byColumn.map((_, i) => (
                    <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Assignee workload */}
          <ChartCard title="Workload by assignee">
            {data.byAssignee.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height={260} className="text-muted-foreground">
                <BarChart data={data.byAssignee} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid {...GRID} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
                  <YAxis type="category" dataKey="name" width={90} tick={AXIS_TICK} />
                  <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
                  <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Sprint velocity */}
          <ChartCard title="Sprint velocity (tasks per sprint)">
            {data.velocity.length === 0 ? (
              <Empty hint="No sprints yet" />
            ) : (
              <ResponsiveContainer width="100%" height={260} className="text-muted-foreground">
                <BarChart data={data.velocity}>
                  <CartesianGrid {...GRID} vertical={false} />
                  <XAxis dataKey="sprint" tick={AXIS_TICK} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} />
                  <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.06 }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Throughput full width */}
        <ChartCard title="Task throughput (last 14 days)">
          <ResponsiveContainer width="100%" height={280} className="text-muted-foreground">
            <AreaChart data={data.throughput}>
              <defs>
                <linearGradient id="fillCumulative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PRIMARY} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID} vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS_TICK} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} />
              <Tooltip labelFormatter={(l) => shortDate(String(l))} />
              <Area
                type="monotone"
                dataKey="cumulative"
                name="Total tasks"
                stroke={PRIMARY}
                fill="url(#fillCumulative)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </main>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className="brand-gradient flex size-10 items-center justify-center rounded-lg text-white">
          {icon}
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ hint = "No data yet" }: { hint?: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      {hint}
    </div>
  );
}
