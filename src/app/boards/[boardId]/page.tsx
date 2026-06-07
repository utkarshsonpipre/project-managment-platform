"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api, ApiClientError } from "@/lib/api";
import { connectSocket, getSocketIfReady } from "@/lib/socket";
import { TopBar } from "@/components/TopBar";
import { TaskDialog } from "@/components/board/TaskDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PRIORITY_META, initials } from "@/lib/ui";
import type { BoardColumn, BoardDetail, Member, TaskCard } from "@/lib/types";

export default function BoardPage() {
  const router = useRouter();
  const { boardId } = useParams<{ boardId: string }>();

  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>();

  const columnsRef = useRef<BoardColumn[]>([]);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  async function load() {
    try {
      const { board } = await api.get<{ board: BoardDetail }>(`/api/boards/${boardId}`);
      setBoard(board);
      setColumns(board.columns);
      const { members } = await api
        .get<{ members: Member[] }>(`/api/projects/${board.projectId}/members`)
        .catch(() => ({ members: [] as Member[] }));
      setMembers(members);
      const { user } = await api
        .get<{ user: { id: string } | null }>("/api/auth/me")
        .catch(() => ({ user: null }));
      if (user) setCurrentUserId(user.id);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.replace("/login");
        return;
      }
      toast.error(err instanceof ApiClientError ? err.message : "Failed to load board");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // Keep a stable reference to the latest load() for the realtime handler.
  const loadRef = useRef<() => void>(() => {});
  useEffect(() => {
    loadRef.current = load;
  });

  // Live updates: join the project room, refetch when anyone changes it.
  useEffect(() => {
    const projectId = board?.projectId;
    if (!projectId) return;
    let cancelled = false;
    const onUpdate = () => loadRef.current();
    connectSocket().then((socket) => {
      if (cancelled) return;
      socket.emit("join:project", projectId);
      socket.on("project:updated", onUpdate);
    });
    return () => {
      cancelled = true;
      const socket = getSocketIfReady();
      if (socket) {
        socket.off("project:updated", onUpdate);
        socket.emit("leave:project", projectId);
      }
    };
  }, [board?.projectId]);

  function persist(cols: BoardColumn[]) {
    api
      .patch(`/api/boards/${boardId}/reorder`, {
        columns: cols.map((c) => ({
          columnId: c.id,
          taskIds: c.tasks.map((t) => t.id),
        })),
      })
      .catch(() => {
        toast.error("Couldn't save the new order");
        load();
      });
  }

  function onDragStart(e: DragStartEvent) {
    const id = e.active.id as string;
    const found = columnsRef.current
      .flatMap((c) => c.tasks)
      .find((t) => t.id === id);
    setActiveTask(found ?? null);
  }

  // Live cross-column movement while dragging.
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;

    setColumns((prev) => {
      const activeCol = prev.find((c) => c.tasks.some((t) => t.id === activeId));
      const overCol =
        prev.find((c) => c.id === overId) ??
        prev.find((c) => c.tasks.some((t) => t.id === overId));
      if (!activeCol || !overCol || activeCol.id === overCol.id) return prev;

      const moved = activeCol.tasks.find((t) => t.id === activeId);
      if (!moved) return prev;

      let insertAt =
        overId === overCol.id
          ? overCol.tasks.length
          : overCol.tasks.findIndex((t) => t.id === overId);
      if (insertAt < 0) insertAt = overCol.tasks.length;

      return prev.map((c) => {
        if (c.id === activeCol.id) {
          return { ...c, tasks: c.tasks.filter((t) => t.id !== activeId) };
        }
        if (c.id === overCol.id) {
          const next = [...c.tasks];
          next.splice(insertAt, 0, moved);
          return { ...c, tasks: next };
        }
        return c;
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const cur = columnsRef.current;

    const activeCol = cur.find((c) => c.tasks.some((t) => t.id === activeId));
    const overCol =
      cur.find((c) => c.id === overId) ??
      cur.find((c) => c.tasks.some((t) => t.id === overId));
    if (!activeCol || !overCol) return;

    let next = cur;
    if (activeCol.id === overCol.id) {
      const oldIndex = activeCol.tasks.findIndex((t) => t.id === activeId);
      const newIndex =
        overId === overCol.id
          ? activeCol.tasks.length - 1
          : activeCol.tasks.findIndex((t) => t.id === overId);
      if (oldIndex !== newIndex && newIndex >= 0) {
        next = cur.map((c) =>
          c.id === activeCol.id
            ? { ...c, tasks: arrayMove(c.tasks, oldIndex, newIndex) }
            : c,
        );
        setColumns(next);
      }
    }
    persist(next);
  }

  function openTask(id: string) {
    setOpenTaskId(id);
    setDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 animate-spin" /> Loading…
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-muted/30">
        <TopBar />
        <p className="p-10 text-destructive">Board not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <TopBar />
      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-6">
        <div>
          <Link
            href={`/projects/${board.projectId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Project
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{board.name}</h1>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                projectId={board.projectId}
                onTaskAdded={load}
                onOpenTask={openTask}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCardView task={activeTask} dragging /> : null}
          </DragOverlay>
        </DndContext>
      </main>

      <TaskDialog
        taskId={openTaskId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        members={members}
        currentUserId={currentUserId}
        onSaved={load}
        onDeleted={load}
      />
    </div>
  );
}

function Column({
  column,
  projectId,
  onTaskAdded,
  onOpenTask,
}: {
  column: BoardColumn;
  projectId: string;
  onTaskAdded: () => void;
  onOpenTask: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  async function addTask() {
    const title = draft.trim();
    if (!title) return;
    setAdding(true);
    try {
      await api.post(`/api/projects/${projectId}/tasks`, { title, columnId: column.id });
      setDraft("");
      onTaskAdded();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to add task");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex w-80 flex-shrink-0 flex-col rounded-xl bg-muted/60 p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold">{column.name}</h3>
        <span className="rounded-full bg-background px-2 text-xs text-muted-foreground">
          {column.tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`min-h-2 flex-1 space-y-2 rounded-lg transition-colors ${
          isOver ? "bg-primary/5 ring-1 ring-primary/20" : ""
        }`}
      >
        <SortableContext
          items={column.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onOpen={onOpenTask} />
          ))}
        </SortableContext>
        {column.tasks.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground/70">
            Drop tasks here
          </p>
        )}
      </div>

      <input
        className="mt-2 w-full rounded-lg border border-transparent bg-background px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
        placeholder="+ Add task"
        value={draft}
        disabled={adding}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") addTask();
        }}
      />
    </div>
  );
}

function SortableTaskCard({
  task,
  onOpen,
}: {
  task: TaskCard;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      className="cursor-grab active:cursor-grabbing"
    >
      <TaskCardView task={task} />
    </div>
  );
}

function TaskCardView({ task, dragging }: { task: TaskCard; dragging?: boolean }) {
  const meta = PRIORITY_META[task.priority];
  return (
    <div
      className={`rounded-lg border border-l-4 ${meta.bar} bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
        dragging ? "rotate-2 shadow-lg ring-1 ring-primary/30" : ""
      }`}
    >
      <p className="text-sm leading-snug">{task.title}</p>
      <div className="mt-2.5 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${meta.badge}`}
        >
          <span className={`size-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        {task.assignee && (
          <Avatar className="size-5">
            <AvatarFallback className="bg-primary/10 text-[9px] font-medium text-primary">
              {initials(task.assignee.name)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
