#!/bin/bash
# Run the pray-along voice engine, or its planner, against the PRODUCTION database
# from this Mac, the way the Admin Worker launcher does it: the connection string is
# Railway's public Postgres URL, read from the linked Railway project into this
# process's memory only. Nothing is written to disk.
#
#   scripts/voice/launch.sh engine [worker.py args]   # make clips: listeners first, then the plan
#                                                     # (and plan again once a day when idle)
#   scripts/voice/launch.sh plan   [--dry-run …]      # file every clip the site will need
#   scripts/voice/launch.sh status                    # counts by language and status
#
# A loopback database is refused unless VIAFIDEI_ALLOW_LOCAL_DB=1 (so a broken
# Railway link can never silently make audio into a local copy of the site).
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR" || exit 1
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin"

MODE="${1:-engine}"
shift || true

resolve_db() {
  if [ -n "${DATABASE_URL:-}" ] && [ "${VIAFIDEI_VOICE_USE_ENV_DB:-0}" = "1" ]; then
    return 0
  fi
  local json url
  json="$(node scripts/desktop-app/railway-public-db-url.mjs 2>/dev/null)" || true
  url="$(printf '%s' "$json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).publicDbUrl||"")}catch{}})')"
  if [ -z "$url" ]; then
    echo "[voice] could not read the production database address from Railway (is the CLI logged in and this folder linked?)" >&2
    exit 3
  fi
  export DATABASE_URL="$url"
}

refuse_loopback() {
  case "$DATABASE_URL" in
    *@localhost*|*@127.*|*@\[::1\]*)
      if [ "${VIAFIDEI_ALLOW_LOCAL_DB:-0}" != "1" ]; then
        echo "[voice] refusing a local database; set VIAFIDEI_ALLOW_LOCAL_DB=1 to use one on purpose" >&2
        exit 4
      fi
      ;;
  esac
}

python_for_engine() {
  for p in "$PROJECT_DIR/voice-engine/.venv/bin/python" "$PROJECT_DIR/.cache/voice-engine-venv/bin/python"; do
    [ -x "$p" ] && { printf '%s' "$p"; return 0; }
  done
  echo "[voice] the voice engine is not set up: run voice-engine/setup.sh" >&2
  exit 5
}

resolve_db
refuse_loopback

case "$MODE" in
  engine)
    PY="$(python_for_engine)"
    # The engine works whenever the Mac is awake. VIAFIDEI_VOICE_KEEP_AWAKE=1 also keeps
    # it from idle sleep while the engine runs (for a long first pass); off by default, so
    # a login item never holds the Mac awake for good.
    if [ "${VIAFIDEI_VOICE_KEEP_AWAKE:-0}" = "1" ]; then
      exec /usr/bin/caffeinate -i "$PY" "$PROJECT_DIR/voice-engine/worker.py" --replan-daily "$@"
    fi
    exec "$PY" "$PROJECT_DIR/voice-engine/worker.py" --replan-daily "$@"
    ;;
  plan)
    exec "$PROJECT_DIR/node_modules/.bin/tsx" "$PROJECT_DIR/scripts/pray-along-plan.ts" "$@"
    ;;
  status)
    PY="$(python_for_engine)"
    exec "$PY" "$PROJECT_DIR/voice-engine/worker.py" --status
    ;;
  *)
    echo "usage: scripts/voice/launch.sh engine|plan|status [args]" >&2
    exit 2
    ;;
esac
