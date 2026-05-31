"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Trash2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NativeSelect } from "@/components/ui/native-select";
import { PRIORITIES, PRIORITY_META, initials, timeAgo } from "@/lib/ui";
import type { Comment, Member, Priority, TaskFull } from "@/lib/types";

interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  currentUserId?: string;
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
  currentUserId,
  onSaved,
  onDeleted,
}: Props) {
  const [task, setTask] = useState<TaskFull | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!open || !taskId) return;
    setLoading(true);
    Promise.all([
      api.get<{ task: TaskFull }>(`/api/tasks/${taskId}`),
      api.get<{ comments: Comment[] }>(`/api/tasks/${taskId}/comments`),
    ])
      .then(([{ task }, { comments }]) => {
        setTask(task);
        setComments(comments);
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

  async function postComment() {
    const body = newComment.trim();
    if (!body || !taskId) return;
    setPosting(true);
    try {
      const { comment } = await api.post<{ comment: Comment }>(
        `/api/tasks/${taskId}/comments`,
        { body },
      );
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(id: string) {
    try {
      await api.del(`/api/comments/${id}`);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(errMsg(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Task details</DialogTitle>
        </DialogHeader>

        {loading || !task ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
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

            <Separator />

            {/* Comments */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                Comments {comments.length > 0 && `(${comments.length})`}
              </h3>

              <div className="space-y-3">
                {comments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar className="mt-0.5 size-7 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-[10px] font-medium text-primary">
                        {initials(c.author.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{c.author.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(c.createdAt)}
                        </span>
                        {c.author.id === currentUserId && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="ml-auto text-muted-foreground hover:text-destructive"
                            title="Delete comment"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-foreground/90">
                        {c.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  placeholder="Write a comment…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment();
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={postComment}
                  disabled={posting || !newComment.trim()}
                  title="Post comment (Ctrl/Cmd+Enter)"
                >
                  {posting ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
