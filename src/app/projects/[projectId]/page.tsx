"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, KanbanSquare, Loader2, Plus, Rocket } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { project } = await api.get<{ project: ProjectDetail }>(
        `/api/projects/${projectId}`,
      );
      setProject(project);
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
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Dashboard
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <Badge variant="outline" className="font-mono text-primary">
              {project.key}
            </Badge>
            <div className="ml-auto">
              <Button variant="outline" size="sm" render={<Link href={`/projects/${project.id}/sprints`} />}>
                <Rocket /> Sprint planning
              </Button>
            </div>
          </div>
          {project.description && (
            <p className="mt-1 text-muted-foreground">{project.description}</p>
          )}
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
                  <Card className="transition-shadow hover:shadow-md hover:ring-1 hover:ring-primary/30">
                    <CardContent className="flex items-center gap-3 py-4">
                      <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
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
