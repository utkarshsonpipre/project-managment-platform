import type { Priority, Role } from "@/lib/types";

export const PRIORITY_META: Record<
  Priority,
  { label: string; badge: string; dot: string }
> = {
  LOW: {
    label: "Low",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
  MEDIUM: {
    label: "Medium",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  HIGH: {
    label: "High",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  URGENT: {
    label: "Urgent",
    badge: "bg-red-100 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

export const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export const ROLE_BADGE: Record<Role, string> = {
  OWNER: "bg-indigo-100 text-indigo-700",
  ADMIN: "bg-violet-100 text-violet-700",
  MEMBER: "bg-emerald-100 text-emerald-700",
  VIEWER: "bg-slate-100 text-slate-600",
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function canManage(role: Role | null | undefined): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MEMBER";
}
