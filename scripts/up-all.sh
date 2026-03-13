#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-openai}"
WEB_PID_FILE="$ROOT_DIR/.tmp/web-dev.pid"
WEB_LOG_FILE="$ROOT_DIR/.tmp/web-dev.log"

cd "$ROOT_DIR"

mkdir -p "$ROOT_DIR/.tmp"

if [[ "$MODE" == "local" ]]; then
  bash ./scripts/up-stack-web-local.sh
else
  bash ./scripts/up-stack-web.sh
fi

if [[ -f "$WEB_PID_FILE" ]]; then
  EXISTING_PID="$(cat "$WEB_PID_FILE" 2>/dev/null || true)"
  if [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" >/dev/null 2>&1; then
    EXISTING_URL="$(grep -Eo 'http://localhost:[0-9]+' "$WEB_LOG_FILE" 2>/dev/null | tail -n 1 || true)"
    echo "Web dev server already running (pid $EXISTING_PID)."
    echo "UI: ${EXISTING_URL:-http://localhost:5173}"
    exit 0
  fi
  rm -f "$WEB_PID_FILE"
fi

nohup setsid pnpm --filter @repo/web dev >"$WEB_LOG_FILE" 2>&1 &
WEB_PID=$!
echo "$WEB_PID" >"$WEB_PID_FILE"

for _ in $(seq 1 45); do
  if curl -sf "http://localhost:5173" >/dev/null 2>&1; then
    echo "Web dev server is ready at http://localhost:5173 (pid $WEB_PID)"
    echo "Logs: $WEB_LOG_FILE"
    exit 0
  fi
  WEB_URL="$(grep -Eo 'http://localhost:[0-9]+' "$WEB_LOG_FILE" 2>/dev/null | tail -n 1 || true)"
  if [[ -n "$WEB_URL" ]] && curl -sf "$WEB_URL" >/dev/null 2>&1; then
    echo "Web dev server is ready at $WEB_URL (pid $WEB_PID)"
    echo "Logs: $WEB_LOG_FILE"
    exit 0
  fi
  if ! kill -0 "$WEB_PID" >/dev/null 2>&1; then
    echo "Web dev server exited unexpectedly. Recent logs:" >&2
    tail -n 50 "$WEB_LOG_FILE" >&2 || true
    rm -f "$WEB_PID_FILE"
    exit 1
  fi
  sleep 1
done

echo "Web dev server started (pid $WEB_PID), but did not respond on http://localhost:5173 yet."
echo "Logs: $WEB_LOG_FILE"
