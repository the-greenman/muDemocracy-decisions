#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_API_PORT="${COMPOSE_API_PORT:-3001}"
API_URL="http://localhost:${COMPOSE_API_PORT}"
DEV_DATABASE_URL="${DATABASE_URL:-postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_dev}"
TEST_DATABASE_URL="postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_test"

cd "$ROOT_DIR"

docker compose up -d postgres

for _ in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U decision_logger -d decision_logger_dev >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

DATABASE_URL="$DEV_DATABASE_URL" npm run -w @repo/db db:migrate
DATABASE_URL="$TEST_DATABASE_URL" npm run -w @repo/db db:migrate

docker compose up --build -d api

for _ in $(seq 1 30); do
  if curl -sf "$API_URL/health" >/dev/null 2>&1; then
    echo "API is ready at $API_URL"
    exit 0
  fi
  sleep 1
done

echo "API did not become ready at $API_URL within the expected time" >&2
exit 1
