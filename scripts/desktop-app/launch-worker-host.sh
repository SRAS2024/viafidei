#!/bin/bash
# Launch the local Admin Worker host with its configuration coming from Railway
# rather than from anything typed on this computer.
#
# WHY THIS EXISTS. The worker runs on the operator's Mac but reads and writes
# the production Postgres, so it needs a connection string. Re-entering those
# values in a local file means a second copy of production secrets on a laptop,
# which then drifts from Railway. Instead, when the Railway CLI is installed and
# the checkout is linked to the project, this launcher runs the host under
# `railway run`, which injects the linked service's variables into the process
# environment for its lifetime. Nothing is written to disk, and Railway stays
# the single source of truth.
#
# THE ONE THING `railway run` CANNOT DO ALONE. Inside Railway, services reach
# Postgres over the private network: the web service's DATABASE_URL points at
# `postgres.railway.internal`, a hostname that resolves nowhere else. A worker
# on a laptop that inherited it would connect to nothing — and, worse, if the
# repository .env is left pointing at a local Postgres, it would silently
# publish to THAT database while every dashboard says "active". So before the
# host starts, `railway-public-db-url.mjs` resolves the linked ENVIRONMENT, the
# WEB service (whose variables to inject) and the Postgres service's
# DATABASE_PUBLIC_URL (the `*.proxy.rlwy.net` TCP proxy Railway provides for
# exactly this), dry-runs `railway run`, and the launcher swaps the public URL
# in — in memory only.
#
# Precedence is what makes this safe, and it is verified behaviour, not an
# assumption: @prisma/client loads .env itself, but it does NOT overwrite a
# variable that is already present in the environment — an EMPTY value counts
# as present. So injected Railway values win, a local .env is only the
# fallback, and exporting DATABASE_URL="" is how this launcher forbids the .env
# fallback outright.
#
# Order:
#   1. Variables already in the environment  (whoever launched us set them)
#   2. `railway run` + the public Postgres URL (CLI installed AND project linked)
#   3. the repository .env                   (loaded by Prisma itself) — but
#      NEVER a loopback database unless VIAFIDEI_ALLOW_LOCAL_DB=1
#   4. nothing — the host still starts and reports the problem in the app
#
# The host ALWAYS starts, even unconfigured: the app needs a control surface to
# display the error. Failing silently here would leave a dead window. Every
# branch prints exactly one {"viafideiLauncher":{...}} JSON line on stdout,
# which the app parses into its configuration label (and an alert on error).
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR" || exit 1

# Finder-launched apps inherit a minimal PATH; add the usual install locations
# for node, tsx and the Railway CLI (Homebrew on both architectures, the
# official installer, npm globals).
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.npm-global/bin:$HOME/.local/bin"

HOST_ARGS=("scripts/local-worker-host.ts" "$@")

# Whether a connection string was already in the environment BEFORE node starts.
# This has to be captured here: @prisma/client loads the repository .env during
# module evaluation, and ES module imports are hoisted, so by the time any
# JavaScript of ours runs the distinction is already gone.
if [ -n "${DATABASE_URL:-}" ]; then
  export VIAFIDEI_DB_FROM_ENV="1"
else
  export VIAFIDEI_DB_FROM_ENV="0"
fi

# The host's own Prisma pool. The host only reads status, renews the lease and
# runs the occasional operator job; the worker CHILD does the real work with
# its own pool (the host raises the limit to 10 for it). Two full pools plus
# the web service would crowd a small Railway Postgres. Set inside the
# `railway run` wrapper too, because injected service variables come later
# and would otherwise replace it with the web service's setting.
HOST_CONNECTION_LIMIT="${VIAFIDEI_HOST_CONNECTION_LIMIT:-3}"
export PRISMA_CONNECTION_LIMIT="${PRISMA_CONNECTION_LIMIT:-$HOST_CONNECTION_LIMIT}"

# The Python intelligence brain needs a 3.11 interpreter with its packages.
# Prefer the Homebrew 3.11 when it exists and nothing was configured; otherwise
# leave the variable unset so the client's own resolver decides.
if [ -z "${INTELLIGENCE_PYTHON:-}" ] && [ -x /opt/homebrew/opt/python@3.11/bin/python3.11 ]; then
  export INTELLIGENCE_PYTHON="/opt/homebrew/opt/python@3.11/bin/python3.11"
fi

# VIAFIDEI_HOST_RUNNER is a test hook: the behavioural tests substitute a stub
# that records the environment the host would have been started with.
if [ -n "${VIAFIDEI_HOST_RUNNER:-}" ]; then
  RUNNER=("$VIAFIDEI_HOST_RUNNER")
elif [ -x "$PROJECT_DIR/node_modules/.bin/tsx" ]; then
  RUNNER=("$PROJECT_DIR/node_modules/.bin/tsx")
else
  RUNNER=(npx --yes tsx)
fi

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/ }"
  s="${s//$'\r'/ }"
  s="${s//$'\t'/ }"
  printf '%s' "$s"
}

# emit_notice LEVEL MESSAGE SOURCE ROUTE ENVIRONMENT SERVICE DBHOST
# One structured line for the app; the same message readable on stderr.
emit_notice() {
  printf '{"viafideiLauncher":{"level":"%s","message":"%s","source":"%s","route":"%s","environment":"%s","service":"%s","databaseHost":"%s"}}\n' \
    "$(json_escape "$1")" "$(json_escape "$2")" "$(json_escape "$3")" "$(json_escape "$4")" \
    "$(json_escape "$5")" "$(json_escape "$6")" "$(json_escape "$7")"
  echo "[launcher] $1: $2" >&2
}

# Host[:port]/database of a connection string, credentials stripped.
db_host_of() {
  local u="$1"
  [ -z "$u" ] && { printf ''; return; }
  u="${u#*://}"
  u="${u%%\?*}"
  local hostpart="${u%%/*}"
  local dbpath=""
  case "$u" in */*) dbpath="/${u#*/}" ;; esac
  hostpart="${hostpart##*@}"
  printf '%s%s' "$hostpart" "$dbpath"
}

# Bare hostname (no port / database) — IPv6 literals keep their brackets.
host_name_of() {
  local hp
  hp="$(db_host_of "$1")"
  hp="${hp%%/*}"
  case "$hp" in
    \[*) printf '%s' "${hp%%]*}]" ;;
    *) printf '%s' "${hp%%:*}" ;;
  esac
}

is_loopback_host() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    localhost|127.*|"[::1]"|::1) return 0 ;;
    *) return 1 ;;
  esac
}

# DATABASE_URL as the repository .env would supply it (Prisma reads the file
# itself; this only PEEKS so the launcher can refuse a loopback database).
dotenv_database_url() {
  [ -f "$PROJECT_DIR/.env" ] || { printf ''; return; }
  local line
  line="$(grep -E '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL[[:space:]]*=' "$PROJECT_DIR/.env" | tail -n 1)"
  [ -z "$line" ] && { printf ''; return; }
  line="${line#*=}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  case "$line" in
    \"*\") line="${line#\"}"; line="${line%\"}" ;;
    \'*\') line="${line#\'}"; line="${line%\'}" ;;
  esac
  printf '%s' "$line"
}

start_host_without_railway() {
  # $1 = message, $2 = level, $3 = source, $4 = route, $5 = db host
  export VIAFIDEI_CONFIG_SOURCE="$3"
  export VIAFIDEI_DB_ROUTE="$4"
  export VIAFIDEI_LAUNCHER_MESSAGE="$1"
  emit_notice "$2" "$1" "$3" "$4" "" "" "$5"
  exec "${RUNNER[@]}" "${HOST_ARGS[@]}"
}

# ---------------------------------------------------------------------------
# 1. Railway — resolve environment + services explicitly, dry-run, then exec
# ---------------------------------------------------------------------------

RAILWAY_STATE="absent"
RESOLVED_JSON=""
if command -v railway >/dev/null 2>&1; then
  RESOLVED_JSON="$(node "$SCRIPT_DIR/railway-public-db-url.mjs" 2>>"${VIAFIDEI_LAUNCHER_LOG:-/dev/stderr}")"
  case $? in
    0) RAILWAY_STATE="resolved" ;;
    2) RAILWAY_STATE="unresolved" ;;   # linked, but no usable web service
    *) RAILWAY_STATE="unlinked" ;;     # not logged in / not linked / CLI error
  esac
fi

if [ "$RAILWAY_STATE" = "resolved" ] || [ "$RAILWAY_STATE" = "unresolved" ]; then
  # Pull the fields out of the one JSON object (never the URL onto stdout).
  RESOLVED_FIELDS="$(RESOLVED_JSON="$RESOLVED_JSON" node -e '
    const o = JSON.parse(process.env.RESOLVED_JSON || "{}");
    const s = (v) => (v == null ? "" : String(v)).replace(/\n/g, " ");
    process.stdout.write([
      s(o.environment), s(o.webService), s(o.postgresService), s(o.publicDbUrl),
      o.dryRun && o.dryRun.ok === false ? s(o.dryRun.error || "railway run failed") : "",
      s(o.error),
    ].join("\n"));
  ')"
  {
    IFS= read -r RW_ENV
    IFS= read -r RW_WEB
    IFS= read -r RW_PG
    IFS= read -r RW_PUBLIC_URL
    IFS= read -r RW_DRYRUN_ERROR
    IFS= read -r RW_ERROR
  } <<EOF
$RESOLVED_FIELDS
EOF
  unset RESOLVED_FIELDS RESOLVED_JSON

  if [ "$RAILWAY_STATE" = "unresolved" ] || [ -z "${RW_WEB:-}" ]; then
    # Linked, but Railway cannot tell us which service to run as. Do NOT guess
    # and do NOT fall back to .env: start the host unconfigured so the exact
    # error is shown in the app instead of a dead window or a wrong database.
    export DATABASE_URL=""
    start_host_without_railway \
      "Railway: ${RW_ERROR:-could not resolve the web service}" \
      "error" "railway-error" "none" ""
  fi

  if [ -n "${RW_DRYRUN_ERROR:-}" ]; then
    export DATABASE_URL=""
    start_host_without_railway \
      "Railway: railway run --service \"$RW_WEB\" --environment \"$RW_ENV\" failed: $RW_DRYRUN_ERROR" \
      "error" "railway-error" "none" ""
  fi

  export VIAFIDEI_CONFIG_SOURCE="railway"
  export VIAFIDEI_RAILWAY_WEB_SERVICE="$RW_WEB"
  export VIAFIDEI_RAILWAY_POSTGRES_SERVICE="${RW_PG:-}"
  export VIAFIDEI_RAILWAY_ENV="$RW_ENV"
  export VIAFIDEI_HOST_CONNECTION_LIMIT="$HOST_CONNECTION_LIMIT"
  if [ -n "${RW_PUBLIC_URL:-}" ]; then
    # Kept only in this process's environment; never printed or written.
    export VIAFIDEI_DB_PUBLIC_URL="$RW_PUBLIC_URL"
  fi
  unset RW_PUBLIC_URL

  # Re-evaluate INSIDE the injected environment: this is where Railway has
  # actually supplied the variables. The wrapper re-declares the tiny helpers
  # it needs because `bash -c` starts a fresh shell.
  exec railway run --service "$RW_WEB" --environment "$RW_ENV" -- bash -c '
    json_escape() { local s="$1"; s="${s//\\/\\\\}"; s="${s//\"/\\\"}"; s="${s//$'"'"'\n'"'"'/ }"; printf "%s" "$s"; }
    db_host_of() { local u="$1"; [ -z "$u" ] && return; u="${u#*://}"; u="${u%%\?*}"; local hp="${u%%/*}"; local dp=""; case "$u" in */*) dp="/${u#*/}";; esac; printf "%s%s" "${hp##*@}" "$dp"; }

    if [ -n "${DATABASE_URL:-}" ]; then export VIAFIDEI_DB_FROM_ENV="1"; else export VIAFIDEI_DB_FROM_ENV="0"; fi

    # A private-network hostname is unreachable from this computer. Swap in the
    # public proxy URL: the Postgres service supplies DATABASE_PUBLIC_URL when it
    # is the injected service; otherwise the launcher resolved it above.
    case "${DATABASE_URL:-}" in
      *.railway.internal*)
        if [ -n "${DATABASE_PUBLIC_URL:-}" ]; then
          export DATABASE_URL="$DATABASE_PUBLIC_URL"
          export VIAFIDEI_DB_ROUTE="railway-public-proxy (${VIAFIDEI_RAILWAY_POSTGRES_SERVICE:-linked Postgres service})"
        elif [ -n "${VIAFIDEI_DB_PUBLIC_URL:-}" ]; then
          export DATABASE_URL="$VIAFIDEI_DB_PUBLIC_URL"
          export VIAFIDEI_DB_ROUTE="railway-public-proxy (${VIAFIDEI_RAILWAY_POSTGRES_SERVICE:-Postgres})"
        else
          # Leave the internal URL in place so the host reports exactly what is
          # wrong instead of silently falling back to a local database.
          export VIAFIDEI_DB_ROUTE="railway-internal-unreachable"
        fi
        ;;
      "")
        export VIAFIDEI_DB_ROUTE="none"
        ;;
      *)
        export VIAFIDEI_DB_ROUTE="railway-service-variable"
        ;;
    esac
    unset VIAFIDEI_DB_PUBLIC_URL

    # Where published pages are verified: the web service may set
    # PUBLIC_BASE_URL explicitly; otherwise Railway names the public domain.
    # The host only guesses the canonical origin as a last resort, and never
    # for a non-production environment.
    if [ -z "${PUBLIC_BASE_URL:-}" ] && [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
      export PUBLIC_BASE_URL="https://$RAILWAY_PUBLIC_DOMAIN"
    fi
    # Injected service variables must not enlarge the supervisor pool.
    export PRISMA_CONNECTION_LIMIT="${VIAFIDEI_HOST_CONNECTION_LIMIT:-3}"

    printf "{\"viafideiLauncher\":{\"level\":\"info\",\"message\":\"%s\",\"source\":\"railway\",\"route\":\"%s\",\"environment\":\"%s\",\"service\":\"%s\",\"databaseHost\":\"%s\"}}\n" \
      "$(json_escape "configuration from Railway (${RAILWAY_ENVIRONMENT_NAME:-$VIAFIDEI_RAILWAY_ENV} / $VIAFIDEI_RAILWAY_WEB_SERVICE); db via $VIAFIDEI_DB_ROUTE")" \
      "$(json_escape "$VIAFIDEI_DB_ROUTE")" \
      "$(json_escape "${RAILWAY_ENVIRONMENT_NAME:-$VIAFIDEI_RAILWAY_ENV}")" \
      "$(json_escape "$VIAFIDEI_RAILWAY_WEB_SERVICE")" \
      "$(json_escape "$(db_host_of "${DATABASE_URL:-}")")"
    echo "[launcher] info: configuration from Railway; db via $VIAFIDEI_DB_ROUTE" >&2
    exec "$@"
  ' bash "${RUNNER[@]}" "${HOST_ARGS[@]}"
fi

# ---------------------------------------------------------------------------
# 2. No Railway link — the repository .env, but never a loopback database
# ---------------------------------------------------------------------------

if [ "$RAILWAY_STATE" = "unlinked" ]; then
  RAILWAY_NOTE="Railway CLI found but this checkout is not linked/logged in (run 'railway login' then 'railway link' in $PROJECT_DIR)."
else
  RAILWAY_NOTE="Railway CLI not installed (brew install railway)."
fi

if [ "$VIAFIDEI_DB_FROM_ENV" = "1" ]; then
  EFFECTIVE_DB_URL="${DATABASE_URL}"
  DB_ORIGIN="the environment"
else
  EFFECTIVE_DB_URL="$(dotenv_database_url)"
  DB_ORIGIN="the repository .env"
fi
EFFECTIVE_DB_HOST="$(db_host_of "$EFFECTIVE_DB_URL")"

if [ -n "$EFFECTIVE_DB_URL" ] && is_loopback_host "$(host_name_of "$EFFECTIVE_DB_URL")" \
   && [ "${VIAFIDEI_ALLOW_LOCAL_DB:-0}" != "1" ]; then
  # The trap this launcher exists to prevent: a laptop Postgres standing in for
  # production. DATABASE_URL="" keeps Prisma from loading the .env value.
  export DATABASE_URL=""
  export VIAFIDEI_DB_FROM_ENV="0"
  start_host_without_railway \
    "$RAILWAY_NOTE Refusing the LOCAL database in $DB_ORIGIN ($EFFECTIVE_DB_HOST) — production would not be updated. Set VIAFIDEI_ALLOW_LOCAL_DB=1 only for deliberate local testing." \
    "error" "blocked-local-dotenv" "blocked-local" "$EFFECTIVE_DB_HOST"
fi

if [ -z "$EFFECTIVE_DB_URL" ]; then
  start_host_without_railway \
    "$RAILWAY_NOTE No DATABASE_URL in the environment or the repository .env." \
    "error" "dotenv" "none" ""
fi

start_host_without_railway \
  "$RAILWAY_NOTE Using DATABASE_URL from $DB_ORIGIN ($EFFECTIVE_DB_HOST)." \
  "warn" "dotenv" "dotenv" "$EFFECTIVE_DB_HOST"
