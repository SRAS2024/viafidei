#!/bin/sh
# Serve the production build the way production actually serves it.
#
# next.config.js sets `output: "standalone"`, and `next start` refuses to serve
# that build — it prints
#
#   "next start" does not work with "output: standalone" configuration.
#   Use "node .next/standalone/server.js" instead.
#
# and then serves an app with no HTML, so every Playwright smoke test failed
# looking for a <header>. The e2e job had been red for this reason alone.
#
# The standalone output is deliberately minimal: Next traces the server's own
# dependencies into .next/standalone but leaves the static assets and public
# files behind, because a container copies them in separately (see the
# Dockerfile's COPY lines for ./public and ./.next/static). This script does
# the same two copies locally, then execs the standalone server — so the e2e
# suite exercises the same server production runs, not a different one.
#
# PORT and HOSTNAME are read by the standalone server itself.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STANDALONE="$ROOT/.next/standalone"

if [ ! -f "$STANDALONE/server.js" ]; then
  echo "start-standalone: $STANDALONE/server.js is missing — run 'npm run build' first." >&2
  exit 1
fi

# Mirror the Dockerfile: public/ and .next/static live beside the traced server.
[ -d "$ROOT/public" ] && mkdir -p "$STANDALONE/public" && cp -R "$ROOT/public/." "$STANDALONE/public/"
mkdir -p "$STANDALONE/.next/static"
cp -R "$ROOT/.next/static/." "$STANDALONE/.next/static/"

cd "$STANDALONE"
exec node server.js
