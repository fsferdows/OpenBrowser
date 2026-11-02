#!/usr/bin/env bash
set -euo pipefail

# Launch Obscura Native Headless Stealth CDP Server
PORT="${CDP_PORT:-9222}"
HOST="${CDP_HOST:-127.0.0.1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

OBSCURA_BIN=""

if [[ -f "$ROOT_DIR/bin/obscura" && -x "$ROOT_DIR/bin/obscura" ]]; then
  OBSCURA_BIN="$ROOT_DIR/bin/obscura"
elif command -v obscura &>/dev/null; then
  OBSCURA_BIN="$(command -v obscura)"
elif [[ -f "/tmp/obscura_bin/obscura" && -x "/tmp/obscura_bin/obscura" ]]; then
  OBSCURA_BIN="/tmp/obscura_bin/obscura"
elif [[ -f "$ROOT_DIR/vendor/obscura/target/release/obscura" && -x "$ROOT_DIR/vendor/obscura/target/release/obscura" ]]; then
  OBSCURA_BIN="$ROOT_DIR/vendor/obscura/target/release/obscura"
fi

if [[ -z "$OBSCURA_BIN" ]]; then
  echo "📥 Downloading native Obscura release binary..."
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH="$(uname -m)"
  case "$ARCH" in
    arm64|aarch64) ARCH_TAG="aarch64" ;;
    x86_64|amd64) ARCH_TAG="x86_64" ;;
    *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
  esac

  TAR_NAME="obscura-${ARCH_TAG}-${OS}-stealth.tar.gz"
  DOWNLOAD_URL="https://github.com/h4ckf0r0day/obscura/releases/download/v0.2.6/${TAR_NAME}"
  
  mkdir -p "$ROOT_DIR/bin"
  if curl -sL "$DOWNLOAD_URL" -o "$ROOT_DIR/bin/${TAR_NAME}"; then
    tar -xzf "$ROOT_DIR/bin/${TAR_NAME}" -C "$ROOT_DIR/bin/"
    rm -f "$ROOT_DIR/bin/${TAR_NAME}"
    chmod +x "$ROOT_DIR/bin/obscura" "$ROOT_DIR/bin/obscura-worker" 2>/dev/null || true
    OBSCURA_BIN="$ROOT_DIR/bin/obscura"
  else
    echo "Error: Failed to download Obscura binary from $DOWNLOAD_URL" >&2
    exit 1
  fi
fi

echo "⚡ Launching Obscura Native Headless Stealth Engine on CDP port ${PORT}..."
exec "$OBSCURA_BIN" serve \
  --port "${PORT}" \
  --host "${HOST}" \
  --stealth \
  --allow-private-network

