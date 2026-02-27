#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  ./run-all.sh dev
  ./run-all.sh test [--with-e2e]

Commands:
  dev           Run web, api, and ingest services in parallel.
  test          Run workspace tests (vitest); include e2e with --with-e2e.
EOF
}

run_dev() {
  echo "Starting web, api, and ingest..."
  bun run dev:web &
  web_pid=$!
  bun run dev:api &
  api_pid=$!
  bun run dev:ingest &
  ingest_pid=$!

  cleanup() {
    kill "$web_pid" "$api_pid" "$ingest_pid" 2>/dev/null || true
  }
  trap cleanup EXIT INT TERM

  wait -n "$web_pid" "$api_pid" "$ingest_pid"
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

  echo "Running workspace tests..."
  bun run test

  if [[ "$with_e2e" -eq 1 ]]; then
    echo "Running e2e tests..."
    bun run test:e2e
  fi
}

main() {
  case "${1:-}" in
    dev)
      run_dev
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
