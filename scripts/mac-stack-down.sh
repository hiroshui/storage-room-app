#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

podman compose --profile tunnel down || true

PID_FILE=.runtime/caffeinate.pid
if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" || true
    echo "Stopped macOS keep-awake (PID $PID)."
  fi
  rm -f "$PID_FILE"
fi
