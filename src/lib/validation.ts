import { z } from "zod";
import { Priority, Role, SprintStatus } from "@prisma/client";

// ---- Auth ----

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

// ---- Organizations ----

export const createOrgSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
});

export const addMemberSchema = z.object({
  email: z.email("A valid email is required"),
  role: z.enum(Role).optional(),
});

// ---- Projects ----

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  key: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Key must be uppercase letters/numbers")
    .transform((s) => s.toUpperCase()),
  description: z.string().max(2000).optional(),
});

// ---- Boards ----

export const createBoardSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
});

// ---- Tasks ----

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(Priority).optional(),
  columnId: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.iso.datetime().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: z.enum(Priority).optional(),
  columnId: z.string().nullable().optional(),
  sprintId: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
  dueDate: z.iso.datetime().nullable().optional(),
});

// ---- Comments ----

export const createCommentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty").max(5000),
});

// ---- Sprints ----

export const createSprintSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  goal: z.string().max(2000).optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
});

export const updateSprintSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  goal: z.string().max(2000).nullable().optional(),
  status: z.enum(SprintStatus).optional(),
  startDate: z.iso.datetime().nullable().optional(),
  endDate: z.iso.datetime().nullable().optional(),
});
