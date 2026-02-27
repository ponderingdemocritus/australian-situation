# BullMQ Ingest Upgrade: Issue Series, Dependencies, and Milestones

- Date: 2026-02-27
- Parent PRD: `docs/issue-bullmq-ingest-upgrade-v1.md`
- Tracking style: one Epic + milestone-aligned child issues

## 1. Epic

## EPIC: Upgrade ingest runtime to BullMQ with extensible job registry

Goal:

1. Replace one-shot ingest orchestration with a production-grade BullMQ runtime.
2. Preserve existing ingest output behavior.
3. Make adding new jobs registry-driven and low-friction.

Definition of done:

1. Scheduler + workers run via BullMQ by default.
2. Existing jobs run through queue processors with idempotent writes.
3. Queue events, retries, and graceful shutdown are production-ready.
4. Legacy direct orchestration path is removed or disabled.

## 2. Milestones

1. `M1 Queue Foundation`
2. `M2 Registry + Scheduler`
3. `M3 Worker + Retry + Metadata`
4. `M4 Job Migration + Parity`
5. `M5 Observability + Cutover`

## 3. Dependency Graph

Notation: `Issue-X -> Issue-Y` means `Y` depends on `X`.

1. `Issue-1` (Redis + BullMQ deps) -> `Issue-2`, `Issue-3`, `Issue-4`
2. `Issue-2` (Job registry contract) -> `Issue-3`, `Issue-4`, `Issue-5`
3. `Issue-3` (Scheduler runtime) -> `Issue-8`, `Issue-5`, `Issue-9`
4. `Issue-4` (Worker runtime + retry classification) -> `Issue-5`, `Issue-7`, `Issue-8`, `Issue-9`
5. `Issue-6` (DB ingestion run metadata extension) -> `Issue-4`, `Issue-5`, `Issue-9`
6. `Issue-5` (Migrate existing jobs) -> `Issue-9`
7. `Issue-8` (Manual/backfill dispatch) -> `Issue-9`
8. `Issue-7` (Queue events + ops runbook) -> `Issue-9`

Critical path:

1. `Issue-1 -> Issue-2 -> Issue-4 -> Issue-5 -> Issue-9`

## 4. Issue Series (Ready to Create)

Each issue includes title, scope, acceptance criteria, dependencies, and milestone.

## Issue-1

- Title: `ingest: add BullMQ + Redis foundation for local/dev/CI`
- Milestone: `M1 Queue Foundation`
- Depends on: none

Scope:

1. Add BullMQ and required Redis client dependencies in `apps/ingest`.
2. Add Redis service to `docker-compose.yml` and wire env variables.
3. Update `run-all.sh`/dev scripts so ingest runtime can start with Redis available.

Acceptance criteria:

1. Redis can be started locally with existing infra scripts.
2. Ingest package can initialize BullMQ queue objects with env config.
3. CI docs/config include Redis requirement for queue integration tests.

Suggested labels:

1. `ingest`
2. `infra`
3. `bullmq`

## Issue-2

- Title: `ingest: introduce typed job registry contract and guardrail tests`
- Milestone: `M2 Registry + Scheduler`
- Depends on: `Issue-1`

Scope:

1. Add `IngestJobDefinition` type and central registry module.
2. Encode current recurring jobs as registry entries.
3. Add contract tests that fail for missing/invalid fields and protect job ID stability.

Acceptance criteria:

1. Registry is the single source of truth for ingest jobs.
2. Failing tests exist for invalid registry definitions.
3. Existing scheduler cadence expectations are sourced from registry, not scattered constants.

Suggested labels:

1. `ingest`
2. `architecture`
3. `tdd`

## Issue-3

- Title: `ingest: implement BullMQ scheduler bootstrap with Job Schedulers API`
- Milestone: `M2 Registry + Scheduler`
- Depends on: `Issue-1`, `Issue-2`

Scope:

1. Build `ingest-scheduler` startup path.
2. Register recurring jobs via `queue.upsertJobScheduler(...)`.
3. Ensure bootstrap is idempotent across repeated runs.
4. Explicitly avoid legacy/deprecated scheduler patterns.

Acceptance criteria:

1. Scheduler boot upserts all recurring jobs from registry.
2. Re-running scheduler does not create duplicate schedule records.
3. Tests validate expected `pattern`/`every` config per job.

Suggested labels:

1. `ingest`
2. `scheduler`
3. `bullmq`

## Issue-4

- Title: `ingest: implement BullMQ worker runtime with retry classification`
- Milestone: `M3 Worker + Retry + Metadata`
- Depends on: `Issue-1`, `Issue-2`, `Issue-6`

Scope:

1. Build `ingest-worker` bootstrap with concurrency and graceful shutdown.
2. Map job names to registry processors.
3. Classify errors:
   - transient `SourceClientError` retries with configured backoff
   - permanent parse/schema errors fail fast (`UnrecoverableError`)
4. Emit structured completion/failure logs.

Acceptance criteria:

1. Worker processes queued jobs and retries only transient failures.
2. Non-transient failures do not consume retry budget.
3. Shutdown path closes workers cleanly on `SIGINT`/`SIGTERM`.

Suggested labels:

1. `ingest`
2. `worker`
3. `reliability`

## Issue-5

- Title: `ingest: migrate current sync jobs to registry-driven BullMQ processors`
- Milestone: `M4 Job Migration + Parity`
- Depends on: `Issue-2`, `Issue-3`, `Issue-4`, `Issue-6`

Scope:

1. Migrate:
   - `sync-energy-wholesale-5m`
   - `sync-energy-retail-prd-hourly`
   - `sync-housing-abs-daily`
2. Remove direct orchestration dependency on one-shot `Promise.all`.
3. Ensure functional parity for result behavior and persistence side effects.

Acceptance criteria:

1. Existing jobs run through BullMQ worker path in non-legacy mode.
2. Integration tests confirm no output regressions for current fixtures/live mode.
3. Replay/duplicate processing remains idempotent.

Suggested labels:

1. `ingest`
2. `migration`
3. `tdd`

## Issue-6

- Title: `db/ingest: extend ingestion_runs metadata for queue execution context`
- Milestone: `M3 Worker + Retry + Metadata`
- Depends on: `Issue-1`

Scope:

1. Add columns to capture queue run context:
   - `bull_job_id`
   - `queue_name`
   - `attempt`
   - `run_mode` (`scheduled|manual|backfill`)
2. Add migration + schema updates + repository write support.
3. Update tests for ingestion run persistence contract.

Acceptance criteria:

1. Ingestion run rows include queue context for all worker executions.
2. Migrations are forward-safe and pass existing DB test suite.
3. API/ops consumers can query run history with queue identifiers.

Suggested labels:

1. `db`
2. `ingest`
3. `observability`

## Issue-7

- Title: `ingest: add QueueEvents telemetry and operations runbook`
- Milestone: `M5 Observability + Cutover`
- Depends on: `Issue-4`

Scope:

1. Add queue event listeners for completed/failed/stalled signals.
2. Standardize structured log payload for alerting.
3. Document triage and replay workflow in runbook.

Acceptance criteria:

1. Events include job ID, queue, attempt, and failure classification.
2. Operators can triage a failed run using runbook + DB + queue metadata.
3. Tests verify event handlers preserve required fields.

Suggested labels:

1. `ingest`
2. `ops`
3. `observability`

## Issue-8

- Title: `ingest: add manual and backfill dispatch commands on top of BullMQ`
- Milestone: `M5 Observability + Cutover`
- Depends on: `Issue-3`, `Issue-4`

Scope:

1. Add dispatch CLI/module for one-off job enqueue.
2. Add bounded backfill enqueue support (`from`, `to`, `dry_run`).
3. Add payload validation and dedupe safeguards.

Acceptance criteria:

1. Manual trigger can enqueue and execute any registered job safely.
2. Backfill windows are validated and auditable.
3. Tests cover invalid payload/window and duplicate enqueue edge cases.

Suggested labels:

1. `ingest`
2. `backfill`
3. `tooling`

## Issue-9

- Title: `ingest: cutover BullMQ runtime as default and remove legacy orchestration`
- Milestone: `M5 Observability + Cutover`
- Depends on: `Issue-3`, `Issue-4`, `Issue-5`, `Issue-7`, `Issue-8`

Scope:

1. Set BullMQ as default ingest runtime.
2. Keep temporary feature flag fallback during burn-in window.
3. Remove legacy direct orchestration path after burn-in criteria are met.
4. Update README and operational docs.

Acceptance criteria:

1. Default runtime for ingest services is BullMQ scheduler + worker.
2. Burn-in checks pass with no unresolved critical failures.
3. Legacy path is removed or explicitly non-production only.

Suggested labels:

1. `ingest`
2. `release`
3. `breaking-change`

## 5. Suggested Milestone Board Mapping

## M1 Queue Foundation

1. `Issue-1`

## M2 Registry + Scheduler

1. `Issue-2`
2. `Issue-3`

## M3 Worker + Retry + Metadata

1. `Issue-6`
2. `Issue-4`

## M4 Job Migration + Parity

1. `Issue-5`

## M5 Observability + Cutover

1. `Issue-7`
2. `Issue-8`
3. `Issue-9`

## 6. TDD Gate Checklist Per Issue

For each issue, enforce:

1. RED: add failing test(s) first for new behavior.
2. GREEN: minimum code to pass.
3. REFACTOR: cleanups while tests remain green.
4. Verify no regressions in:
   - `bun --filter @aus-dash/ingest test`
   - `bun --filter @aus-dash/api test`
   - `bun --filter @aus-dash/web test`
   - `bun --filter @aus-dash/web build`
