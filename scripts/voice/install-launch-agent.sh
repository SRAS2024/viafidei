#!/bin/bash
# Keep the pray-along voice engine running on this Mac whenever the owner is logged
# in: a per-user LaunchAgent that starts scripts/voice/launch.sh engine at login and
# restarts it if it stops. Logs: ~/Library/Logs/ViaFidei/voice-engine.log.
#
#   scripts/voice/install-launch-agent.sh            # install (or update) and start
#   scripts/voice/install-launch-agent.sh --remove   # stop and remove
set -eu
LABEL="com.viafidei.voice-engine"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$HOME/Library/Logs/ViaFidei"

# Stops the running engine and waits until it is gone. `launchctl bootout` returns while
# a busy engine is still finishing the clip in hand; loading the label again before then
# fails ("Bootstrap failed: 5: Input/output error") and leaves no engine running at all.
stop_engine() {
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  for _ in $(seq 1 180); do
    launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || return 0
    sleep 1
  done
  echo "the voice engine did not stop within 3 minutes; try again" >&2
  return 1
}

if [ "${1:-}" = "--remove" ]; then
  stop_engine
  rm -f "$PLIST"
  echo "removed $LABEL"
  exit 0
fi

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PROJECT_DIR/scripts/voice/launch.sh</string>
    <string>engine</string>
  </array>
  <key>WorkingDirectory</key><string>$PROJECT_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>$LOG_DIR/voice-engine.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/voice-engine.log</string>
</dict>
</plist>
PLIST
stop_engine
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installed and started $LABEL (logs: $LOG_DIR/voice-engine.log)"
