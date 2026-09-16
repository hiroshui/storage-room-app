#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

podman compose --profile tunnel ps

PID_FILE=.runtime/caffeinate.pid
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "macOS keep-awake: active (PID $(cat "$PID_FILE"))"
else
  echo "macOS keep-awake: inactive"
fi
