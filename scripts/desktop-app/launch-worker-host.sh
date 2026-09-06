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
# host starts, `railway-public-db-url.mjs` asks the linked project's Postgres
# service for its DATABASE_PUBLIC_URL (the `*.proxy.rlwy.net` TCP proxy Railway
# provides for exactly this) and the launcher swaps it in — in memory only.
#
# Precedence is what makes this safe, and it is verified behaviour, not an
# assumption: @prisma/client loads .env itself, but it does NOT overwrite a
# variable that is already present in the environment. So injected Railway
# values win, and a local .env is only the fallback.
#
# Order:
#   1. Variables already in the environment  (whoever launched us set them)
#   2. `railway run` + the public Postgres URL (CLI installed AND project linked)
#   3. the repository .env                   (loaded by Prisma itself)
#   4. nothing — the host still starts and reports the problem in the app
#
# The host ALWAYS starts, even unconfigured: the app needs a control surface to
# display the error. Failing silently here would leave a dead window.
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

if [ -x "$PROJECT_DIR/node_modules/.bin/tsx" ]; then
  RUNNER=("$PROJECT_DIR/node_modules/.bin/tsx")
else
  RUNNER=(npx --yes tsx)
fi

# `railway status` exits non-zero when the CLI is not logged in or the directory
# is not linked, which is exactly the condition for falling back.
if command -v railway >/dev/null 2>&1 && railway status >/dev/null 2>&1; then
  echo "[launcher] configuration source: Railway (linked project)" >&2
  export VIAFIDEI_CONFIG_SOURCE="railway"

  # Resolve the PUBLIC Postgres URL up front (see the header). Kept only in this
  # process's environment; the value is never printed or written anywhere.
  if PUBLIC_DB_URL="$(node "$SCRIPT_DIR/railway-public-db-url.mjs" 2>>"${VIAFIDEI_LAUNCHER_LOG:-/dev/stderr}")" \
     && [ -n "$PUBLIC_DB_URL" ]; then
    export VIAFIDEI_DB_PUBLIC_URL="$PUBLIC_DB_URL"
    echo "[launcher] resolved the public Postgres URL from the Railway project" >&2
  else
    echo "[launcher] WARNING: could not resolve DATABASE_PUBLIC_URL from the Railway project;" >&2
    echo "[launcher]          the linked service's DATABASE_URL will be used as-is" >&2
  fi
  unset PUBLIC_DB_URL

  # Re-evaluate INSIDE the injected environment: this is where Railway has
  # actually supplied the variables.
  exec railway run -- bash -c '
    if [ -n "${DATABASE_URL:-}" ]; then export VIAFIDEI_DB_FROM_ENV="1"; else export VIAFIDEI_DB_FROM_ENV="0"; fi

    # A private-network hostname is unreachable from this computer. Swap in the
    # public proxy URL: the Postgres service supplies DATABASE_PUBLIC_URL when it
    # is the linked service; otherwise the launcher resolved it above.
    case "${DATABASE_URL:-}" in
      *.railway.internal*)
        if [ -n "${DATABASE_PUBLIC_URL:-}" ]; then
          export DATABASE_URL="$DATABASE_PUBLIC_URL"
          export VIAFIDEI_DB_ROUTE="railway-public-proxy (linked Postgres service)"
        elif [ -n "${VIAFIDEI_DB_PUBLIC_URL:-}" ]; then
          export DATABASE_URL="$VIAFIDEI_DB_PUBLIC_URL"
          export VIAFIDEI_DB_ROUTE="railway-public-proxy"
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
    exec "$@"
  ' bash "${RUNNER[@]}" "${HOST_ARGS[@]}"
fi

if command -v railway >/dev/null 2>&1; then
  echo "[launcher] Railway CLI found but this checkout is not linked/logged in;" >&2
  echo "[launcher] falling back to the repository .env. Run 'railway login' then" >&2
  echo "[launcher] 'railway link' in $PROJECT_DIR to source configuration from Railway." >&2
else
  echo "[launcher] Railway CLI not installed (brew install railway); using the repository .env." >&2
fi
export VIAFIDEI_CONFIG_SOURCE="dotenv"
export VIAFIDEI_DB_ROUTE="dotenv"
exec "${RUNNER[@]}" "${HOST_ARGS[@]}"
