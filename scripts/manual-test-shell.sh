#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_DATABASE_URL="postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_dev"
DATABASE_URL="${DATABASE_URL:-$DEFAULT_DATABASE_URL}"

choose_compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi

  echo "Docker Compose is required but was not found." >&2
  exit 1
}

wait_for_postgres() {
  local max_attempts=30
  local attempt=1

  while [ "$attempt" -le "$max_attempts" ]; do
    if docker inspect -f '{{.State.Health.Status}}' decision-logger-db 2>/dev/null | grep -q '^healthy$'; then
      return
    fi

    sleep 1
    attempt=$((attempt + 1))
  done

  echo "Postgres container did not become healthy in time." >&2
  exit 1
}

build_workspace() {
  (
    cd "$ROOT_DIR"
    npm run build -w @repo/schema
    npm run build -w @repo/db
    npm run build -w @repo/core
    npm run build -w decision-logger
    npm run build -w @repo/api
  )
}

run_db_migrations() {
  (
    cd "$ROOT_DIR"
    DATABASE_URL="$DATABASE_URL" npm exec -w @repo/db tsx scripts/migrate.ts
  )
}

print_ready_banner() {
  cat <<EOF
Manual test shell is ready.

Environment:
  ROOT_DIR=$ROOT_DIR
  DATABASE_URL=$DATABASE_URL

Available commands:
  decision-logger meeting create "Test Meeting" --date 2026-02-27 --participants Alice,Bob
  decision-logger meeting list
  decision-logger transcript add --meeting-id <meeting-id> --speaker Alice --text "We should ship this."
  decision-logger-api

Notes:
  - 'decision-logger' runs the built CLI from apps/cli/dist/index.js
  - 'decision-logger-api' starts the built API server in the current shell
  - Checked-in SQL migrations are applied automatically during bootstrap
  - Use Ctrl+C to stop the API server when running it in the foreground
EOF
}

write_rcfile() {
  local rcfile="$1"

  cat >"$rcfile" <<EOF
export DATABASE_URL='$DATABASE_URL'
cd '$ROOT_DIR'
alias decision-logger='node "$ROOT_DIR/apps/cli/dist/index.js"'
alias decision-logger-api='DATABASE_URL="$DATABASE_URL" node "$ROOT_DIR/apps/api/dist/index.js"'
echo
echo "Entering manual test shell for $ROOT_DIR"
echo "DATABASE_URL=$DATABASE_URL"
echo
echo "Aliases:"
echo "  decision-logger"
echo "  decision-logger-api"
echo
EOF
}

setup_environment() {
  local compose_cmd
  compose_cmd="$(choose_compose_cmd)"

  export DATABASE_URL

  (
    cd "$ROOT_DIR"
    # Only the database is required for interactive local smoke testing.
    $compose_cmd up -d postgres
  )

  wait_for_postgres
  run_db_migrations
  build_workspace
}

configure_current_shell() {
  export DATABASE_URL
  cd "$ROOT_DIR"
  alias decision-logger="node \"$ROOT_DIR/apps/cli/dist/index.js\""
  alias decision-logger-api="DATABASE_URL=\"$DATABASE_URL\" node \"$ROOT_DIR/apps/api/dist/index.js\""
  print_ready_banner
}

main() {
  setup_environment

  if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
    configure_current_shell
    return
  fi

  local rcfile
  rcfile="$(mktemp)"
  write_rcfile "$rcfile"

  echo "Bootstrap complete. Starting an interactive shell..."
  exec bash --rcfile "$rcfile" -i
}

main "$@"
