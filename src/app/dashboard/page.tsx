"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Folder, Loader2, Plus } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ROLE_BADGE, accentFor, canManage } from "@/lib/ui";
import type { Me, Org, Project } from "@/lib/types";

function errMsg(err: unknown) {
  return err instanceof ApiClientError ? err.message : "Something went wrong";
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.get<{ user: Me | null }>("/api/auth/me");
        if (!user) {
          router.replace("/login");
          return;
        }
        setMe(user);
        const { organizations } = await api.get<{ organizations: Org[] }>("/api/orgs");
        setOrgs(organizations);
        setSelectedOrg(organizations[0]?.id ?? null);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const loadProjects = useCallback(async (orgId: string) => {
    const { projects } = await api.get<{ projects: Project[] }>(
      `/api/orgs/${orgId}/projects`,
    );
    setProjects(projects);
  }, []);

  useEffect(() => {
    if (selectedOrg) loadProjects(selectedOrg).catch(() => setProjects([]));
  }, [selectedOrg, loadProjects]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <TopBar />
        <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:grid-cols-[260px_1fr]">
          <Skeleton className="hidden h-64 rounded-xl md:block" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  const currentOrg = orgs.find((o) => o.id === selectedOrg);

  return (
    <div className="min-h-screen bg-muted/30">
      <TopBar userName={me?.name} />
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 md:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Organizations
            </h2>
            <NewOrgDialog
              onCreated={(org) => {
                setOrgs((prev) => [...prev, org]);
                setSelectedOrg(org.id);
              }}
            />
          </div>
          <ul className="space-y-1">
            {orgs.map((org) => (
              <li key={org.id}>
                <button
                  onClick={() => setSelectedOrg(org.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    org.id === selectedOrg
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  {org.role && (
                    <Badge
                      variant="secondary"
                      className={`ml-2 text-[10px] ${ROLE_BADGE[org.role]}`}
                    >
                      {org.role}
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Projects */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">{currentOrg?.name ?? "Projects"}</h1>
              <p className="text-sm text-muted-foreground">
                {projects.length} project{projects.length === 1 ? "" : "s"}
              </p>
            </div>
            {currentOrg && canManage(currentOrg.role) && (
              <NewProjectDialog
                orgId={currentOrg.id}
                onCreated={() => loadProjects(currentOrg.id)}
              />
            )}
          </div>

          {projects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Folder className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No projects yet. Create your first project to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <Card className="relative h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <span
                      className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${accentFor(p.key)}`}
                    />
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        <Badge variant="outline" className="font-mono text-primary">
                          {p.key}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {p.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {p.description}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground/60 italic">
                          No description
                        </p>
                      )}
                      <p className="mt-3 text-xs text-muted-foreground">
                        {p.boardCount ?? 0} boards · {p.taskCount ?? 0} tasks
                      </p>
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

function NewOrgDialog({ onCreated }: { onCreated: (org: Org) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { organization } = await api.post<{ organization: Org }>("/api/orgs", {
        name,
      });
      onCreated(organization);
      toast.success("Organization created");
      setName("");
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
          <DialogDescription>
            Organizations group your projects and teammates.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewProjectDialog({
  orgId,
  onCreated,
}: {
  orgId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/orgs/${orgId}/projects`, { name, key });
      onCreated();
      toast.success("Project created");
      setName("");
      setKey("");
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> New project
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            A short key (e.g. PMP) prefixes task references.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name">Project name</Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Website Redesign"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proj-key">Key</Label>
            <Input
              id="proj-key"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder="WEB"
              className="font-mono uppercase"
              maxLength={10}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
