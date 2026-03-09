#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${DATABASE_URL:?DATABASE_URL must be set for postgres validation}"

echo "Migrating Postgres schema..."
bun --filter @aus-dash/db db:migrate

echo "Running Postgres-backed API parity..."
bun --filter @aus-dash/api test tests/postgres-parity.test.ts

echo "Running Postgres-backed ingest persistence checks..."
bun --filter @aus-dash/ingest test tests/postgres-persistence-integration.test.ts
