"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Inbox,
  Loader2,
  Play,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PRIORITY_META, initials } from "@/lib/ui";
import type {
  PlanningData,
  SprintStatus,
  SprintTask,
  SprintWithTasks,
} from "@/lib/types";

const STATUS_BADGE: Record<SprintStatus, string> = {
  PLANNED: "bg-slate-100 text-slate-600",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-indigo-100 text-indigo-700",
};

function errMsg(err: unknown) {
  return err instanceof ApiClientError ? err.message : "Something went wrong";
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function SprintPlanningPage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();

  const [data, setData] = useState<PlanningData | null>(null);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [{ project }, planning] = await Promise.all([
        api.get<{ project: { name: string } }>(`/api/projects/${projectId}`),
        api.get<PlanningData>(`/api/projects/${projectId}/planning`),
      ]);
      setProjectName(project.name);
      setData(planning);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.replace("/login");
        return;
      }
      toast.error(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Live updates while planning.
  useEffect(() => {
    const socket = getSocket();
    socket.emit("join:project", projectId);
    const onUpdate = () => load();
    socket.on("project:updated", onUpdate);
    return () => {
      socket.off("project:updated", onUpdate);
      socket.emit("leave:project", projectId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function moveTask(taskId: string, sprintId: string | null) {
    try {
      await api.patch(`/api/tasks/${taskId}`, { sprintId });
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function setStatus(sprintId: string, status: SprintStatus) {
    try {
      await api.patch(`/api/sprints/${sprintId}`, { status });
      toast.success(status === "ACTIVE" ? "Sprint started" : "Sprint completed");
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  async function deleteSprint(sprintId: string) {
    try {
      await api.del(`/api/sprints/${sprintId}`);
      toast.success("Sprint deleted");
      await load();
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

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
        <p className="p-10 text-destructive">Could not load sprint planning.</p>
      </div>
    );
  }

  const sprintOptions = data.sprints.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="min-h-screen bg-muted/30">
      <TopBar />
      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href={`/projects/${projectId}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" /> {projectName}
            </Link>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
              <Rocket className="size-6 text-primary" /> Sprint planning
            </h1>
          </div>
          <NewSprintDialog projectId={projectId} onCreated={load} />
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4">
          {/* Backlog */}
          <PlanningColumn
            title="Backlog"
            icon={<Inbox className="size-4" />}
            count={data.backlog.length}
          >
            {data.backlog.length === 0 ? (
              <EmptyHint>Backlog is empty</EmptyHint>
            ) : (
              data.backlog.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  currentValue=""
                  sprints={sprintOptions}
                  onMove={(v) => moveTask(task.id, v || null)}
                />
              ))
            )}
          </PlanningColumn>

          {/* Sprints */}
          {data.sprints.map((sprint) => (
            <SprintColumn
              key={sprint.id}
              sprint={sprint}
              sprints={sprintOptions}
              onMove={moveTask}
              onStatus={setStatus}
              onDelete={deleteSprint}
            />
          ))}

          {data.sprints.length === 0 && (
            <div className="flex w-80 flex-shrink-0 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              Create a sprint to start planning →
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PlanningColumn({
  title,
  icon,
  count,
  headerRight,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count: number;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-80 flex-shrink-0 flex-col rounded-xl bg-muted/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {icon}
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">
            {count}
          </span>
        </div>
        {headerRight}
      </div>
      <div className="flex-1 space-y-2">{children}</div>
    </div>
  );
}

function SprintColumn({
  sprint,
  sprints,
  onMove,
  onStatus,
  onDelete,
}: {
  sprint: SprintWithTasks;
  sprints: { id: string; name: string }[];
  onMove: (taskId: string, sprintId: string | null) => void;
  onStatus: (sprintId: string, status: SprintStatus) => void;
  onDelete: (sprintId: string) => void;
}) {
  const dates = [fmtDate(sprint.startDate), fmtDate(sprint.endDate)]
    .filter(Boolean)
    .join(" – ");

  return (
    <PlanningColumn
      title={sprint.name}
      count={sprint.tasks.length}
      headerRight={
        <Badge variant="secondary" className={`text-[10px] ${STATUS_BADGE[sprint.status]}`}>
          {sprint.status}
        </Badge>
      }
    >
      {(sprint.goal || dates) && (
        <div className="rounded-lg bg-background/60 px-2.5 py-2 text-xs text-muted-foreground">
          {sprint.goal && <p className="line-clamp-2">{sprint.goal}</p>}
          {dates && <p className="mt-0.5">{dates}</p>}
        </div>
      )}

      <div className="flex gap-1.5">
        {sprint.status === "PLANNED" && (
          <Button size="xs" onClick={() => onStatus(sprint.id, "ACTIVE")}>
            <Play /> Start
          </Button>
        )}
        {sprint.status === "ACTIVE" && (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => onStatus(sprint.id, "COMPLETED")}
          >
            <CheckCircle2 /> Complete
          </Button>
        )}
        <Button
          size="icon-xs"
          variant="ghost"
          className="ml-auto text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(sprint.id)}
          title="Delete sprint"
        >
          <Trash2 />
        </Button>
      </div>

      {sprint.tasks.length === 0 ? (
        <EmptyHint>No tasks in this sprint</EmptyHint>
      ) : (
        sprint.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            currentValue={sprint.id}
            sprints={sprints}
            onMove={(v) => onMove(task.id, v || null)}
          />
        ))
      )}
    </PlanningColumn>
  );
}

function TaskRow({
  task,
  currentValue,
  sprints,
  onMove,
}: {
  task: SprintTask;
  currentValue: string;
  sprints: { id: string; name: string }[];
  onMove: (value: string) => void;
}) {
  const meta = PRIORITY_META[task.priority];
  return (
    <div className={`rounded-lg border border-l-4 ${meta.bar} bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug">{task.title}</p>
        {task.assignee && (
          <Avatar className="size-5 shrink-0">
            <AvatarFallback className="bg-primary/10 text-[9px] font-medium text-primary">
              {initials(task.assignee.name)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${meta.badge}`}
        >
          <span className={`size-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        <NativeSelect
          className="ml-auto h-6 w-auto pr-7 pl-2 text-xs"
          value={currentValue}
          onChange={(e) => onMove(e.target.value)}
        >
          <option value="">Backlog</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-6 text-center text-xs text-muted-foreground/70">{children}</p>
  );
}

function NewSprintDialog({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/projects/${projectId}/sprints`, {
        name,
        goal: goal.trim() || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      });
      toast.success("Sprint created");
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> New sprint
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New sprint</DialogTitle>
          <DialogDescription>
            Group backlog tasks into a time-boxed sprint.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sprint-name">Name</Label>
            <Input
              id="sprint-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 1"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sprint-goal">Goal (optional)</Label>
            <Textarea
              id="sprint-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              placeholder="What should this sprint achieve?"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-start">Start date</Label>
              <Input
                id="sprint-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-end">End date</Label>
              <Input
                id="sprint-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Create sprint
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
