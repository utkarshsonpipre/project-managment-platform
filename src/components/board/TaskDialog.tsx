"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PRIORITIES, PRIORITY_META } from "@/lib/ui";
import type { Member, Priority, TaskFull } from "@/lib/types";

interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  onSaved: () => void;
  onDeleted: () => void;
}

function errMsg(err: unknown) {
  return err instanceof ApiClientError ? err.message : "Something went wrong";
}

export function TaskDialog({
  taskId,
  open,
  onOpenChange,
  members,
  onSaved,
  onDeleted,
}: Props) {
  const [task, setTask] = useState<TaskFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open || !taskId) return;
    setLoading(true);
    api
      .get<{ task: TaskFull }>(`/api/tasks/${taskId}`)
      .then(({ task }) => {
        setTask(task);
        setTitle(task.title);
        setDescription(task.description ?? "");
        setPriority(task.priority);
        setAssigneeId(task.assignee?.id ?? "");
        setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
      })
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));
  }, [open, taskId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!taskId) return;
    setSaving(true);
    try {
      await api.patch(`/api/tasks/${taskId}`, {
        title,
        description: description.trim() || null,
        priority,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      });
      toast.success("Task updated");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!taskId) return;
    try {
      await api.del(`/api/tasks/${taskId}`);
      toast.success("Task deleted");
      onDeleted();
      onOpenChange(false);
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Task details</DialogTitle>
        </DialogHeader>

        {loading || !task ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto animate-spin" />
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Add more detail…"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <NativeSelect
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <NativeSelect
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-due">Due date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="destructive" onClick={remove}>
                <Trash2 /> Delete
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
