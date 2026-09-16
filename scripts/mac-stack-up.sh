#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v podman >/dev/null 2>&1; then
  echo "podman is not installed or not in PATH" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.example to .env and configure it first." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source ./.env
set +a

if [[ -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_TUNNEL_TOKEN is empty in .env; refusing to start the public tunnel." >&2
  echo "Use 'podman compose up -d --build' if you intentionally want app-only mode." >&2
  exit 1
fi

podman machine start >/dev/null 2>&1 || true
podman compose --profile tunnel up -d --build

mkdir -p .runtime
PID_FILE=.runtime/caffeinate.pid
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "macOS keep-awake already active (PID $(cat "$PID_FILE"))."
else
  rm -f "$PID_FILE"
  # Keep the Mac awake while still allowing the display itself to turn off.
  # -i blocks idle system sleep; -s blocks system sleep while on AC power.
  nohup /usr/bin/caffeinate -i -s >/tmp/storage-room-app-caffeinate.log 2>&1 &
  echo $! > "$PID_FILE"
  echo "macOS keep-awake started (PID $!)."
fi

echo
echo "Storage Room App stack is running:"
podman compose --profile tunnel ps
echo
echo "The display may sleep. The Mac itself stays awake while the helper is active."
echo "Run scripts/mac-stack-down.sh to stop the containers and release keep-awake."
