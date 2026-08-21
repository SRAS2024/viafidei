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
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BUILD/ViaFidei" "$APP/Contents/MacOS/ViaFidei"; chmod +x "$APP/Contents/MacOS/ViaFidei"
[ -f "$BUILD/AppIcon.icns" ] && cp "$BUILD/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
cat > "$APP/Contents/Info.plist" <<PLIST
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

# 4. Clear quarantine + ad-hoc sign so it launches without Gatekeeper friction.
xattr -cr "$APP" 2>/dev/null || true
codesign --force --deep --sign - "$APP" 2>/dev/null || true

rm -rf "$BUILD"

# 5. Sanity check: the app can only run the Admin Worker if the repository it
#    was built from still has its dependencies installed.
if [ ! -x "$PROJECT_DIR/node_modules/.bin/tsx" ]; then
  echo "NOTE: $PROJECT_DIR/node_modules/.bin/tsx is missing."
  echo "      Run 'npm install' in the repository so the app can start the local Admin Worker."
fi

echo "Done. Open with:  open \"$APP\""
echo "Admin Worker repository: $PROJECT_DIR"
