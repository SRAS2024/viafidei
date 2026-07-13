#!/bin/bash
# Build "Via Fidei.app" — the macOS developer app: a native WKWebView window
# onto the live deployed site (https://etviafidei.com) with a Standard/Admin
# toggle. Runs no server and holds no state, so it always reflects whatever is
# currently deployed. Requires the Xcode Command Line Tools (swiftc) and, for
# the icon, the repo's public/icon-512.png.
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

# 1. Compile the Swift WebView program.
swiftc "$SCRIPT_DIR/main.swift" -o "$BUILD/ViaFidei" -framework Cocoa -framework WebKit

# 2. Build the .icns from the crucifix logo.
ICONSET="$BUILD/ViaFidei.iconset"; mkdir -p "$ICONSET"
SRC="$PROJECT_DIR/public/icon-512.png"
for sz in 16 32 128 256 512; do
  sips -z $sz $sz "$SRC" --out "$ICONSET/icon_${sz}x${sz}.png" >/dev/null 2>&1 || true
  d=$((sz*2)); sips -z $d $d "$SRC" --out "$ICONSET/icon_${sz}x${sz}@2x.png" >/dev/null 2>&1 || true
done
iconutil -c icns "$ICONSET" -o "$BUILD/AppIcon.icns" 2>/dev/null || true

# 3. Assemble the bundle.
rm -rf "$APP"
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
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

# 4. Clear quarantine + ad-hoc sign so it launches without Gatekeeper friction.
xattr -cr "$APP" 2>/dev/null || true
codesign --force --deep --sign - "$APP" 2>/dev/null || true

rm -rf "$BUILD"
echo "Done. Open with:  open \"$APP\""
