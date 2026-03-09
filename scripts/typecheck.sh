#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

projects=(
  "packages/data-contract"
  "packages/shared"
  "packages/db"
  "packages/ui"
  "apps/api"
  "apps/ingest"
  "apps/web"
)

for project in "${projects[@]}"; do
  echo "Typechecking ${project}..."
  if [[ "$project" == "apps/web" ]]; then
    ./node_modules/.bin/tsc -p "$project/tsconfig.json" --noEmit --incremental false
  else
    ./node_modules/.bin/tsc -p "$project/tsconfig.json" --noEmit
  fi
done
