#!/usr/bin/env bash
set -euo pipefail

# Brave Browser CDP Launcher with Real Account Profile Sync
# Launches real Brave Browser on macOS with Chrome DevTools Protocol (CDP) enabled on port 9222
# Syncing the user's real cookies enables seamless account authentication without login barriers.

BRAVE_APP="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
USER_DATA_DIR="/tmp/brave-real-user-profile"
SOURCE_PROFILE="$HOME/Library/Application Support/BraveSoftware/Brave-Browser"
CDP_PORT="${CDP_PORT:-9222}"

if [[ ! -f "$BRAVE_APP" ]]; then
  echo "Error: Brave Browser not found at $BRAVE_APP"
  echo "Please install Brave Browser from https://brave.com or adjust the path."
  exit 1
fi

echo "🦁 Launching Brave Browser with CDP on port ${CDP_PORT}..."
mkdir -p "$USER_DATA_DIR/Default"

# Sync active session cookies, preferences, and login data
if [[ -d "$SOURCE_PROFILE/Default" ]]; then
  echo "🔄 Syncing real Brave profile cookies and sessions..."
  cp -f "$SOURCE_PROFILE/Default/Cookies" "$USER_DATA_DIR/Default/Cookies" 2>/dev/null || true
  cp -f "$SOURCE_PROFILE/Default/Preferences" "$USER_DATA_DIR/Default/Preferences" 2>/dev/null || true
  cp -f "$SOURCE_PROFILE/Default/Login Data" "$USER_DATA_DIR/Default/Login Data" 2>/dev/null || true
  cp -f "$SOURCE_PROFILE/Default/Bookmarks" "$USER_DATA_DIR/Default/Bookmarks" 2>/dev/null || true
fi

exec "$BRAVE_APP" \
  --remote-debugging-port="${CDP_PORT}" \
  --remote-debugging-address=127.0.0.1 \
  --user-data-dir="${USER_DATA_DIR}" \
  --no-first-run \
  --no-default-browser-check \
  --disable-blink-features=AutomationControlled \
  --window-size=1280,800 \
  "${1:-http://localhost:3000}"

