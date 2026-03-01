# AGENTS

## Contribution Defaults

1. Keep changes small, test-backed, and backward compatible for API consumers.
2. When route behavior changes, update both:
   - `apps/api/tests/*`
   - `README.md` API endpoint table
3. Prefer additive changes to contracts and route payloads unless a breaking change is explicitly planned.

## UI Workflow (shadcn + Monorepo)

Use this repo pattern for all new UI primitives/components:

1. Shared/reusable components go in `packages/ui`.
2. App-specific composition stays in `apps/web`.
3. Import shared UI in the app from `@aus-dash/ui`.

### Add a shared UI component

Run from repo root:

```bash
bunx --bun shadcn@latest add <component-name> -c packages/ui
```

Example:

```bash
bunx --bun shadcn@latest add badge -c packages/ui
```

### Required follow-up after `add`

1. Export new component(s) from `packages/ui/src/index.ts`.
2. Keep `packages/ui/components.json` and `apps/web/components.json` aligned:
   - `style: "new-york"`
   - `tailwind.baseColor: "zinc"`
3. If the component adds new runtime deps, run:

```bash
bun install
```

### Tailwind + class detection

`apps/web/app/styles.css` is the single Tailwind entrypoint and must keep:

```css
@source "../../../packages/ui/src/**/*.{ts,tsx}";
```

If shared UI paths move, update this `@source` path or shared component styles will not compile.

### Usage in web app

```tsx
import { Button } from "@aus-dash/ui";
```

Do not import from deep relative paths in `packages/ui` from `apps/web`.

### Validation checklist

Run after any UI addition:

```bash
bun --filter @aus-dash/ui test
bun --filter @aus-dash/web test
bun --filter @aus-dash/web build
```

## Data Source Workflow (Ingest + API)

Use this workflow when adding a new upstream data source or expanding an existing one.

### 1) Define stable IDs first

1. Choose a stable `sourceId` (lower snake case, e.g. `aemo_wholesale`).
2. Add/extend canonical series IDs in `packages/data-contract/src/*` when introducing new metrics.
3. Keep series IDs domain-scoped (for example `energy.*`, `housing.*`, `macro.*`).

### 2) Add source client parsing

1. Implement fetch/parse in `apps/ingest/src/sources/live-source-clients.ts`.
2. Parse to typed rows and throw `SourceClientError` on schema/network failures.
3. Mark transient errors correctly (`transient: true`) so retry logic in `apps/ingest/src/scheduler.ts` works as intended.

### 3) Add or update sync job

1. Add/extend a job in `apps/ingest/src/jobs/sync-*.ts`.
2. Map records into `LiveObservation` shape with required fields:
   - `seriesId`, `regionCode`, `date`, `value`, `unit`
   - `sourceName`, `sourceUrl`, `publishedAt`, `ingestedAt`, `vintage`
   - `confidence`, plus optional comparison fields when relevant (`countryCode`, `taxStatus`, `consumptionBand`, `methodologyVersion`)
3. Persist operational metadata in the same job:
   - stage raw payload (`stageRawPayload` / `stageRawPayloadInPostgres`)
   - upsert observations (`upsertObservations` / `upsertObservationsInPostgres`)
   - update source cursor (`setSourceCursor` / `setSourceCursorInPostgres`)
   - append ingestion run (`appendIngestionRun` / `appendIngestionRunInPostgres`)

### 4) Register source catalog for both backends

1. Add source metadata to `createSeedLiveStore().sources` in `packages/shared/src/live-store.ts`:
   - `sourceId`, `domain`, `name`, `url`, `expectedCadence`
2. For Postgres ingestion, ensure source catalog upsert runs via `ensureSourceCatalogInPostgres(...)`.
3. If a job uses sources not in the seed catalog, pass an explicit merged catalog (pattern used in global energy jobs).

### 5) Expose through API

1. Update repository implementations in both:
   - `apps/api/src/repositories/live-store-repository.ts`
   - `apps/api/src/repositories/postgres-live-repository.ts`
2. Add/extend route handlers + validation in `apps/api/src/app.ts`.
3. If the source should appear in metadata:
   - ensure `/api/metadata/sources` includes it
   - update `/api/metadata/freshness` key-series list when freshness tracking is required

### 6) Tests required

At minimum, add or update:

1. Source client tests in `apps/ingest/tests/source-clients.test.ts` (or adjacent source/job tests).
2. Ingestion job tests in `apps/ingest/tests/*`.
3. API tests in `apps/api/tests/*` for any new/changed endpoint behavior.

Run before opening PR:

```bash
bun --filter @aus-dash/ingest test
bun --filter @aus-dash/api test
bun --filter @aus-dash/web test
bun --filter @aus-dash/web build
```
