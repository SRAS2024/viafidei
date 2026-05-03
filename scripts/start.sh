#!/bin/sh
# Container start script. Used by both the Dockerfile CMD and Railway's
# startCommand. Three responsibilities:
#
#   1. Wait briefly for the database to accept a connection. Railway
#      sometimes starts the web container before its linked Postgres
#      service is fully ready, and the previous start command crashed
#      the container hard whenever that happened, killing the deploy.
#
#   2. Run `prisma migrate deploy`. If it fails, log the failure but
#      do NOT crash the container — the Next.js server can still come
#      up, /api/health/live still returns 200 so Railway considers the
#      deploy healthy, and /api/health surfaces "migration_required" so
#      the operator can fix it without a deploy loop.
#
#   3. exec into the Next.js standalone server so signals (SIGTERM on
#      Railway redeploy) reach Node directly instead of the shell.
set -u

PRISMA_CLI="node node_modules/prisma/build/index.js"
DB_PROBE='node -e "const{PrismaClient}=require(\"@prisma/client\");const p=new PrismaClient();p.\$queryRaw\`SELECT 1\`.then(()=>{p.\$disconnect();process.exit(0)}).catch(()=>process.exit(1))"'

log() { echo "[start] $*"; }

log "viafidei container starting at $(date -u +%FT%TZ)"
log "node $(node --version), platform $(uname -srm), cwd $(pwd)"

# 1. Wait for DB. 30 attempts × 2s ≈ 60s total. Bounded so a permanently
# unreachable DB doesn't make the container hang past Railway's healthcheck
# timeout — we still hand off to the server and let the healthcheck report.
log "waiting for database to accept connections (up to 60s)..."
i=0
until eval "$DB_PROBE" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    log "WARN database still unreachable after 60s — continuing; /api/health will report status"
    break
  fi
  sleep 2
done
if [ "$i" -lt 30 ]; then
  log "database reachable after $((i * 2))s"
fi

# 2. Migrations. migrate deploy is idempotent; safe to run on every boot.
log "applying database migrations..."
if $PRISMA_CLI migrate deploy; then
  log "migrations OK"
else
  log "WARN migrate deploy exited non-zero — starting server anyway; /api/health will report 'migration_required'"
fi

# 3. Hand off. exec replaces this shell so Node owns PID 1 and receives signals.
log "starting next.js standalone server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
