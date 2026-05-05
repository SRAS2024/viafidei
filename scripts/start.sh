#!/bin/sh
# Container start script. Used by both the Dockerfile CMD and Railway's
# startCommand. Four responsibilities, each fail-fast:
#
#   1. Wait briefly for the database to accept a connection. Railway can
#      spin up the web container before the linked Postgres service is
#      ready, so we poll for up to 60s before giving up.
#
#   2. Run `prisma migrate deploy`. If it fails, exit non-zero so the
#      deploy fails immediately instead of letting the Next.js server come
#      up against a half-migrated schema and serve 500s for every request.
#      Railway's restart policy will retry; if the migration is genuinely
#      broken the deploy stays red, which is the correct signal.
#
#   3. Run scripts/validate-db.js. This double-checks that every required
#      table, column, and migration row is in place after migrate deploy
#      claims to have succeeded. If validation fails, exit non-zero — same
#      reasoning as step 2: we'd rather have a failing deploy than a
#      running container with a broken database.
#
#   4. exec into the Next.js standalone server so signals (SIGTERM on
#      Railway redeploy) reach Node directly instead of the shell.
set -u

PRISMA_CLI="node node_modules/prisma/build/index.js"
DB_PROBE='node -e "const{PrismaClient}=require(\"@prisma/client\");const p=new PrismaClient();p.\$queryRaw\`SELECT 1\`.then(()=>{p.\$disconnect();process.exit(0)}).catch(()=>process.exit(1))"'

log() { echo "[start] $*"; }
fail() {
  log "FATAL $*"
  exit 1
}

log "viafidei container starting at $(date -u +%FT%TZ)"
log "node $(node --version), platform $(uname -srm), cwd $(pwd)"

# 1. Wait for DB. 30 attempts × 2s ≈ 60s total. Bounded so a permanently
# unreachable DB doesn't make the container hang past Railway's healthcheck
# timeout — but unlike before, an unreachable DB is now a hard failure.
log "waiting for database to accept connections (up to 60s)..."
i=0
until eval "$DB_PROBE" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 30 ]; then
    fail "database unreachable after 60s — refusing to start server"
  fi
  sleep 2
done
log "database reachable after $((i * 2))s"

# 2. Migrations. migrate deploy is idempotent; safe to run on every boot.
# Failing here exits the container so Railway marks the deploy as failed,
# instead of starting a server against a half-applied schema.
log "applying database migrations..."
if ! $PRISMA_CLI migrate deploy; then
  fail "prisma migrate deploy failed — refusing to start server"
fi
log "migrations OK"

# 3. Post-migration validation: tables, columns, migration history, sample
# read on every public content table. See scripts/validate-db.js.
log "validating database schema..."
if ! node ./scripts/validate-db.js; then
  fail "database validation failed — refusing to start server"
fi
log "database validation OK"

# 4. Hand off. exec replaces this shell so Node owns PID 1 and receives signals.
log "starting next.js standalone server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
