import type { Priority, Role } from "@/lib/types";

export const PRIORITY_META: Record<
  Priority,
  { label: string; badge: string; dot: string; bar: string; hex: string }
> = {
  LOW: {
    label: "Low",
    badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    dot: "bg-slate-400",
    bar: "border-l-slate-400",
    hex: "#94a3b8",
  },
  MEDIUM: {
    label: "Medium",
    badge: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
    dot: "bg-blue-500",
    bar: "border-l-blue-500",
    hex: "#3b82f6",
  },
  HIGH: {
    label: "High",
    badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900",
    dot: "bg-amber-500",
    bar: "border-l-amber-500",
    hex: "#f59e0b",
  },
  URGENT: {
    label: "Urgent",
    badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900",
    dot: "bg-red-500",
    bar: "border-l-red-500",
    hex: "#ef4444",
  },
};

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const ROLE_BADGE: Record<Role, string> = {
  OWNER: "bg-indigo-100 text-indigo-700",
  ADMIN: "bg-violet-100 text-violet-700",
  MEMBER: "bg-emerald-100 text-emerald-700",
  VIEWER: "bg-slate-100 text-slate-600",
};

// Deterministic gradient accent (Tailwind `from-*`/`to-*`) derived from a seed
// like a project key, so each project gets a stable, distinct color.
const ACCENTS = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-500",
];

export function accentFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function canManage(role: Role | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
