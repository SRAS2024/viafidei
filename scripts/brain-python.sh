#!/bin/sh
# Resolve a Python >= 3.10 and exec it with whatever arguments follow.
#
# Why this exists: the `npm run brain:*` scripts used to call `python3`
# directly, and on a stock Mac `python3` is Apple's 3.9 from the Command Line
# Tools. The intelligence package needs 3.10+ (`@dataclass(slots=True)`,
# `match`), so 3.9 fails at import and every documented brain command dies
# with a wall of ImportErrors that looks like a broken test suite rather than
# a wrong interpreter.
#
# The worker itself already resolves the interpreter in
# src/lib/admin-worker/intelligence/client.ts (PYTHON_CANDIDATES). This is the
# shell mirror of that list so the npm scripts and the worker agree; keep the
# two in sync when either changes.
#
# INTELLIGENCE_PYTHON overrides everything, exactly as it does for the worker.
set -eu

VERSION_CHECK='import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'

usable() {
  [ -n "$1" ] || return 1
  command -v "$1" >/dev/null 2>&1 || return 1
  "$1" -c "$VERSION_CHECK" >/dev/null 2>&1
}

if [ -n "${INTELLIGENCE_PYTHON:-}" ]; then
  if usable "$INTELLIGENCE_PYTHON"; then
    exec "$INTELLIGENCE_PYTHON" "$@"
  fi
  echo "brain-python: INTELLIGENCE_PYTHON='$INTELLIGENCE_PYTHON' is not a usable Python >= 3.10" >&2
  exit 1
fi

for candidate in \
  /opt/homebrew/opt/python@3.11/bin/python3.11 \
  /opt/homebrew/opt/python@3.12/bin/python3.12 \
  /opt/homebrew/bin/python3 \
  python3.12 \
  python3.11 \
  python3; do
  if usable "$candidate"; then
    exec "$candidate" "$@"
  fi
done

echo "brain-python: no Python >= 3.10 found. Install one (brew install python@3.11) or set INTELLIGENCE_PYTHON." >&2
exit 1
