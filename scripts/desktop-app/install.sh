#!/bin/bash
# Install / update "Via Fidei.app" on THIS computer, leaving exactly one copy.
#
# The app is both a window onto the live site and the Admin Worker's command
# center: it launches and supervises the worker on this machine (see
# scripts/local-worker-host.ts). This script is the whole install step —
#
#   1. quit any running instance (a running bundle cannot be replaced safely),
#   2. remove every other Via Fidei*.app copy in the usual locations, so an old
#      or stray bundle can never be launched by mistake,
#   3. build a fresh universal bundle from this checkout,
#   4. verify what it installed and say so.
#
# macOS "App Management" (Ventura and later) stops one program from replacing
# another program's bundle. Run this from Terminal.app and approve the prompt —
# or enable your terminal under System Settings > Privacy & Security >
# App Management (then quit and reopen the terminal, since the grant only
# applies to a freshly launched process).
#
# Usage:  bash scripts/desktop-app/install.sh [install-dir]
#         (default install-dir = ~/Desktop)
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEST_DIR="${1:-$HOME/Desktop}"
DEST="$DEST_DIR/Via Fidei.app"

# Every place a copy could plausibly be sitting, so "one app" really means one.
SEARCH_DIRS=("$HOME/Desktop" "$HOME/Downloads" "$HOME/Applications" "/Applications" "$HOME/Documents")

echo "Installing Via Fidei.app -> $DEST"
echo "Admin Worker repository: $PROJECT_DIR"
echo

# 1. Quit anything running from any copy: replacing a live bundle silently
#    leaves the operator looking at the old code.
if pgrep -x ViaFidei >/dev/null 2>&1; then
  echo "- quitting the running Via Fidei app"
  osascript -e 'tell application "Via Fidei" to quit' >/dev/null 2>&1 || true
  sleep 2
  pkill -x ViaFidei >/dev/null 2>&1 || true
  sleep 1
fi
# A local worker runtime supervised by that app should go with it.
pkill -f "scripts/local-worker-host.ts" >/dev/null 2>&1 || true

# 2. Remove every existing copy, including the one we are about to replace.
#
# Both a glob AND an explicit name list: macOS privacy controls can forbid
# *listing* ~/Desktop while still allowing a direct path check, in which case a
# glob silently finds nothing and a stale bundle would survive.
KNOWN_NAMES=("Via Fidei.app" "Via Fidei (new).app" "Via Fidei copy.app" "ViaFidei.app")
candidates=()
for dir in "${SEARCH_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  for name in "${KNOWN_NAMES[@]}"; do
    [ -d "$dir/$name" ] && candidates+=("$dir/$name")
  done
  for candidate in "$dir"/*.app; do
    [ -d "$candidate" ] || continue
    case "$(basename "$candidate")" in
      *"Via Fidei"*|*ViaFidei*) candidates+=("$candidate") ;;
    esac
  done
done

blocked=0
removed=0
seen=""
for candidate in ${candidates+"${candidates[@]}"}; do
  case "$seen" in *"|$candidate|"*) continue ;; esac
  seen="$seen|$candidate|"
  if rm -rf "$candidate" 2>/dev/null && [ ! -d "$candidate" ]; then
    echo "- removed $candidate"
    removed=$((removed + 1))
  else
    echo "- COULD NOT REMOVE $candidate"
    blocked=1
  fi
done
[ "$removed" -eq 0 ] && [ "$blocked" -eq 0 ] && echo "- no existing copy found"

if [ "$blocked" -eq 1 ]; then
  cat <<'MSG'

ERROR: macOS would not let this process remove an existing app bundle.

That is App Management protection, not a bug in this script. Do ONE of:
  1. Run this script from Terminal.app and approve the prompt. If you already
     granted it, QUIT AND REOPEN the terminal first — the grant only applies to
     a newly launched process.
  2. System Settings > Privacy & Security > App Management, enable your
     terminal, reopen it, and run this again.
  3. Drag the old bundles to the Trash in Finder, then run this again.
MSG
  exit 1
fi

# 3. Build fresh from this checkout.
echo "- building a universal bundle from $PROJECT_DIR"
bash "$SCRIPT_DIR/build.sh" "$DEST_DIR"

# 4. Verify, and prove there is exactly one copy.
echo
echo "Verifying:"
BIN="$DEST/Contents/MacOS/ViaFidei"
[ -x "$BIN" ] || { echo "  FAILED: no executable at $BIN"; exit 1; }
echo "  architectures : $(lipo -info "$BIN" | sed 's/.*are: //;s/.*architecture: //')"
echo "  repository    : $(/usr/libexec/PlistBuddy -c 'Print :ViaFideiRepoPath' "$DEST/Contents/Info.plist" 2>/dev/null || echo '(unset)')"
echo "  loopback ok   : $(/usr/libexec/PlistBuddy -c 'Print :NSAppTransportSecurity:NSAllowsLocalNetworking' "$DEST/Contents/Info.plist" 2>/dev/null || echo '(unset)')"
echo "  local runtime : $(strings "$BIN" | grep -c viafideiLocalHost) marker(s)"
codesign -v --verify "$DEST" >/dev/null 2>&1 && echo "  signature     : valid" || echo "  signature     : UNVERIFIED"

# 4a. Sweep conflict copies created DURING this run.
#
# The Desktop on this Mac syncs to iCloud Drive. Deleting a bundle and
# recreating it seconds later reads to iCloud as a conflict, and it restores
# the version it had under a numbered name — "Via Fidei 2.app" beside the real
# one. Both carry the same CFBundleIdentifier, so macOS may launch either, and
# the operator ends up running an old build while this script reports success.
# (The same mechanism produces the "cache-life.d 2.ts" files that appear in
# .next/types and break `tsc`.)
#
# The pre-build removal above cannot catch these: they appear AFTER it, as a
# consequence of it. So sweep again now, matching only the numbered-copy
# shapes, and never the bundle we just installed.
for dir in "${SEARCH_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  for candidate in "$dir"/*.app; do
    [ -d "$candidate" ] || continue
    [ "$candidate" = "$DEST" ] && continue
    case "$(basename "$candidate")" in
      "Via Fidei "[0-9]*.app | "ViaFidei "[0-9]*.app | *"Via Fidei"*" copy"*.app)
        if rm -rf "$candidate" 2>/dev/null && [ ! -d "$candidate" ]; then
          echo "  removed copy  : $candidate (iCloud conflict duplicate)"
        else
          echo "  COULD NOT REMOVE duplicate: $candidate — drag it to the Trash"
        fi
        ;;
    esac
  done
done

count=0
seen=""
for dir in "${SEARCH_DIRS[@]}"; do
  [ -d "$dir" ] || continue
  for name in "${KNOWN_NAMES[@]}"; do
    [ -d "$dir/$name" ] || continue
    case "$seen" in *"|$dir/$name|"*) continue ;; esac
    seen="$seen|$dir/$name|"
    count=$((count + 1))
    echo "  installed at  : $dir/$name"
  done
  for candidate in "$dir"/*.app; do
    [ -d "$candidate" ] || continue
    case "$(basename "$candidate")" in
      *"Via Fidei"*|*ViaFidei*) ;;
      *) continue ;;
    esac
    case "$seen" in *"|$candidate|"*) continue ;; esac
    seen="$seen|$candidate|"
    count=$((count + 1))
    echo "  installed at  : $candidate"
  done
done
echo "  total copies  : $count"
[ "$count" -eq 1 ] || { echo "  FAILED: expected exactly one copy"; exit 1; }

# The one capability a laptop does not get for free. Report, never assume.
if [ ! -d "$HOME/Library/Caches/ms-playwright" ] && [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
  echo
  echo "NOTE: no headless browser found. Run 'npx playwright install chromium' in"
  echo "      $PROJECT_DIR so the worker can read JavaScript-only sources."
fi

echo
echo "Done. Open with:  open \"$DEST\""
