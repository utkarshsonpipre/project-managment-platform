# Project Management Platform

🔗 **Live demo:** [pmp-web.onrender.com](https://pmp-web.onrender.com)

A Jira/Trello-style project management platform: **organizations → projects → boards → tasks**, with Kanban boards, role-based access control, sprint planning, real-time collaboration, notifications, activity logs, and analytics.

Built as a full-stack **Next.js** application (UI + REST API in one app), with supporting worker and realtime processes added in later phases.

> **Note:** the demo runs on Render's free tier, so the first request after a period of
> inactivity can take ~50 seconds while the service wakes up (cold start).

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
5. **Analytics** — project dashboard with charts (Recharts) + Redis-cached metrics API ✅
6. **DevOps & Cloud** — Dockerized services, GitHub Actions CI/CD, Nginx reverse proxy, Prometheus + Grafana, BullMQ worker ✅

## Production & operations

The whole stack runs via `docker-compose.prod.yml`: **web** (standalone Next image) · **realtime** · **worker** · **migrate** (one-shot) · **postgres** · **redis** · **minio** · **nginx** (reverse proxy on :80, routes `/socket.io/` to realtime) · **prometheus** (:9090) · **grafana** (:3002).

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- **Background jobs**: a BullMQ **worker** (`server/worker.ts`) consumes an email queue that the API enqueues whenever a notification is created. Run locally with `npm run worker`.
- **Metrics**: the app exposes Prometheus metrics at `/api/metrics` (default Node metrics + a `pmp_api_requests_total` counter). Prometheus scrapes it; **Grafana** auto-provisions a Prometheus datasource and a "PM Platform — Overview" dashboard.
- **CI/CD**: `.github/workflows/ci.yml` runs lint → typecheck → build on every push/PR, builds & pushes the web + node images to GHCR on the default branch, and has an SSH deploy-to-EC2 job (set `EC2_HOST`/`EC2_USER`/`EC2_SSH_KEY` secrets).
- **Images**: multi-stage `Dockerfile` (Next standalone) and `Dockerfile.node` (realtime/worker/migrate via `tsx`).

### Full local run (all services)

```bash
npm run infra:up        # postgres, redis, minio
npm run db:migrate
npm run dev             # web on :3000/:3001
npm run realtime        # ws on :4001
npm run worker          # background jobs
```

### Analytics

Each project has an analytics dashboard (`/projects/:id/analytics`): stat cards plus priority,
status, assignee-workload, sprint-velocity, and 14-day throughput charts. The aggregation endpoint
caches its result in Redis (30s TTL) — a cache hit is flagged in the response.

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
