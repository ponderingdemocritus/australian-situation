# Hey API SDK + CLI PRD + TDD Plan

## 1. Context

The API already exposes a generated OpenAPI document at `/api/openapi.json`, and the repo treats that contract as the source of truth via `apps/api/tests/openapi.test.ts`, `apps/api/tests/openapi-schema-contract.test.ts`, and `bun run docs:check`.

What the repo does not have today:

1. a generated TypeScript SDK package for consumers
2. a CLI package built on that SDK
3. a contract-sync workflow that fails when the SDK drifts from the server OpenAPI

The desired end state is a downloadable CLI whose commands are backed by a generated SDK, with both aligned to the server’s OpenAPI contract.

## 2. Problem Statement

Consumers currently integrate with the API using ad hoc `fetch` or `curl` calls. That creates three problems:

1. the server contract exists, but there is no first-party typed SDK enforcing it for consumers
2. a future CLI would otherwise duplicate endpoint wiring and drift from the contract
3. the repo has no automated check that generated client artifacts remain current when API routes or schemas change

## 3. Goals

1. Introduce a generated SDK package derived from the API OpenAPI document.
2. Introduce a CLI package that uses only the SDK’s public API for HTTP calls.
3. Make SDK regeneration deterministic in local development and CI.
4. Keep the SDK and CLI backward compatible with the current API surface unless a breaking API change is explicitly planned.
5. Make the CLI installable as a normal package (`npm`, `pnpm`, `bunx`) rather than requiring repo-local scripts.

## 4. Non-Goals

1. Ship a native single-file binary in v1.
2. Redesign existing API payloads or route semantics.
3. Cover every write/mutation route in the first CLI cut.
4. Replace ReDoc or the current OpenAPI route generation.

## 5. Scope

### In Scope

1. `apps/api` OpenAPI export workflow
2. new generated SDK package under `packages/sdk`
3. new CLI package under `packages/cli`
4. contract-sync tests and generation checks
5. package metadata and publish/install smoke coverage

### Out of Scope

1. browser UI consumers
2. auth redesign
3. binary packaging for Homebrew, apt, or standalone executables

## 6. Product Decisions

### 6.1 Package Layout

1. Create `packages/sdk` published as `@aus-dash/sdk`.
2. Create `packages/cli` published as `@aus-dash/cli`.
3. Expose the CLI binary as `aus-dash`.

Rationale: in this monorepo, the SDK and CLI are reusable artifacts, so they fit better as publishable packages than as `apps/*`.

### 6.2 Generator Choice

Use Hey API packages:

1. `@hey-api/openapi-ts`
2. `@hey-api/sdk`
3. `@hey-api/client-fetch`

Use exact version pinning for the generator packages.

### 6.3 Generation Source

Do not generate from a live `localhost` server in CI.

Instead:

1. add an API-side export script that imports the Hono app and writes the current `/api/openapi.json` payload to a checked-in artifact
2. point Hey API at that exported artifact
3. regenerate SDK code from that artifact in a deterministic script

This still makes the server OpenAPI the source of truth while avoiding flaky network-coupled generation.

### 6.4 SDK Shape

Use flat operation exports from the Hey API SDK plugin.

Rationale:

1. simpler public surface
2. tree-shakeable default output
3. easier CLI imports per command

### 6.5 Runtime Configuration

Use the Fetch client with a handwritten runtime config module instead of editing generated files.

The SDK must support:

1. `baseUrl`
2. optional Basic Auth
3. default headers, including a CLI user agent for CLI calls
4. request timeout handling in handwritten wrapper code if needed

### 6.6 CLI Scope for V1

V1 should prioritize read flows:

1. `health`
2. `metadata freshness`
3. `metadata sources`
4. `energy overview`
5. `energy retail-average`
6. `energy live-wholesale`
7. `series get`
8. selected authenticated read routes if already stable, starting with `prices major-goods`

Defer write flows such as intake, reconcile, classify, and promote until after the read-only CLI surface is stable.

## 7. User Stories

1. As an API consumer, I want a first-party SDK so I can call the API with typed request and response contracts.
2. As a CLI user, I want a globally installable command so I can query API data without writing code.
3. As a maintainer, I want API contract changes to fail CI if the generated SDK is stale.
4. As a maintainer, I want the CLI to depend on the SDK rather than duplicating endpoint wiring.

## 8. Functional Requirements

### FR-1 OpenAPI Export

1. The repo must provide a script that exports the server OpenAPI document from `apps/api` without requiring a separately running server.
2. The export must match the response served by `/api/openapi.json`.
3. The exported artifact path must be stable and usable by SDK generation scripts.

### FR-2 Generated SDK Package

1. `packages/sdk` must generate client code from the exported OpenAPI artifact using Hey API.
2. Generated code must live in a dedicated generated folder and must not be manually edited.
3. `packages/sdk` must expose a small handwritten surface around generated code for configuration and ergonomics.
4. The public SDK API must remain additive-first when possible.

### FR-3 CLI Package

1. `packages/cli` must import `@aus-dash/sdk` and use it for all API calls.
2. The CLI must support `--base-url` and environment-based default configuration.
3. The CLI must emit machine-readable JSON by default.
4. The CLI may add a human-readable table mode for selected commands, but JSON is the contract-safe default.
5. The CLI must return non-zero exit codes on request, validation, and auth failures.

### FR-4 Drift Detection

1. The repo must provide a check command that fails if:
   - exported OpenAPI is stale
   - generated SDK artifacts are stale
2. This check must be runnable in CI and locally.

### FR-5 Packaging

1. The CLI package must declare a `bin` entry for `aus-dash`.
2. The package must be installable via package-manager global install or `bunx`.
3. Packed artifacts must include the built CLI entrypoint and required runtime files.

## 9. Non-Functional Requirements

1. Determinism: generation results must not depend on a running local server.
2. Safety: generated files must be isolated so handwritten edits are not overwritten.
3. Compatibility: the SDK and CLI must run on the repo’s supported Node baseline.
4. Maintainability: the CLI must not import from generated deep paths directly; it should use the SDK public entrypoint.
5. Observability: CLI errors must preserve useful API error codes and messages.

## 10. Proposed Architecture

### 10.1 API Layer

Add:

1. `apps/api/scripts/export-openapi.ts`
2. a generated artifact path such as `apps/api/generated/openapi.json`

Workflow:

1. import `app` from `apps/api/src/app.ts`
2. request `/api/openapi.json`
3. write the JSON artifact

### 10.2 SDK Layer

Add:

1. `packages/sdk/package.json`
2. `packages/sdk/openapi-ts.config.ts`
3. `packages/sdk/src/generated/*`
4. `packages/sdk/src/runtime.ts`
5. `packages/sdk/src/index.ts`

Recommended Hey API config:

1. input: exported API artifact
2. client: Fetch
3. plugins: Fetch client + SDK plugin
4. SDK strategy: `flat`
5. runtime config path: handwritten runtime module

### 10.3 CLI Layer

Add:

1. `packages/cli/package.json`
2. `packages/cli/src/index.ts`
3. `packages/cli/src/commands/*`
4. `packages/cli/src/config.ts`

Recommended behavior:

1. parse flags and env once
2. create configured SDK client
3. call SDK operation
4. print JSON result
5. map known API failures to clear stderr messages and exit codes

### 10.4 Root Scripts

Add root-level scripts similar to:

1. `api:openapi:export`
2. `sdk:generate`
3. `sdk:check`
4. `cli:test`
5. `validate:sdk-cli`

## 11. Delivery Plan

### Phase A: OpenAPI Export Foundation

Deliver:

1. API export script
2. stable exported artifact path
3. export parity tests

### Phase B: SDK Generation

Deliver:

1. `packages/sdk`
2. Hey API config
3. generated code committed to the repo
4. runtime wrapper and public exports

### Phase C: CLI Foundation

Deliver:

1. `packages/cli`
2. base URL and auth configuration
3. initial read-only commands

### Phase D: Drift Enforcement + Packaging

Deliver:

1. stale-generation check
2. tarball/bin smoke tests
3. publish metadata and install docs

## 11.1 Implementation Progress

- [x] Phase A: OpenAPI export foundation
- [x] Phase B: SDK package skeleton
- [x] Phase C: Hey API generation
- [x] Phase D: SDK runtime configuration
- [x] Phase E: CLI command wiring
- [x] Phase F: Authenticated route coverage
- [x] Phase G: Drift detection
- [ ] Phase H: Packaging smoke test

## 12. TDD Execution Plan

## Rule

For every implementation slice: write the test first, watch it fail for the intended reason, implement the smallest fix, then refactor only with tests green.

### Phase A: OpenAPI Export

1. RED: add an API test asserting the export script produces the same JSON served by `/api/openapi.json`.
2. GREEN: implement `apps/api/scripts/export-openapi.ts`.
3. REFACTOR: extract shared helpers for stable formatting and file writes if needed.

### Phase B: SDK Package Skeleton

1. RED: add package tests that fail because `@aus-dash/sdk` does not exist and expected exports are missing.
2. GREEN: scaffold `packages/sdk` with handwritten `index.ts` and empty generation wiring.
3. REFACTOR: align package boundaries and export names.

### Phase C: Hey API Generation

1. RED: add a generation contract test that expects concrete generated SDK files for known operations from the current OpenAPI spec.
2. GREEN: add `openapi-ts.config.ts`, install pinned Hey API packages, and generate the SDK.
3. REFACTOR: isolate generated output under `src/generated`.

### Phase D: SDK Runtime Configuration

1. RED: add tests proving SDK calls honor configured `baseUrl`, optional Basic Auth, and public configuration helpers.
2. GREEN: implement handwritten runtime config and public configuration API.
3. REFACTOR: remove duplication between CLI and SDK configuration helpers.

### Phase E: CLI Command Wiring

1. RED: add CLI integration tests that spawn the CLI against an in-process or ephemeral test server and assert JSON output for:
   - `health`
   - `metadata freshness`
   - `energy overview`
   - `series get`
2. GREEN: implement command parsing and SDK-backed handlers.
3. REFACTOR: normalize shared output and error helpers.

### Phase F: Authenticated Route Coverage

1. RED: add CLI tests for an authenticated read endpoint using invalid and valid Basic Auth inputs.
2. GREEN: implement CLI auth flag/env wiring through the SDK runtime.
3. REFACTOR: centralize credential loading and redaction in logs.

### Phase G: Drift Detection

1. RED: add a check test/script that fails when exported OpenAPI or generated SDK artifacts are stale.
2. GREEN: wire `sdk:check` and include it in root validation.
3. REFACTOR: keep check output concise and actionable.

### Phase H: Packaging Smoke Test

1. RED: add a packaging test that packs `@aus-dash/cli`, installs it in a temp location, and fails because the `aus-dash` bin or build output is incomplete.
2. GREEN: complete package metadata and build scripts.
3. REFACTOR: trim packed artifact size without changing behavior.

## 13. Test Matrix

1. API tests:
   - OpenAPI export parity
   - existing OpenAPI route/schema tests remain green
2. SDK tests:
   - public export contract
   - runtime configuration behavior
   - generated artifact presence and shape
3. CLI tests:
   - command parsing
   - JSON output
   - non-zero exits on failures
   - auth handling
4. Packaging tests:
   - tarball includes bin entry and runtime files
   - packed CLI can execute a smoke command

## 14. Acceptance Criteria

1. `@aus-dash/sdk` is generated from the server OpenAPI artifact using Hey API.
2. The SDK generation path does not require a separately running server.
3. `@aus-dash/cli` uses the SDK public API and does not hand-roll route calls.
4. `aus-dash` can be installed and executed as a package-manager CLI.
5. CI/local checks fail when OpenAPI export or SDK generation is stale.
6. Initial CLI read commands pass integration tests against the current API.
7. Existing API OpenAPI tests remain green.

## 15. Risks and Mitigations

1. Risk: generated SDK churn creates noisy diffs.
   Mitigation: pin exact generator versions, isolate generated output, and keep handwritten code outside generated folders.
2. Risk: CLI command names drift from API semantics.
   Mitigation: derive handlers from SDK operations and document explicit command naming rules.
3. Risk: authenticated routes complicate first release.
   Mitigation: ship read-only public commands first and add authenticated reads in a separate phase.
4. Risk: stale artifact checks become flaky.
   Mitigation: export from the in-process app instead of a network server.

## 16. Definition of Done

1. All acceptance criteria are met.
2. `apps/api`, `packages/sdk`, and `packages/cli` tests are green.
3. Drift checks are wired into normal validation.
4. CLI install and smoke execution are verified from a packed artifact.
5. Usage documentation exists for SDK regeneration and CLI installation.
