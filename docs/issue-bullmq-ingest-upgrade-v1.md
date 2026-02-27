# Issue + TDD PRD: Upgrade Ingest to BullMQ (Best Practice, Extensible)

- Status: Proposed
- Date: 2026-02-27
- Owner: TBD
- Scope: `apps/ingest`, `packages/db`, `docker-compose.yml`, `run-all.sh`, docs

## 1. Problem Statement

Current ingest orchestration is not a real queue runtime:

1. `apps/ingest/src/index.ts` runs a fixed job list with `Promise.all` once, then exits.
2. `apps/ingest/src/scheduler.ts` defines cadences but does not schedule execution.
3. Retries are hand-rolled (`runJobWithRetry`) and only cover a narrow error path.
4. There is no durable queue state, delayed scheduling control, or queue-level observability.
5. Adding a new ingest job is ad hoc (no shared job contract/registry).

This blocks production-grade operations and makes ingest behavior hard to evolve safely.

## 2. Goals

1. Replace one-shot orchestration with BullMQ-backed producer/scheduler/worker runtime.
2. Preserve existing domain job logic (`syncHousingSeries`, `syncEnergyWholesale`, `syncEnergyRetailPlans`) while moving execution semantics to BullMQ.
3. Enforce idempotent, retry-safe processing and explicit transient/permanent failure handling.
4. Add first-class operational controls: retries/backoff, dedupe, metrics/events, graceful shutdown.
5. Introduce a clear plug-in contract so adding new jobs is straightforward and consistent.

## 3. Non-Goals

1. Rewriting source mappers/business formulas for housing/energy values.
2. Migrating to BullMQ Pro features.
3. Changing external API response shapes in `apps/api`.
4. Building a full UI for queue administration in this phase.

## 4. Target Architecture

## 4.1 Runtime Components

1. `ingest-scheduler` process:
   - Registers recurring schedules with `queue.upsertJobScheduler(...)`.
   - Owns schedule definitions and ensures idempotent scheduler upsert at startup.
2. `ingest-worker` process:
   - Runs BullMQ workers for ingest queues.
   - Executes job handlers with controlled concurrency, retries, and failure classification.
3. `ingest-dispatch` module:
   - Allows manual enqueue for ad hoc runs and backfills.
4. `ingest-events` observer:
   - Subscribes via `QueueEvents` for global completed/failed/stalled telemetry and alert routing.
5. BullMQ scheduling API policy:
   - Use Job Schedulers (`upsertJobScheduler`) for recurring jobs.
   - Do not implement new scheduling via deprecated repeat APIs/legacy `QueueScheduler`.

## 4.2 Queue Topology

1. Queue names are explicit and domain-scoped:
   - `ingest.realtime` (5-minute wholesale jobs)
   - `ingest.standard` (hourly/daily jobs)
2. Job names are stable IDs:
   - `sync-energy-wholesale-5m`
   - `sync-energy-retail-prd-hourly`
   - `sync-housing-abs-daily`
3. Queue defaults enforce:
   - attempts/backoff policy
   - bounded retention (`removeOnComplete`, `removeOnFail`)
   - deterministic prefix/env naming (for multi-env isolation)

## 4.3 Data and Reliability Model

1. Keep DB idempotency guarantees based on unique observation key:
   - `(series_id, region_code, date, vintage)`
2. Extend ingestion run metadata to include queue context:
   - `bull_job_id`, `queue_name`, `attempt`, `run_mode` (`scheduled|manual|backfill`)
3. Error classification:
   - transient errors retry with exponential backoff + jitter
   - non-transient schema/data errors fail immediately (`UnrecoverableError`)

## 5. Extensibility Contract (How New Jobs Are Added)

## 5.1 Job Definition Interface

Each job must be declared in a central registry with this contract:

```ts
export type IngestJobDefinition<TData> = {
  jobId: string;                     // stable ID used in logs/metadata
  queueName: "ingest.realtime" | "ingest.standard" | string;
  jobName: string;                   // BullMQ name
  schedule?: { pattern?: string; every?: number };
  defaultJobOptions?: {
    attempts?: number;
    backoff?: { type: "fixed" | "exponential"; delay: number; jitter?: number };
    removeOnComplete?: boolean | number | { age?: number; count?: number };
    removeOnFail?: boolean | number | { age?: number; count?: number };
  };
  buildPayload: (input?: unknown) => TData;
  process: (ctx: JobExecutionContext, data: TData) => Promise<JobExecutionResult>;
};
```

## 5.2 Add-a-Job Workflow

1. Create a new job definition file in `apps/ingest/src/jobs/definitions/`.
2. Add parser/mapper tests for the new source and payload edge cases.
3. Register the definition in `apps/ingest/src/jobs/registry.ts`.
4. If recurring, add scheduler config (`pattern` or `every`).
5. Add integration tests proving retry behavior + idempotent writes.
6. Update metadata endpoint coverage if new source is exposed externally.

A new job should require no edits to worker bootstrap logic beyond registry inclusion.

## 6. Functional Requirements

1. `FR-001`: Scheduler upserts all recurring jobs on startup and can be run safely multiple times.
2. `FR-002`: Worker consumes jobs by registry mapping and records ingestion run metadata per attempt.
3. `FR-003`: Manual dispatch supports one-off execution for a specific `jobId`.
4. `FR-004`: Backfill dispatch supports bounded windows with dedupe safeguards.
5. `FR-005`: Existing jobs continue to write observations/source cursors/raw snapshots/ingestion runs correctly.
6. `FR-006`: Failed jobs produce actionable events/log payloads including attempt, queue, job ID, and classified reason.

## 7. Non-Functional Requirements

1. `NFR-001`: At-least-once processing is explicitly handled via idempotent job logic and DB constraints.
2. `NFR-002`: Graceful shutdown closes workers on `SIGINT`/`SIGTERM`.
3. `NFR-003`: Redis config guidance documented for production (`AOF`, `maxmemory-policy=noeviction`).
4. `NFR-004`: Queue events and metrics are enabled for completed/failed throughput tracking.
5. `NFR-005`: Worker connection settings are production-safe (`maxRetriesPerRequest` behavior consistent with BullMQ guidance).

## 8. TDD Milestones (Red -> Green -> Refactor)

## Milestone 0: Guardrail Tests (No Runtime Changes Yet)

RED tests:

1. Failing tests that assert scheduler cadences are actually materialized in BullMQ registration.
2. Failing tests that assert every registered job has required contract fields.
3. Failing tests that assert ingest startup no longer uses one-shot `Promise.all`.

GREEN:

1. Create registry skeleton and BullMQ wiring stubs.

Exit criteria:

1. New contract tests pass and fail correctly when registry entries are invalid.

## Milestone 1: Queue Foundation

RED tests:

1. Queue bootstrap builds connection objects correctly for producer vs worker roles.
2. Startup fails fast with clear error if Redis is unavailable for scheduler boot.

GREEN:

1. Add BullMQ dependencies and queue factory modules.
2. Add Redis service to local infra (`docker-compose.yml`) and env wiring.

Exit criteria:

1. Local stack can start Redis + Postgres and initialize ingest queue components.

## Milestone 2: Scheduler and Dispatch

RED tests:

1. `upsertJobScheduler` is called for all recurring jobs with expected pattern/every configs.
2. Re-running scheduler boot does not create duplicate schedulers.
3. Manual dispatch enqueues requested `jobId` with validated payload.

GREEN:

1. Implement `ingest-scheduler` and dispatch module.

Exit criteria:

1. Queue inventory matches registry exactly after repeated boots.

## Milestone 3: Worker Execution and Retry Policy

RED tests:

1. Transient `SourceClientError` retries with configured attempts/backoff.
2. Non-transient source/schema errors fail without retry.
3. Job completion writes ingestion run metadata including BullMQ context fields.
4. Worker emits expected failure events payload for alerting.

GREEN:

1. Implement worker bootstrap and error classification adapter.
2. Wire job handlers to existing sync functions.

Exit criteria:

1. Existing job behavior preserved with BullMQ runtime semantics.

## Milestone 4: Migrate Existing Jobs

RED tests:

1. `sync-energy-wholesale-5m` via queue inserts/updates observations idempotently.
2. `sync-energy-retail-prd-hourly` via queue preserves aggregate outputs.
3. `sync-housing-abs-daily` via queue preserves ingest outputs.
4. Replayed duplicate payloads do not duplicate observation records.

GREEN:

1. Move current direct job invocation paths behind queue-dispatched processors.

Exit criteria:

1. Legacy one-shot orchestration entrypoint removed or isolated to explicit backfill mode only.

## Milestone 5: Observability and Operations

RED tests:

1. Queue events listener records completed/failed counts and preserves failure metadata.
2. Graceful shutdown test confirms worker `close()` path is executed.
3. Retention settings keep bounded completed/failed job history.

GREEN:

1. Add metrics/events module and operational runbook doc.

Exit criteria:

1. On-call can diagnose failed jobs from logs + DB + queue metadata.

## Milestone 6: Extensibility Hardening

RED tests:

1. Adding a dummy job through registry executes without worker bootstrap changes.
2. Missing required job contract fields fail at test time.
3. Registry snapshot test protects against accidental job ID renames.

GREEN:

1. Finalize add-a-job template and docs.

Exit criteria:

1. New job onboarding is a predictable, documented 6-step workflow.

## 9. Implementation Checklist

- [ ] Add `bullmq` and Redis client dependencies in `apps/ingest`.
- [ ] Introduce Redis infra for local/dev and CI test runs.
- [ ] Add queue factory, scheduler bootstrap, worker bootstrap, and events listener modules.
- [ ] Define and enforce `IngestJobDefinition` registry contract.
- [ ] Migrate existing jobs to registry-driven processors.
- [ ] Extend ingestion run persistence with BullMQ metadata fields.
- [ ] Replace current ingest entrypoint with process-role-based startup (`scheduler`, `worker`, optional `dispatch`).
- [ ] Add runbook docs for startup, failure triage, replay, and backfill.

## 10. Acceptance Criteria

1. All recurring ingest jobs are scheduled through BullMQ job schedulers (not ad hoc in-process loops).
2. Workers process jobs with standardized retry/backoff and clear permanent failure semantics.
3. Existing ingest outputs remain functionally equivalent for current jobs.
4. Duplicate execution/retry does not violate idempotent DB writes.
5. New job onboarding requires only definition + registry + tests, not core runtime edits.
6. Test suite includes unit + integration coverage for scheduler, worker, retries, and extensibility contract.

## 11. Risks and Mitigations

1. Risk: Duplicate processing under at-least-once semantics.
   - Mitigation: preserve strict idempotency keys and dedupe strategy.
2. Risk: Redis operational misconfiguration causes queue instability.
   - Mitigation: enforce documented production settings and startup checks.
3. Risk: Migration regression in ingest output parity.
   - Mitigation: lock existing job behavior with fixture/live-mode parity tests before migration.

## 12. Rollout Plan

1. Ship queue runtime behind `AUS_DASH_INGEST_RUNTIME=bullmq`.
2. Run dual-mode validation in non-prod:
   - legacy direct runner and BullMQ runner produce equivalent outputs.
3. Cut over production ingest runtime to BullMQ worker/scheduler.
4. Remove legacy orchestration path after burn-in.

## 13. Definition of Done

1. All Milestones 0-6 completed with passing tests.
2. Ingest no longer depends on one-shot `Promise.all` orchestration.
3. Redis-backed BullMQ runtime is default ingest mode.
4. Add-a-job guide is documented and validated with a sample job.
5. CI includes queue integration tests and passes consistently.


