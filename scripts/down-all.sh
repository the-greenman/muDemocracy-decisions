#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_PID_FILE="$ROOT_DIR/.tmp/web-dev.pid"

cd "$ROOT_DIR"

cleanup_leftover_web_processes() {
  local pattern
  for pattern in "pnpm --filter @repo/web dev" "@repo/web@1.0.0 dev" "/vite/bin/vite.js"; do
    while pgrep -af "$pattern" >/dev/null 2>&1; do
      pkill -f "$pattern" >/dev/null 2>&1 || true
      sleep 1
    done
  done
}

if [[ -f "$WEB_PID_FILE" ]]; then
  WEB_PID="$(cat "$WEB_PID_FILE" 2>/dev/null || true)"
  if [[ -n "$WEB_PID" ]] && kill -0 "$WEB_PID" >/dev/null 2>&1; then
    WEB_PGID="$(ps -o pgid= -p "$WEB_PID" 2>/dev/null | tr -d '[:space:]' || true)"
    if [[ -n "$WEB_PGID" ]]; then
      kill -- -"$WEB_PGID" >/dev/null 2>&1 || true
    else
      kill "$WEB_PID" >/dev/null 2>&1 || true
    fi
    for _ in $(seq 1 10); do
      if ! kill -0 "$WEB_PID" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done
    if kill -0 "$WEB_PID" >/dev/null 2>&1; then
      if [[ -n "${WEB_PGID:-}" ]]; then
        kill -9 -- -"$WEB_PGID" >/dev/null 2>&1 || true
      else
        kill -9 "$WEB_PID" >/dev/null 2>&1 || true
      fi
    fi
    echo "Stopped web dev server (pid $WEB_PID)."
  fi
  rm -f "$WEB_PID_FILE"
fi

cleanup_leftover_web_processes

bash ./scripts/down-stack.sh
