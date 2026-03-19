#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Keep API and ingest on the same JSON store path in local/store mode.
export AUS_DASH_STORE_PATH="${AUS_DASH_STORE_PATH:-$ROOT_DIR/apps/ingest/data/live-store.json}"
export AUS_DASH_INGEST_RUNTIME="${AUS_DASH_INGEST_RUNTIME:-bullmq}"

usage() {
  cat <<'EOF'
Usage:
  ./run-all.sh dev [--rust]
  ./run-all.sh up [--skip-build] [--keep-infra] [--rust]
  ./run-all.sh infra up|down|status
  ./run-all.sh test [--with-e2e]

Commands:
  dev           Run web, api, and ingest services in parallel.
  up            One-command stack: docker compose up postgres, migrate, backfill,
                build web, then run web+api+ingest together.
  infra         Manage docker compose infrastructure only.
  test          Run workspace tests (vitest); include e2e with --with-e2e.

Flags:
  --rust        Use Rust api/ingest binaries instead of TypeScript services.
EOF
}

compose_cmd() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  echo "Docker Compose is required but not available."
  exit 1
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd"
    exit 1
  fi
}

wait_for_postgres() {
  local max_attempts=60
  local attempt=1
  while [[ "$attempt" -le "$max_attempts" ]]; do
    if compose_cmd exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-aus_dash}" >/dev/null 2>&1; then
      echo "Postgres is ready."
      return
    fi

    sleep 1
    attempt=$((attempt + 1))
  done

  echo "Postgres did not become ready in time."
  exit 1
}

run_dev_processes() {
  local stop_infra_on_exit="${1:-0}"
  local use_rust="${2:-0}"

  echo "Starting web, api, and ingest..."
  bun run dev:web &
  web_pid=$!

  if [[ "$use_rust" -eq 1 ]]; then
    echo "Using Rust services for api and ingest."
    cargo run -p aus-api &
    api_pid=$!
    cargo run -p aus-ingest &
    ingest_pid=$!
  else
    bun run dev:api &
    api_pid=$!
    bun run dev:ingest &
    ingest_pid=$!
  fi

  cleanup() {
    kill "$web_pid" "$api_pid" "$ingest_pid" 2>/dev/null || true
    if [[ "$stop_infra_on_exit" -eq 1 ]]; then
      compose_cmd down >/dev/null 2>&1 || true
    fi
  }
  trap cleanup EXIT INT TERM

  wait -n "$web_pid" "$api_pid" "$ingest_pid"
}

run_dev() {
  local use_rust=0
  for arg in "$@"; do
    case "$arg" in
      --rust)
        use_rust=1
        ;;
      *)
        echo "Unknown dev flag: $arg"
        usage
        exit 1
        ;;
    esac
  done

  run_dev_processes 0 "$use_rust"
}

run_up() {
  local skip_build=0
  local keep_infra=0
  local use_rust=0

  for arg in "$@"; do
    case "$arg" in
      --skip-build)
        skip_build=1
        ;;
      --keep-infra)
        keep_infra=1
        ;;
      --rust)
        use_rust=1
        ;;
      *)
        echo "Unknown up flag: $arg"
        usage
        exit 1
        ;;
    esac
  done

  require_cmd bun
  if command -v docker >/dev/null 2>&1; then
    :
  elif ! command -v docker-compose >/dev/null 2>&1; then
    echo "docker or docker-compose is required for 'up'."
    exit 1
  fi

  export POSTGRES_USER="${POSTGRES_USER:-postgres}"
  export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
  export POSTGRES_DB="${POSTGRES_DB:-aus_dash}"
  export POSTGRES_PORT="${POSTGRES_PORT:-5433}"
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
  export AUS_DASH_DATA_BACKEND="${AUS_DASH_DATA_BACKEND:-postgres}"
  export AUS_DASH_INGEST_BACKEND="${AUS_DASH_INGEST_BACKEND:-postgres}"

  echo "Starting docker compose infrastructure..."
  compose_cmd up -d --force-recreate postgres

  wait_for_postgres

  echo "Running database migrations..."
  if [[ "$use_rust" -eq 1 ]]; then
    cargo run -p aus-cli -- migrate 2>/dev/null || bun --filter @aus-dash/db db:migrate
  else
    bun --filter @aus-dash/db db:migrate
  fi

  echo "Backfilling store data into Postgres..."
  bun --filter @aus-dash/ingest backfill:store-to-postgres

  if [[ "$skip_build" -eq 0 ]]; then
    echo "Building web app..."
    bun --filter @aus-dash/web build
  else
    echo "Skipping web build (--skip-build)."
  fi

  if [[ "$keep_infra" -eq 1 ]]; then
    run_dev_processes 0 "$use_rust"
  else
    run_dev_processes 1 "$use_rust"
  fi
}

run_infra() {
  case "${1:-}" in
    up)
      compose_cmd up -d postgres
      ;;
    down)
      compose_cmd down
      ;;
    status)
      compose_cmd ps
      ;;
    *)
      echo "Usage: ./run-all.sh infra up|down|status"
      exit 1
      ;;
  esac
}

run_test() {
  local with_e2e=0
  for arg in "$@"; do
    case "$arg" in
      --with-e2e)
        with_e2e=1
        ;;
      *)
        echo "Unknown test flag: $arg"
        usage
        exit 1
        ;;
    esac
  done

  echo "Running repo validation..."
  bun run validate

  if [[ "$with_e2e" -eq 1 ]]; then
    echo "Running e2e tests..."
    bun run test:e2e:real
  fi
}

main() {
  case "${1:-}" in
    dev)
      shift || true
      run_dev "$@"
      ;;
    up)
      shift || true
      run_up "$@"
      ;;
    infra)
      shift || true
      run_infra "$@"
      ;;
    test)
      shift || true
      run_test "$@"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
