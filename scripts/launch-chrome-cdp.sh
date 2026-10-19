#!/usr/bin/env bash
set -euo pipefail

# Launch Google Chrome with remote debugging port 9222 for live REA observation
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
USER_DATA_DIR="/tmp/chrome-real-user-profile"
PORT="${CDP_PORT:-9222}"

if [[ ! -f "$CHROME_BIN" ]]; then
  if command -v google-chrome-stable &>/dev/null; then
    CHROME_BIN="google-chrome-stable"
  elif command -v google-chrome &>/dev/null; then
    CHROME_BIN="google-chrome"
  elif command -v chromium-browser &>/dev/null; then
    CHROME_BIN="chromium-browser"
  else
    echo "Error: Google Chrome binary not found." >&2
    exit 1
  fi
fi

echo "🚀 Launching Google Chrome on CDP port ${PORT}..."
mkdir -p "$USER_DATA_DIR/Default"

# Sync cookies from real Chrome profile if present, or Brave profile
CHROME_REAL_PROFILE="$HOME/Library/Application Support/Google/Chrome/Default"
BRAVE_REAL_PROFILE="$HOME/Library/Application Support/BraveSoftware/Brave-Browser/Default"

if [[ -d "$CHROME_REAL_PROFILE" ]]; then
  cp -f "$CHROME_REAL_PROFILE/Cookies" "$USER_DATA_DIR/Default/Cookies" 2>/dev/null || true
  cp -f "$CHROME_REAL_PROFILE/Preferences" "$USER_DATA_DIR/Default/Preferences" 2>/dev/null || true
  cp -f "$CHROME_REAL_PROFILE/Login Data" "$USER_DATA_DIR/Default/Login Data" 2>/dev/null || true
elif [[ -d "$BRAVE_REAL_PROFILE" ]]; then
  cp -f "$BRAVE_REAL_PROFILE/Cookies" "$USER_DATA_DIR/Default/Cookies" 2>/dev/null || true
  cp -f "$BRAVE_REAL_PROFILE/Preferences" "$USER_DATA_DIR/Default/Preferences" 2>/dev/null || true
  cp -f "$BRAVE_REAL_PROFILE/Login Data" "$USER_DATA_DIR/Default/Login Data" 2>/dev/null || true
fi

exec "$CHROME_BIN" \
  --headless=new \
  --remote-debugging-port="${PORT}" \
  --remote-debugging-address=127.0.0.1 \
  --user-data-dir="$USER_DATA_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-networking \
  --disable-sync \
  --disable-gpu \
  --disable-blink-features=AutomationControlled \
  --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" \
  --window-size=1280,800 \
  "${1:-about:blank}"
