# Deploying to Render

This repo ships a **Render Blueprint** (`render.yaml`) that provisions everything:

| Service | Type | What it is |
| --- | --- | --- |
| `pmp-db` | PostgreSQL | Database |
| `pmp-redis` | Key Value (Redis) | Cache · realtime pub/sub · job queue |
| `pmp-realtime` | Web (Docker) | Socket.IO server; also runs DB migrations on deploy |
| `pmp-web` | Web (Docker) | Next.js app (UI + REST API) |
| `pmp-worker` | Worker (Docker) | **Optional** background jobs — paid plan only (commented out) |

## Prerequisite — push the code to GitHub

Render deploys from a Git repo, and this project isn't pushed anywhere yet. Create
an **empty** GitHub repo (no README/license), then run these in the project folder.
In Claude Code you can prefix with `!` to run them in your own shell (so your GitHub
login is used):

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin master
```

## Deploy

1. Go to the **Render dashboard** → **New +** → **Blueprint**.
2. Connect your GitHub account and pick this repository.
3. Render reads `render.yaml` and lists the services it will create. Click **Apply**.
4. First deploy order: the database + Key Value provision first, then `pmp-realtime`
   runs `prisma migrate deploy` (creating all tables) before starting, then `pmp-web`
   comes up. Wait until every service is **green / Live**.
5. Open the **`pmp-web`** service URL (e.g. `https://pmp-web.onrender.com`) and register
   an account.

That's it — no secrets to paste. The blueprint:
- generates `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` once and shares them between
  `pmp-web` and `pmp-realtime`,
- wires `DATABASE_URL` and `REDIS_URL` from the managed services automatically,
- tells the web app where the realtime server is via `REALTIME_PUBLIC_HOST`.

## How realtime works in production

The browser calls `GET /api/realtime-info`, which returns the realtime URL and a
fresh access token. The socket connects to `pmp-realtime` and authenticates with
that token in the handshake (the login cookie can't cross subdomains, so we use a
token instead). No extra configuration needed.

## Free-tier caveats (good to know)

- **Spin-down**: free web services sleep after ~15 min idle, so the first request
  after a nap is slow (cold start). Realtime reconnects automatically when the web
  app wakes.
- **PostgreSQL**: the free database expires after ~30 days — fine for a demo; upgrade
  for anything permanent.
- **Key Value (Redis)**: free tier is small and non-persistent — fine for cache /
  pub/sub / a light queue.
- **Worker**: needs a paid plan. To enable it, uncomment the `pmp-worker` block in
  `render.yaml` and re-apply the blueprint. The app works fine without it.

## Switching file storage to real AWS S3 (when you add attachments)

MinIO isn't used on Render. When you build the attachments feature, create an S3
bucket + IAM keys and add `S3_*` env vars to `pmp-web` — no code change needed.

## Custom domain / HTTPS

Render gives every web service free HTTPS on its `*.onrender.com` URL. To use your
own domain, add it under the `pmp-web` service settings; certificates are automatic.
