# Implementation-Fit Memo: Adding Comparison Countries

## Bottom line

The repo is only partially country-agnostic today.

- API comparison endpoints already accept arbitrary `country` and `peers`, so route shape is not the main blocker.
- The ingest pipeline is the real constraint: comparison derivation is explicitly allowlisted to `AU`, `US`, and `DE`, and World Bank normalization only maps ISO3 codes for those same three countries.
- Based on the current code, adding more EU countries is the lowest-friction path because the Eurostat and ENTSO-E clients already parse arbitrary `country_code` rows. Adding non-EU countries would require at least one new upstream retail source and one new upstream wholesale source unless you accept partial comparisons.

## Exactly where comparison countries are hardcoded

### Ingest hardcoding

- `apps/ingest/src/jobs/sync-energy-normalization.ts:24-70`
  - World Bank fixture only contains `AUS`, `USA`, `DEU`.
  - `TARGET_COMPARISON_COUNTRIES = new Set(["AU", "US", "DE"])`.
  - `ISO3_TO_ISO2_COUNTRY` only maps `AUS`, `USA`, `DEU`.
- `apps/ingest/src/jobs/sync-energy-normalization.ts:157-159`
  - Derived nominal retail rows are filtered by `TARGET_COMPARISON_COUNTRIES`.
- `apps/ingest/src/jobs/sync-energy-normalization.ts:185-187`
  - FX-normalized retail rows are filtered by `TARGET_COMPARISON_COUNTRIES`.
- `apps/ingest/src/jobs/sync-energy-normalization.ts:256-258`
  - PPP retail rows are filtered by `TARGET_COMPARISON_COUNTRIES`.
- `apps/ingest/src/jobs/sync-energy-normalization.ts:284-286`
  - FX-normalized wholesale rows are filtered by `TARGET_COMPARISON_COUNTRIES`.
- `apps/ingest/src/mappers/global-energy.ts:15-19`
  - Duplicate ISO3-to-ISO2 map also only covers `AUS`, `USA`, `DEU`.
  - This is a correctness risk: new World Bank countries will stay ISO3 here unless the map is expanded.
- `apps/ingest/src/jobs/sync-energy-retail-global.ts:21-40`
  - Fixtures only seed `US` and `DE`.
- `apps/ingest/src/jobs/sync-energy-wholesale-global.ts:21-38`
  - Fixtures only seed `US` and `DE`.
- `apps/ingest/src/sources/live-source-clients.ts:720-735,803-830`
  - EIA retail and wholesale point types and emitted rows hardcode `countryCode: "US"`.
  - This is correct for the current source, but it means the repo has no non-EU, non-US global source client today.

### API/UI hardcoding

- `apps/api/src/routes/energy-routes.ts:212,296`
  - Comparison endpoints default `country` to `AU`.
- `apps/api/src/routes/energy-routes.ts:271-274,323-324`
  - Response fields are still AU-named: `auRank`, `auPercentile`.
- `apps/api/src/routes/route-contracts.ts:173-197`
  - OpenAPI/validation schemas also expose `auRank` and `auPercentile`.
- `apps/web/features/dashboard/components/dashboard-shell.tsx:79-100`
  - Dashboard target country is hardcoded to `AU`, peers to `["US", "DE"]`, and labels only exist for `AU`, `US`, `DE`.
- `apps/web/features/dashboard/components/dashboard-shell.tsx:285-300`
  - Client-side comparison fetch URLs always request `country=AU&peers=US,DE`.
- `apps/web/features/dashboard/components/dashboard-shell.tsx:1321-1323`
  - UI copy is AU-specific: `Australia compared with peers`.
- `apps/web/app/[[...region]]/page.tsx:106-116`
  - Server prefetch also hardcodes `country=AU&peers=US,DE`.

## Ingest jobs and source clients that would need changes

### Must change for any new comparison country

- `apps/ingest/src/jobs/sync-energy-normalization.ts`
  - Expand or replace `TARGET_COMPARISON_COUNTRIES`.
  - Expand or centralize ISO3-to-ISO2 normalization.
  - Verify the new country has both normalization inputs (`macro.fx.local_per_usd`, `macro.ppp.local_per_usd`) and base retail/wholesale observations, otherwise derived comparison rows will not appear.
- `apps/ingest/src/mappers/global-energy.ts`
  - Keep ISO3-to-ISO2 mapping in sync with normalization, or move it to one shared helper.

### Change if the new country is supported by existing upstreams

- `apps/ingest/src/jobs/sync-energy-retail-global.ts`
  - No logic change is likely needed for more Eurostat countries, but fixtures/tests will need expansion.
- `apps/ingest/src/jobs/sync-energy-wholesale-global.ts`
  - No logic change is likely needed for more ENTSO-E countries, but fixtures/tests will need expansion.
- `apps/ingest/src/sources/live-source-clients.ts`
  - `fetchEurostatRetailSnapshot` and `fetchEntsoeWholesaleSnapshot` already parse generic `country_code` rows, so they are implementation-fit for more EU countries.
  - `fetchWorldBankNormalizationSnapshot` is already generic; the join problem is downstream normalization/mapping, not the client itself.

### Change if the new country is outside current upstream coverage

- `apps/ingest/src/sources/live-source-clients.ts`
  - Add a new retail source client if the country is not covered by Eurostat.
  - Add a new wholesale source client if the country is not covered by ENTSO-E and is not the US.
- `apps/ingest/src/jobs/sync-energy-retail-global.ts`
  - Wire the new retail client into the global retail job.
- `apps/ingest/src/jobs/sync-energy-wholesale-global.ts`
  - Wire the new wholesale client into the global wholesale job.
- `packages/shared/src/live-store.ts:105-190`
  - Only needed if you introduce brand-new source IDs; existing EIA/Eurostat/ENTSO-E/World Bank source catalog entries can stay as-is.

## Tests that must be added or updated

### Ingest

- `apps/ingest/tests/source-clients.test.ts`
  - Add parsing coverage for the new country on the relevant upstream client.
  - Add World Bank normalization coverage for the new country's ISO3 code to prove ISO3-to-ISO2 joining works.
- `apps/ingest/tests/sync-energy-retail-global.test.ts`
  - Assert the new retail country is persisted with the expected series and metadata.
- `apps/ingest/tests/sync-energy-wholesale-global.test.ts`
  - Assert the new wholesale country is persisted with the expected series and metadata.
- `apps/ingest/tests/sync-energy-normalization.test.ts`
  - Assert derived nominal retail, PPP retail, and wholesale comparison rows are created for the new country.
- `apps/ingest/tests/energy-comparison-completeness.test.ts`
  - Update the gate from `["AU", "DE", "US"]` to the expanded supported set.

### API

- `apps/api/tests/energy-compare.test.ts`
  - Add requests that include the new country as a peer and, ideally, as the selected `country`.
  - If the AU-biased response fields are renamed later, this file and the route schemas will need contract updates.
- `apps/api/tests/live-data-latest-selection.test.ts`
  - Add a recency-selection case for the new country if it can arrive from multiple revisions.

### Web and E2E

- `apps/web/tests/energy-comparison-panel.test.tsx`
- `apps/web/tests/dashboard-server-prefetch.test.tsx`
- `apps/web/tests/dashboard-subject-tabs.test.tsx`
- `tests/e2e/specs/electricity-comparison.spec.ts`

These all currently assume the fixed AU/US/DE dashboard comparison set and must be updated if the visible peer list changes.

## Practical fit by country type

- Best fit now: additional EU countries with both Eurostat retail rows and ENTSO-E wholesale rows.
- Medium fit: countries with World Bank FX/PPP coverage plus one existing side of the energy data, but this still yields partial comparisons unless both retail and wholesale upstreams exist.
- Poor fit today: non-EU countries outside US coverage. The repo has no current retail/wholesale source clients for them.
