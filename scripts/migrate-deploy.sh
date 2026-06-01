#!/bin/sh
# Apply Prisma migrations with bounded, safe self-healing from a wedged
# database (Prisma error P3009 — a migration recorded as "failed").
#
# WHY this is normally dangerous, and why this is safe:
#   A half-applied migration can leave the schema inconsistent, so the
#   blanket advice is to resolve a failed migration by hand. We auto-recover
#   ONLY migrations explicitly certified idempotent (re-runnable) via the
#   "@idempotent-recoverable" marker in their migration.sql. For those, every
#   statement is guarded (DROP ... IF EXISTS / CREATE ... IF NOT EXISTS), so
#   `migrate resolve --rolled-back` + a single `migrate deploy` retry brings
#   the schema to the target state regardless of how far the failed attempt
#   got. A test (tests/db/idempotent-migrations.test.ts) enforces that the
#   marker cannot lie. Any failed migration WITHOUT the marker still
#   fail-fasts for manual review — the conservative default.
#
# Knobs (env):
#   PRISMA_CLI                 prisma invocation (default "npx prisma"; the
#                              web runtime passes the standalone node path).
#   MIGRATIONS_DIR             default "prisma/migrations".
#   AUTO_RESOLVE_MIGRATIONS    "1" (default) enables self-heal; "0" forces
#                              fail-fast on any wedged migration.
#
# Exit 0 = schema is migrated and ready. Non-zero = caller must NOT start.
set -u

PRISMA_CLI="${PRISMA_CLI:-npx prisma}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-prisma/migrations}"
AUTO_RESOLVE="${AUTO_RESOLVE_MIGRATIONS:-1}"
MARKER="@idempotent-recoverable"
OUT_FILE="$(mktemp 2>/dev/null || echo "/tmp/migrate-deploy.$$.out")"

log() { echo "[migrate] $*"; }
cleanup() { rm -f "$OUT_FILE" 2>/dev/null || true; }
trap cleanup EXIT

# Run `migrate deploy`, capturing output for inspection while still echoing it.
deploy() {
  $PRISMA_CLI migrate deploy >"$OUT_FILE" 2>&1
  rc=$?
  cat "$OUT_FILE"
  return $rc
}

log "applying database migrations (prisma migrate deploy)"
if deploy; then
  log "migrations OK"
  exit 0
fi

# Deploy failed. Self-heal ONLY the specific P3009 failed-migration wedge.
if ! grep -q "P3009" "$OUT_FILE"; then
  log "FATAL migrate deploy failed and it is not a P3009 wedged-migration state — refusing to continue"
  exit 1
fi
if [ "$AUTO_RESOLVE" != "1" ]; then
  log "FATAL wedged migration (P3009) detected but AUTO_RESOLVE_MIGRATIONS=$AUTO_RESOLVE — run 'prisma migrate resolve' by hand"
  exit 1
fi

# Parse the failed migration name(s) from Prisma's P3009 output, e.g.
#   The `0025_drop_legacy_system` migration started at ... failed
FAILED="$(grep -i "migration started at" "$OUT_FILE" | grep -oE '[0-9]{4}_[A-Za-z0-9_]+' | sort -u)"
if [ -z "$FAILED" ]; then
  log "FATAL P3009 reported but the failed migration name could not be parsed — manual resolve required"
  exit 1
fi

# Refuse to touch anything unless EVERY failed migration is certified idempotent.
for m in $FAILED; do
  sqlfile="$MIGRATIONS_DIR/$m/migration.sql"
  if [ ! -f "$sqlfile" ] || ! grep -q "$MARKER" "$sqlfile"; then
    log "FATAL failed migration '$m' is not certified idempotent ($MARKER) — refusing to auto-resolve; manual review required"
    exit 1
  fi
done

# Safe to self-heal: mark each rolled back, then retry deploy exactly once.
for m in $FAILED; do
  log "WARNING self-healing wedged idempotent migration '$m' — marking rolled-back so it re-applies"
  if ! $PRISMA_CLI migrate resolve --rolled-back "$m"; then
    log "FATAL could not mark '$m' rolled-back — manual resolve required"
    exit 1
  fi
done

log "retrying migrate deploy after self-heal"
if deploy; then
  log "migrations OK (self-healed wedged migration: $FAILED)"
  exit 0
fi

log "FATAL migrate deploy still failing after self-heal — manual intervention required"
exit 1
