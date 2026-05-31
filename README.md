# Project Management Platform

A Jira/Trello-style project management platform: **organizations → projects → boards → tasks**, with Kanban boards, role-based access control, sprint planning, real-time collaboration, notifications, activity logs, and analytics.

Built as a full-stack **Next.js** application (UI + REST API in one app), with supporting worker and realtime processes added in later phases.

## Tech stack

| Layer        | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| Framework    | Next.js 16 (App Router) + React 19 + TypeScript                   |
| Styling      | Tailwind CSS                                                      |
| Database     | PostgreSQL 16 + Prisma 7 (via `@prisma/adapter-pg` driver adapter) |
| Auth         | Custom JWT (access + refresh) with `jose`, bcrypt password hashing, RBAC |
| Cache/Queue  | Redis (used from Phase 4+)                                         |
| File storage | S3-compatible (MinIO locally, AWS S3 in production)               |
| Validation   | Zod                                                               |
| Infra (dev)  | Docker Compose (postgres, redis, minio)                           |

## Roadmap

1. **Foundation** — Next.js + TS, Docker infra, Prisma schema, JWT auth + RBAC ✅
2. **Core domain** — orgs, projects, boards, tasks CRUD + REST APIs ✅
3. **Kanban + Sprints** — drag-and-drop (dnd-kit), task detail panel, sprint planning, shadcn/ui polish ✅
4. **Collaboration** — comments, activity logs, notifications, realtime (Socket.IO + Redis pub/sub), team members ✅
5. **Analytics** — dashboards, burndown/velocity charts, Redis caching
6. **DevOps & Cloud** — GitHub Actions CI/CD, AWS EC2 + Nginx, real S3, Prometheus + Grafana

### UI

shadcn/ui (Base UI primitives) + Tailwind v4, with an indigo brand theme, drag-and-drop Kanban
(`@dnd-kit`), a task detail dialog with comments, a sprint-planning board (backlog + sprints,
start/complete), a notification bell, and a project activity feed.

### Realtime

A standalone Socket.IO server (`server/realtime.ts`) authenticates sockets via the same httpOnly
JWT cookie, then relays events published to Redis by the API. Boards and the sprint board live-update
across clients, and the notification bell updates instantly. Run it alongside the app:

```bash
npm run realtime      # ws server on :4001 (or npm run dev:realtime to watch)
```

## Getting started

### Prerequisites

- Node.js 20+ and npm
- Docker Desktop (for Postgres, Redis, MinIO)

### Setup

```bash
# 1. Copy env and (optionally) regenerate JWT secrets
cp .env.example .env

# 2. Start local infrastructure (postgres, redis, minio)
npm run infra:up

# 3. Install dependencies
npm install

# 4. Apply database migrations + generate Prisma client
npm run db:migrate

# 5. Start the dev server
npm run dev
```

App runs at http://localhost:3000 (or the next free port). Register a new account to bootstrap a workspace.

### Useful scripts

| Script               | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start Next.js dev server                 |
| `npm run build`      | Production build                         |
| `npm run typecheck`  | Type-check the whole project             |
| `npm run infra:up`   | Start Docker services                    |
| `npm run infra:down` | Stop Docker services                     |
| `npm run db:migrate` | Create/apply a Prisma migration          |
| `npm run db:studio`  | Open Prisma Studio (DB browser)          |

## API overview (Phase 1)

| Method | Endpoint                          | Description                          |
| ------ | --------------------------------- | ------------------------------------ |
| POST   | `/api/auth/register`              | Create account + workspace, log in   |
| POST   | `/api/auth/login`                 | Log in                               |
| POST   | `/api/auth/refresh`               | Rotate refresh token, mint access    |
| POST   | `/api/auth/logout`                | Revoke refresh token                 |
| GET    | `/api/auth/me`                    | Current user + memberships           |
| GET/POST | `/api/orgs`                     | List / create organizations          |
| GET/POST | `/api/orgs/:orgId/projects`     | List / create projects               |
| GET    | `/api/projects/:projectId`        | Project detail with boards           |
| GET/POST | `/api/projects/:projectId/boards` | List / create boards               |
| POST   | `/api/projects/:projectId/tasks`  | Create a task                        |
| GET    | `/api/boards/:boardId`            | Board with columns + tasks           |
| PATCH/DELETE | `/api/tasks/:taskId`        | Update (move) / delete a task        |

### Roles (RBAC)

`OWNER > ADMIN > MEMBER > VIEWER`, scoped per organization. Viewers can read; members and above can create/modify projects, boards, and tasks.

## Architecture notes

- **Prisma 7** no longer puts the connection URL in `schema.prisma`. It lives in `prisma.config.ts`; the runtime client connects through the `pg` driver adapter (`src/lib/db.ts`).
- **Auth** is verified inside route handlers via `requireUser()` / `requireOrgRole()` helpers rather than in `proxy.ts` (Next 16's renamed middleware), which is the recommended pattern for real authorization.
- Refresh tokens are **opaque and stored hashed** (SHA-256) for server-side revocation and rotation.
