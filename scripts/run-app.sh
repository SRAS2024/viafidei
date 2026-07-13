#!/bin/bash
# Via Fidei LOCAL DEV STACK launcher (for developing against a local Postgres).
#
# NOTE: This is NOT the desktop app. "Via Fidei.app" (scripts/desktop-app/) is a
# WebKit window onto the LIVE deployed site and runs no local server. This
# script is a convenience for LOCAL development — it brings the full stack up on
# this machine (local Postgres + web + worker) and opens the local site:
#   1. ensures the Homebrew Postgres 16 cluster is running
#   2. applies any pending migrations
#   3. starts the Next.js web service (port 3000) if not already up
#   4. starts the autonomous Admin Worker if not already up
#   5. opens http://localhost:3000 in the default browser
#
# Safe to run repeatedly: each service is only started if it isn't already
# listening / running. Logs go to logs/web.log and logs/worker.log.
set -u

# Resolve the project directory (this script lives in <project>/scripts).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

# Homebrew tool paths (Finder-launched apps do not inherit a login shell PATH).
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export INTELLIGENCE_PYTHON="${INTELLIGENCE_PYTHON:-/opt/homebrew/opt/python@3.11/bin/python3.11}"

mkdir -p logs
echo "Via Fidei — starting local stack from $PROJECT_DIR"

# 1. Postgres
if ! pg_isready -q 2>/dev/null; then
  echo "Starting PostgreSQL 16..."
  brew services start postgresql@16 >/dev/null 2>&1
  for _ in $(seq 1 30); do pg_isready -q 2>/dev/null && break; sleep 1; done
fi
echo "PostgreSQL: $(pg_isready 2>/dev/null || echo 'not ready')"

# 2. Migrations (idempotent)
npx prisma migrate deploy >/dev/null 2>&1 || echo "warn: migrate deploy reported an issue (continuing)"

# 3. Web service on :3000
if ! curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
  echo "Starting web service (port 3000)..."
  nohup npm run dev > logs/web.log 2>&1 &
  for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:3000/ 2>/dev/null && break; sleep 1; done
fi
echo "Web service: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)"

# 4. Admin Worker (autonomous content / diagnostics / discovery / repair)
if ! pgrep -f "run-worker.ts" >/dev/null 2>&1; then
  echo "Starting Admin Worker..."
  nohup npm run worker > logs/worker.log 2>&1 &
fi
echo "Admin Worker: running"

# 5. Open the site
sleep 1
open http://localhost:3000
echo "Via Fidei is up at http://localhost:3000"
