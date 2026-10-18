#!/usr/bin/env bash
set -euo pipefail

# Brave Browser CDP Launcher
# Launches real Brave Browser on macOS with Chrome DevTools Protocol (CDP) enabled on port 9222
# Using an isolated profile prevents conflicts with an existing running Brave instance.

BRAVE_APP="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
USER_DATA_DIR="/tmp/brave-cdp-agent-profile"
CDP_PORT=9222

if [[ ! -f "$BRAVE_APP" ]]; then
  echo "Error: Brave Browser not found at $BRAVE_APP"
  echo "Please install Brave Browser from https://brave.com or adjust the path."
  exit 1
fi

echo "🦁 Launching Brave Browser with CDP on port ${CDP_PORT}..."
echo "   Profile: ${USER_DATA_DIR}"
echo "   Endpoint: http://127.0.0.1:${CDP_PORT}/json/version"

mkdir -p "$USER_DATA_DIR"

exec "$BRAVE_APP" \
  --remote-debugging-port="${CDP_PORT}" \
  --user-data-dir="${USER_DATA_DIR}" \
  --no-first-run \
  --no-default-browser-check \
  "http://localhost:3000"
