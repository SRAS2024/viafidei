#!/bin/bash
# Build "Via Fidei.app" — the macOS application that is BOTH a window onto the
# live deployed site (https://etviafidei.com) AND the Admin Worker's command
# center and power switch.
#
# The Admin Worker executes on THIS Mac: when the green pill is switched ON the
# app launches and supervises scripts/local-worker-host.ts from this repository
# (worker body, Python brain, source acquisition, browser rendering, publishing,
# security), talks to it over 127.0.0.1 with a per-launch token, and shows the
# full command center. The repository path is baked into the bundle below so the
# app knows what to launch; it can be changed later from the app's Admin Worker
# menu. No credentials are stored in the app — the worker reads this
# repository's existing configuration itself.
#
# Requires the Xcode Command Line Tools (swiftc), Node (for the worker runtime)
# and, for the icon, the repo's public/icon-512.png.
#
# Usage:  bash scripts/desktop-app/build.sh [output-dir]
#         (default output-dir = ~/Desktop)
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUT_DIR="${1:-$HOME/Desktop}"
APP="$OUT_DIR/Via Fidei.app"
BUILD="$(mktemp -d)"

echo "Building Via Fidei.app -> $APP"

# 1. Compile the Swift program as a UNIVERSAL binary (arm64 + x86_64) so the
#    built app runs on any Mac it is copied to, not only on the machine that
#    built it. Falls back to a native-only build if a cross-compile is
#    unavailable (older Command Line Tools / missing SDK slice).
FRAMEWORKS="-framework Cocoa -framework WebKit"
if swiftc -target arm64-apple-macos12 "$SCRIPT_DIR/main.swift" -o "$BUILD/ViaFidei-arm64" $FRAMEWORKS 2>/dev/null \
  && swiftc -target x86_64-apple-macos12 "$SCRIPT_DIR/main.swift" -o "$BUILD/ViaFidei-x86_64" $FRAMEWORKS 2>/dev/null \
  && lipo -create "$BUILD/ViaFidei-arm64" "$BUILD/ViaFidei-x86_64" -output "$BUILD/ViaFidei" 2>/dev/null; then
  echo "Compiled universal binary (arm64 + x86_64)."
else
  echo "Universal build unavailable; compiling for this machine only."
  swiftc "$SCRIPT_DIR/main.swift" -o "$BUILD/ViaFidei" $FRAMEWORKS
fi

# 2. Build the .icns from the crucifix logo.
ICONSET="$BUILD/ViaFidei.iconset"; mkdir -p "$ICONSET"
SRC="$PROJECT_DIR/public/icon-512.png"
for sz in 16 32 128 256 512; do
  sips -z $sz $sz "$SRC" --out "$ICONSET/icon_${sz}x${sz}.png" >/dev/null 2>&1 || true
  d=$((sz*2)); sips -z $d $d "$SRC" --out "$ICONSET/icon_${sz}x${sz}@2x.png" >/dev/null 2>&1 || true
done
iconutil -c icns "$ICONSET" -o "$BUILD/AppIcon.icns" 2>/dev/null || true

# 3. Assemble the bundle.
#
# macOS "App Management" (Ventura+) blocks a process from replacing an app
# bundle it did not install unless that process has been granted App
# Management permission, and a RUNNING app cannot be replaced safely at all.
# Handle both cases with a clear message instead of a bare "Operation not
# permitted" from rm.
if [ -d "$APP" ]; then
  if pgrep -f "$APP/Contents/MacOS/ViaFidei" >/dev/null 2>&1; then
    echo "Via Fidei.app is running — quitting it before replacing the bundle."
    osascript -e 'tell application "Via Fidei" to quit' >/dev/null 2>&1 || true
    sleep 2
    pkill -f "$APP/Contents/MacOS/ViaFidei" >/dev/null 2>&1 || true
    sleep 1
  fi
  if ! rm -rf "$APP" 2>/dev/null; then
    echo "ERROR: cannot replace the existing bundle at:"
    echo "         $APP"
    echo
    echo "macOS is protecting it (App Management). Fix it in ONE of these ways:"
    echo "  1. Run this script from Terminal.app and approve the permission prompt, or"
    echo "     enable your terminal under System Settings > Privacy & Security >"
    echo "     App Management, then run it again."
    echo "  2. Move the old \"Via Fidei.app\" to the Trash in Finder, then run this again."
    echo "  3. Build somewhere writable and swap it in Finder:"
    echo "       bash scripts/desktop-app/build.sh \"\$HOME/Downloads\""
    exit 1
  fi
fi
# Assemble in the staging directory (a mktemp -d under /var/folders, which
# nothing syncs), never in the destination — see the signing step below.
STAGED="$BUILD/staged/Via Fidei.app"
rm -rf "$STAGED"
mkdir -p "$STAGED/Contents/MacOS" "$STAGED/Contents/Resources"
cp "$BUILD/ViaFidei" "$STAGED/Contents/MacOS/ViaFidei"; chmod +x "$STAGED/Contents/MacOS/ViaFidei"
[ -f "$BUILD/AppIcon.icns" ] && cp "$BUILD/AppIcon.icns" "$STAGED/Contents/Resources/AppIcon.icns"
cat > "$STAGED/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Via Fidei</string>
  <key>CFBundleDisplayName</key><string>Via Fidei</string>
  <key>CFBundleIdentifier</key><string>com.viafidei.devapp</string>
  <key>CFBundleExecutable</key><string>ViaFidei</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.reference</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <!-- Where the Admin Worker runtime lives. The app launches
       scripts/local-worker-host.ts from here; override at runtime from the
       app's "Admin Worker → Choose Repository Folder…" menu item. -->
  <key>ViaFideiRepoPath</key><string>$PROJECT_DIR</string>
  <!-- The command center is served by the local worker runtime on 127.0.0.1;
       loopback HTTP has to be allowed for the WKWebView to load it. Nothing
       is exposed to the network. -->
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key><true/>
  </dict>
</dict>
</plist>
PLIST

# 4. Sign in the STAGING directory, then move the finished bundle into place.
#
# Signing must not happen in the destination when the destination is an
# iCloud-synced folder such as ~/Desktop. codesign refuses to sign anything
# carrying Finder information ("resource fork, Finder information, or similar
# detritus not allowed"), and iCloud re-adds com.apple.FinderInfo within
# milliseconds — so signing there fails, and because the failure was previously
# swallowed the app was installed UNSIGNED (linker-signed, Sealed Resources=none).
#
# The staging directory is a mktemp -d under /var/folders, which nothing syncs.
# A signature lives inside the bundle, so moving it afterwards preserves it.
#
# --identifier pins the code identifier to the bundle id; without it the merged
# universal binary inherits the lipo input filename (e.g. "ViaFidei-arm64"),
# which no longer matches the bundle the WebKit data store is keyed on.
xattr -cr "$STAGED" 2>/dev/null || true
if SIGN_OUT="$(codesign --force --sign - --identifier com.viafidei.devapp "$STAGED" 2>&1)"; then
  :
else
  echo "WARNING: codesign failed: $SIGN_OUT"
fi

if codesign --verify --strict "$STAGED" >/dev/null 2>&1; then
  echo "Signed (ad-hoc) and verified in staging."
else
  echo "WARNING: the staged bundle did not verify; it will be installed unsigned."
  [ -n "${SIGN_OUT:-}" ] && echo "         codesign said: $SIGN_OUT"
fi

# Move into place. ditto preserves the bundle's metadata and signature.
rm -rf "$APP"
mkdir -p "$OUT_DIR"
ditto "$STAGED" "$APP"

# Clear the quarantine flag so it opens without a Gatekeeper prompt, then report
# the state at the DESTINATION. On a synced folder the sealed signature survives
# but a later-added FinderInfo can still fail --strict; that is a different (and
# much less serious) condition than being unsigned, so distinguish them.
xattr -cr "$APP" 2>/dev/null || true
if codesign --verify --strict "$APP" >/dev/null 2>&1; then
  echo "Installed bundle verified."
elif codesign -dv "$APP" 2>&1 | grep -q "Sealed Resources version"; then
  echo "Installed bundle is signed; strict verification is blocked by folder metadata"
  echo "(iCloud re-adds com.apple.FinderInfo). The app is signed and will launch."
else
  echo "WARNING: the installed bundle is NOT signed."
fi

# 5. Sanity check: the app can only run the Admin Worker if the repository it
#    was built from still has its dependencies installed.
if [ ! -x "$PROJECT_DIR/node_modules/.bin/tsx" ]; then
  echo "NOTE: $PROJECT_DIR/node_modules/.bin/tsx is missing."
  echo "      Run 'npm install' in the repository so the app can start the local Admin Worker."
fi

echo "Done. Open with:  open \"$APP\""
echo "Admin Worker repository: $PROJECT_DIR"
