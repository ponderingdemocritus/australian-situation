# Dashboard Readability PRD + TDD Plan

## 0. Delivery Status

- [ ] Product and readability requirements documented.
- [ ] Web tests updated to protect plain-language copy and subject-specific content.
- [ ] Dashboard shell refactored for readable information hierarchy.
- [ ] Targeted web tests and production build passing.

## 1. Context

The current dashboard reads like an internal terminal console rather than a human-facing product. Live review of the local site showed five structural problems:

1. Subject tabs do not control the full page narrative.
2. System jargon dominates headings, labels, and secondary UI.
3. Type sizes and contrast are too weak for comfortable reading.
4. Layout and scrolling affordances are hidden behind a console-style shell.
5. Decorative console controls add noise without helping users understand the data.

The goal of this work is not a cosmetic reskin. The goal is to make the dashboard easy to read and easy to understand for a non-operator human audience.

## 2. Problem Statement

Users have to decode the UI before they can interpret the data. That cost shows up in three ways:

1. The page uses implementation language instead of explanatory language.
2. The visual hierarchy makes primary metrics, metadata, and secondary details compete equally.
3. Subject selection does not produce a coherent subject-specific page.

Result:

1. New users cannot tell what the page is for at a glance.
2. Returning users have to work too hard to scan updates.
3. Mobile reading degrades sharply because the desktop console metaphor is only stacked, not simplified.

## 3. Goals

1. Replace console framing with a clear reading-first dashboard layout.
2. Use plain-language section titles, metric labels, and metadata labels.
3. Make `Energy` and `Housing` tabs control the main content shown on the page.
4. Improve readability through larger type, stronger contrast, and clearer spacing.
5. Remove decorative controls that imply capabilities the product does not have.
6. Preserve existing data coverage and region selection behavior.

## 4. Non-Goals

1. Add new upstream data sources or API endpoints.
2. Redesign the map interaction model beyond readability and presentation.
3. Introduce a full design system overhaul across unrelated pages.
4. Rework ingest or API contracts unless a UI change requires a bug fix.

## 5. Users

1. General readers trying to understand Australian energy and housing conditions quickly.
2. Stakeholders who need a clear summary before drilling into detail.
3. Mobile users who need the same story without deciphering a compressed desktop console.

## 6. Product Requirements

### R-1 Reading-First Header

The page header must answer three questions immediately:

1. What am I looking at?
2. Which region is selected?
3. How current is the data?

Required changes:

1. Replace breadcrumb-style system text with a page title and short explanatory summary.
2. Keep region selection visible.
3. Show freshness/update context in plain language.

### R-2 Plain-Language Section Labels

Required changes:

1. Replace implementation-facing labels such as `ENERGY_OVERVIEW`, `DATA_HEALTH`, `PROVENANCE`, `STATE_BY_STATE_SOURCE_MIX`, and metric IDs with human-readable copy.
2. Keep methodology and source metadata, but present it as explanation rather than operator telemetry.

### R-3 Subject-Specific Page Content

Required changes:

1. `Energy` must show energy-specific sections such as electricity snapshot, international comparison, and energy mix.
2. `Housing` must hide energy-specific comparison and source-mix sections.
3. `Housing` must show housing-specific summary and data-status sections that match the selected subject.

### R-4 Remove False Console Affordances

Required changes:

1. Remove the live log console panel.
2. Remove the command/filter input.
3. Remove keyboard shortcut footer copy tied to the fake console.

### R-5 Readability Standards

Required changes:

1. Replace the all-monospace body treatment with a more readable display/body pairing.
2. Increase default text sizes for labels, hints, and metadata.
3. Raise contrast for all supporting text used at normal reading sizes.
4. Use spacing, grouping, and card hierarchy to separate primary metrics from secondary metadata.

### R-6 Mobile Reading

Required changes:

1. Mobile layout must stack into a single reading flow.
2. Supporting details must remain readable without terminal-density compression.
3. Hidden scroll regions should be minimized.

## 7. Acceptance Criteria

1. The homepage renders a human-readable title and explanatory summary.
2. The old breadcrumb string and fake command bar are absent.
3. The `Housing` tab does not render energy comparison or source-mix sections.
4. The `Energy` tab renders human-readable energy section headings.
5. Supporting text sizes and contrast are increased in the dashboard stylesheet.
6. Existing region switching and subject query-param behavior continue to work.

## 8. TDD Plan

### Phase A: Copy And Structure Tests

1. Update homepage tests to assert the readable title/summary and absence of the fake console input.
2. Update subject-tab tests to assert that `Housing` removes energy-only sections and that `Energy` shows readable section titles.
3. Run the targeted tests and confirm failure before implementation.

### Phase B: Layout And Styling Implementation

1. Refactor `DashboardShell` to remove console-only panels and introduce subject-specific readable sections.
2. Refactor `styles.css` to establish readable typography, spacing, contrast, and responsive flow.

### Phase C: Verification

1. Run targeted web tests until green.
2. Run the full `@aus-dash/web` test suite.
3. Run `bun --filter @aus-dash/web build`.

## 9. Test List

1. `apps/web/tests/home-page.test.tsx`
2. `apps/web/tests/dashboard-subject-tabs.test.tsx`
3. Existing region-navigation and overview panel tests affected by copy/layout changes.

## 10. Implementation Notes

1. Keep data fetching behavior intact where possible.
2. Prefer additive helper functions over changing API contracts.
3. Hide or remove implementation IDs from the primary UI instead of exposing raw tokens to readers.
