# PRD + TDD: Australia Sector Map in Main Dashboard UI (V1)

- Status: Draft v1.0
- Date: 2026-02-27
- Product surface: `apps/web` dashboard (`DashboardShell`)
- Scope type: UI enhancement with interaction + test hardening
- Target branch: `master`

## 1. Problem Statement

The dashboard already reserves the center panel for a "SECTOR: AUSTRALIA" visualization, but it currently renders a stylistic mesh only. Users cannot visually identify states/territories or interact with the map to drive region context.

This creates three issues:

1. The most prominent UI area lacks geographic meaning.
2. The region selector works, but the map does not reflect selected region state.
3. The map panel does not contribute to workflow (no click-to-filter behavior).

## 2. Goals

1. Render an explicit Australia map (state/territory boundaries) in the main sector panel.
2. Synchronize selected region (`AU`, `NSW`, `VIC`, `QLD`, `SA`, `WA`, `TAS`, `ACT`, `NT`) with visual highlight state.
3. Allow map interaction: clicking a state updates dashboard region.
4. Preserve current dashboard visual language and responsive behavior.
5. Deliver with TDD discipline and reliable regression coverage.

## 3. Non-Goals (V1)

1. Full GIS/geo-projection stack (Mapbox/Leaflet/deck.gl).
2. Zoom/pan/drag gestures.
3. Live choropleth from quantitative metrics.
4. Capital-city level hit regions (`SYD`, `MEL`, etc.).
5. API contract changes.

## 4. Current State (as of 2026-02-27)

1. Main map section exists at `apps/web/features/dashboard/components/dashboard-shell.tsx` as `.dashboard-map-container`.
2. Region selector state already exists and updates energy/housing panels.
3. Region sync has tests in `apps/web/tests/region-selector-sync.test.tsx`.
4. Map panel visuals are CSS-based overlays in `apps/web/app/styles.css`.

## 5. Users and Key Jobs

### 5.1 Primary User

1. Analyst/operator using the dashboard to compare regional pressure signals.

### 5.2 Jobs-to-be-Done

1. Quickly identify which state is currently selected.
2. Change region directly from the map panel.
3. Keep one consistent region context across housing and energy panels.

## 6. UX Requirements

1. Map appears in center panel beneath existing overlay labels (`SECTOR: AUSTRALIA`, mode, coordinates).
2. Selected region has clear active style (stroke + glow/fill change).
3. Hoverable regions show interactive affordance.
4. `AU` selection shows neutral national state (no single-state active emphasis).
5. Keyboard accessibility:
   - each region shape focusable,
   - `Enter`/`Space` triggers selection,
   - visible focus ring.
6. Mobile/tablet layout keeps map readable and non-overlapping with panel overlays.

## 7. Functional Requirements

1. `FR-MAP-001`: Render Australia map component in main sector area.
2. `FR-MAP-002`: Map consumes existing `region` state from dashboard shell.
3. `FR-MAP-003`: Clicking state polygon calls `setRegion` with matching code.
4. `FR-MAP-004`: Map highlights active region when region changes via selector.
5. `FR-MAP-005`: Region code not represented as a state polygon (`AU`) falls back to national neutral visualization.
6. `FR-MAP-006`: Existing textual sync lines remain visible:
   - `Housing region: {region}`
   - `Energy region: {region}`

## 8. Technical Design

### 8.1 Chosen Implementation (V1)

Use an inline SVG-based component in app layer:

1. Add `AustraliaSectorMap` in `apps/web/features/dashboard/components/australia-sector-map.tsx`.
2. Define static path data per state/territory (WA/NT/SA/QLD/NSW/VIC/TAS/ACT) in a local constant.
3. Drive classes by `active`, `hover`, `focus-visible` states.
4. Wire to `DashboardShell` via props:
   - `region: RegionCode`
   - `onSelectRegion: (region: RegionCode) => void`

### 8.2 Why Inline SVG Instead of Mapping Library

1. Zero new runtime dependencies.
2. Fast initial delivery (1.5-2 day scope).
3. Deterministic rendering and easy unit/component testing.
4. Works with current visual theme and avoids projection complexity.

### 8.3 File Plan

1. Create: `apps/web/features/dashboard/components/australia-sector-map.tsx`
2. Update: `apps/web/features/dashboard/components/dashboard-shell.tsx`
3. Update: `apps/web/app/styles.css`
4. Update/add tests:
   - `apps/web/tests/region-selector-sync.test.tsx`
   - `apps/web/tests/australia-sector-map.test.tsx` (new)

## 9. Data/State Contract

```ts
const REGIONS = ["AU", "NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"] as const;
type RegionCode = (typeof REGIONS)[number];
```

Component contract:

```ts
type AustraliaSectorMapProps = {
  region: RegionCode;
  onSelectRegion: (region: RegionCode) => void;
};
```

Mapping contract:

1. SVG region id must equal canonical region code.
2. Non-state region (`AU`) does not bind to single polygon.

## 10. Observability and Telemetry (Optional V1.1)

V1 can ship without analytics. If enabled later:

1. `map_region_selected` event with `{region_code, source: "map"}`
2. `region_selector_changed` event with `{region_code, source: "dropdown"}`

## 11. Risks and Mitigations

1. Risk: inaccurate/awkward state shapes.
   - Mitigation: use vetted permissive SVG source; normalize viewBox coordinates.
2. Risk: overlay text collides with map on small screens.
   - Mitigation: responsive scale and z-index constraints in `styles.css`.
3. Risk: accessibility regressions.
   - Mitigation: keyboard interaction tests + ARIA labeling per region.
4. Risk: stale tests tied to exact markup.
   - Mitigation: test by role/name + behavior, not brittle class snapshots.

## 12. Delivery Milestones

1. Day 1:
   - RED tests for rendering and region interaction.
   - Introduce component skeleton + map SVG.
2. Day 2:
   - GREEN implementation for selector/map two-way sync.
   - CSS refinement and responsive behavior.
   - Regression test pass and build validation.

## 13. TDD Plan (Mandatory)

Rule: no production map behavior code before failing tests.

### 13.1 Test Stack

1. `vitest`
2. `@testing-library/react`
3. Existing `apps/web` test setup

### 13.2 RED-GREEN Slices

#### Slice 1: Map Rendering Contract

RED tests:

1. renders map landmark/region with accessible name "Australia sector map".
2. renders all state/territory interactive targets (`NSW`, `VIC`, `QLD`, `SA`, `WA`, `TAS`, `ACT`, `NT`).

GREEN code:

1. add `AustraliaSectorMap` with static SVG and accessible labels.

#### Slice 2: Active Region Highlight Contract

RED tests:

1. when `region="VIC"`, VIC target has active state.
2. when `region="AU"`, no state target is marked active.

GREEN code:

1. active class assignment based on `region` prop.

#### Slice 3: Map Interaction Contract

RED tests:

1. clicking `QLD` calls `onSelectRegion("QLD")`.
2. keyboard `Enter`/`Space` on `NSW` calls `onSelectRegion("NSW")`.

GREEN code:

1. pointer and keyboard handlers per region target.

#### Slice 4: Dashboard Integration Contract

RED tests:

1. changing dropdown to `VIC` updates map active region.
2. clicking map region updates text lines:
   - `Housing region: <code>`
   - `Energy region: <code>`
3. clicking map region causes both housing and energy fetch URLs to include selected region.

GREEN code:

1. integrate map component into `DashboardShell` and reuse existing `region` state.

#### Slice 5: Responsive and Regression Contract

RED tests:

1. overlay headings still render (`SECTOR: AUSTRALIA`, `VISUALIZATION_MODE: TOPOGRAPHY`).
2. no regressions to existing priority alerts and dashboard title smoke tests.

GREEN code:

1. finalize CSS layering/responsive tweaks without removing existing overlays.

## 14. Test Cases (Detailed)

1. `TC-MAP-001`: map loads with 8 region targets.
2. `TC-MAP-002`: active class changes when prop changes.
3. `TC-MAP-003`: pointer click dispatches correct region.
4. `TC-MAP-004`: keyboard interaction dispatches correct region.
5. `TC-MAP-005`: dropdown -> map sync works.
6. `TC-MAP-006`: map -> dashboard panel sync works.
7. `TC-MAP-007`: map interactions preserve existing fetch behavior.
8. `TC-MAP-008`: AU mode applies neutral/no-state-active style.
9. `TC-MAP-009`: existing home-page smoke tests stay green.

## 15. Acceptance Criteria

1. User sees recognizable Australia map in center panel.
2. User can select state by map click or keyboard.
3. Selected region stays consistent across:
   - map highlight,
   - housing/energy labels,
   - API requests triggered by region change.
4. Existing dashboard test suite passes.
5. No new runtime dependency required for map rendering.

## 16. Validation Checklist

Run after implementation:

```bash
bun --filter @aus-dash/web test
bun --filter @aus-dash/web build
```

If shared UI primitives are added in future map work:

```bash
bun --filter @aus-dash/ui test
```

## 17. Definition of Done

1. PRD + TDD spec committed.
2. Implementation PR follows RED-GREEN slices.
3. All required map tests added and passing.
4. Regression tests for existing dashboard behavior passing.
5. Build succeeds for `@aus-dash/web`.
