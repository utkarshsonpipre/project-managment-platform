#!/bin/sh
# Apply any pending DB migrations, then start the realtime server.
# Used as the realtime service's start command on Render (free tier can't use
# preDeployCommand, and dockerCommand isn't guaranteed to run via a shell).
set -e
echo "[start] prisma migrate deploy"
npx prisma migrate deploy
echo "[start] launching realtime server"
exec npx tsx server/realtime.ts
