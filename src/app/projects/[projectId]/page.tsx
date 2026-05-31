"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  ArrowLeft,
  ChartColumn,
  KanbanSquare,
  Loader2,
  Plus,
  Rocket,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { accentFor, timeAgo } from "@/lib/ui";
import type { Activity as ActivityItem } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ProjectDetail } from "@/lib/types";

export default function ProjectPage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { project } = await api.get<{ project: ProjectDetail }>(
        `/api/projects/${projectId}`,
      );
      setProject(project);
      const { activity } = await api
        .get<{ activity: ActivityItem[] }>(`/api/projects/${projectId}/activity`)
        .catch(() => ({ activity: [] as ActivityItem[] }));
      setActivity(activity);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.replace("/login");
        return;
      }
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 animate-spin" /> Loading…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-muted/30">
        <TopBar />
        <p className="p-10 text-destructive">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <TopBar />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Dashboard
          </Link>

          <Card className="overflow-hidden">
            <div className={`h-1.5 w-full bg-gradient-to-r ${accentFor(project.key)}`} />
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accentFor(project.key)} font-mono text-sm font-semibold text-white shadow-sm`}
              >
                {project.key.slice(0, 3)}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold">{project.name}</h1>
                {project.description ? (
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground/60">
                    Project key{" "}
                    <span className="font-mono text-primary">{project.key}</span>
                  </p>
                )}
              </div>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/projects/${project.id}/analytics`} />}
                >
                  <ChartColumn /> Analytics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/projects/${project.id}/sprints`} />}
                >
                  <Rocket /> Sprint planning
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Boards</h2>
            <NewBoardDialog projectId={project.id} onCreated={load} />
          </div>

          {project.boards.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <KanbanSquare className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No boards yet. Create one to start tracking tasks.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {project.boards.map((b) => (
                <Link key={b.id} href={`/boards/${b.id}`}>
                  <Card className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className="flex items-center gap-3 py-4">
                      <span className="brand-gradient flex size-9 items-center justify-center rounded-lg text-white">
                        <KanbanSquare className="size-5" />
                      </span>
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b._count?.columns ?? 0} columns
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <Activity className="size-5 text-primary" /> Recent activity
          </h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <Card>
              <CardContent className="divide-y p-0">
                {activity.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <span>{a.summary}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(a.createdAt)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}

function NewBoardDialog({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/projects/${projectId}/boards`, { name });
      onCreated();
      toast.success("Board created");
      setName("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create board");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> New board
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New board</DialogTitle>
          <DialogDescription>
            Boards come with To Do, In Progress, and Done columns.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="board-name">Board name</Label>
            <Input
              id="board-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint board"
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Create board
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
