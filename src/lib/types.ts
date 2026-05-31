export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Me {
  id: string;
  name: string;
  email: string;
  memberships: { role: Role; org: { id: string; name: string; slug: string } }[];
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  role: Role | null;
  projectCount: number;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string | null;
  boardCount?: number;
  taskCount?: number;
  createdAt: string;
}

export interface BoardSummary {
  id: string;
  name: string;
  position: number;
  _count?: { columns: number };
}

export interface ProjectDetail {
  id: string;
  name: string;
  key: string;
  description: string | null;
  orgId: string;
  createdAt: string;
  boards: BoardSummary[];
}

export interface TaskCard {
  id: string;
  title: string;
  priority: Priority;
  position: number;
  dueDate: string | null;
  columnId?: string | null;
  assignee: { id: string; name: string } | null;
}

export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  tasks: TaskCard[];
}

export interface BoardDetail {
  id: string;
  name: string;
  projectId: string;
  columns: BoardColumn[];
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED";

export interface SprintTask {
  id: string;
  title: string;
  priority: Priority;
  assignee: { id: string; name: string } | null;
}

export interface SprintWithTasks {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  tasks: SprintTask[];
}

export interface PlanningData {
  backlog: SprintTask[];
  sprints: SprintWithTasks[];
}

export interface TaskFull {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priority: Priority;
  columnId: string | null;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  creator: { id: string; name: string } | null;
  createdAt: string;
}
