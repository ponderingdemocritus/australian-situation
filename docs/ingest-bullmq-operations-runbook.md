# Ingest BullMQ Operations Runbook

## Scope

This runbook covers queue triage and replay for ingest runtime jobs running on BullMQ.

## Runtime Processes

- Scheduler bootstrap: `bun --filter @aus-dash/ingest scheduler`
- Worker runtime: `bun --filter @aus-dash/ingest worker`

## Structured Event Types

- `ingest.queue.completed`
- `ingest.queue.failed`
- `ingest.queue.stalled`
- `ingest.worker.failed`

Each event must include queue/job identifiers and attempt metadata to support replay triage:

- `queueName`
- `jobId` (BullMQ job id)
- `jobName`/`jobId` (ingest registry id)
- `attempt`
- `classification` for failed events (`retryable` or `unrecoverable`)

## Triage Checklist

1. Confirm scheduler is upserted and worker is running.
2. Filter logs for `ingest.queue.failed` and capture `jobId`, `jobName`, `attempt`, `classification`.
3. For `retryable` failures, verify retries are progressing.
4. For `unrecoverable` failures, inspect upstream payload/schema and fix parser/source contract.
5. For `ingest.queue.stalled`, check Redis health and worker liveness.

## Replay Procedure

1. Use manual dispatch command for a single job by registry job id.
   - `bun --filter @aus-dash/ingest dispatch:manual <jobId>`
2. Use backfill dispatch command for bounded windows only.
   - `bun --filter @aus-dash/ingest dispatch:backfill <jobId> --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run]`
3. Preserve run mode tags:
   - `scheduled`
   - `manual`
   - `backfill`
4. Verify replay writes in `ingestion_runs` with queue metadata fields:
   - `bull_job_id`
   - `queue_name`
   - `attempt`
   - `run_mode`

## Recovery Guardrails

- Never enqueue unbounded backfill ranges.
- Do not replay non-idempotent payload variants without a dry run.
- Treat repeated `unrecoverable` errors as contract breakages, not transient incidents.
