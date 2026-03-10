# Scalable Dashboard UX PRD + TDD

## 0. Delivery Status

- [ ] Scalable dashboard UX requirements documented.
- [ ] Web tests updated to describe searchable area navigation and area selection behavior.
- [ ] Dashboard shell refactored from a two-tab hero into a scalable area-directory layout.
- [ ] Full web test suite and production build passing.

## 1. Context

The dashboard currently supports two areas, `energy` and `housing`, and switches between them with a small top-row tab set. That works for two areas, but the product is expected to grow to 10 to 20 areas across the economy.

At that scale, a horizontal top-tab pattern stops working because:

1. discovery becomes poor
2. prioritization becomes arbitrary
3. search becomes necessary
4. layout becomes unstable on mobile

This phase should implement a scalable shell for many areas while preserving the existing energy and housing detail modules.

## 2. Problem Statement

The current shell is optimized for two areas and does not scale to an economy-wide product.

Main issues:

1. Area navigation is hardcoded and visually optimized for a tiny set.
2. There is no area directory, grouping, or search.
3. The selected area is buried inside the hero rather than treated as the primary object of navigation.
4. The shell does not communicate how a user should move across many areas of the economy.

## 3. Goals

1. Replace the two-tab navigation model with a scalable area directory.
2. Keep the selected area prominent while making all other areas discoverable.
3. Add search/filtering so a 10 to 20 area list remains usable.
4. Preserve current area switching behavior for energy and housing.
5. Keep the shell generic enough that future areas can be added from metadata instead of more hardcoded UI branches.

## 4. Non-Goals

1. Build all future area modules now.
2. Introduce a brand-new multi-route IA for every area in this pass.
3. Replace the current energy and housing content models.
4. Add personalization, saved views, or advanced area taxonomy management.

## 5. UX Requirements

### R-1 Scalable Area Directory

The dashboard must include a dedicated `Browse areas` panel that can scale to many areas.

Requirements:

1. Show all available areas in one consistent place.
2. Each area entry must include:
   - label
   - short description
   - category/group label
3. The selected area must be clearly highlighted.

### R-2 Searchable Area Navigation

Requirements:

1. Add a search input for the area list.
2. Filtering must happen client-side and update as the user types.
3. Search should match area labels and descriptions.

### R-3 Shared Shell, Variable Area Content

Requirements:

1. The shell must separate navigation from content.
2. The left rail handles area discovery.
3. The main and secondary columns render the selected area’s content.
4. Existing `energy` and `housing` branches continue to work inside the new shell.

### R-4 Data-Driven Area Metadata

Requirements:

1. Move area labels, descriptions, and grouping into a shared area metadata registry.
2. The navigation UI must render from that registry.
3. New areas should be addable by appending metadata rather than editing multiple hardcoded button groups.

### R-5 Mobile Behavior

Requirements:

1. On smaller screens, the area directory must stack ahead of the detail content.
2. Search remains available.
3. Selected area state remains obvious without relying on a wide tab row.

## 6. Acceptance Criteria

1. The dashboard renders a `Browse areas` section.
2. The dashboard renders an area search input.
3. Energy and housing appear as area entries with descriptions.
4. Selecting an area updates the visible content and preserves current URL behavior.
5. Filtering the area list hides non-matching areas without breaking selection.
6. Existing energy and housing detail content still renders correctly under the new shell.

## 7. TDD Plan

### Phase A: Failing UX Tests

1. Update homepage tests to assert the presence of `Browse areas` and the search input.
2. Update area-selection tests to assert area cards/entries instead of the old compact tab strip.
3. Add a test for search filtering in the area directory.
4. Run targeted web tests and confirm failure before implementation.

### Phase B: Implementation

1. Add an area metadata registry.
2. Refactor the dashboard hero and shell to introduce an area rail.
3. Wire search/filter state into the area rail.
4. Keep energy and housing content branches under the new shell.

### Phase C: Verification

1. Run targeted web tests.
2. Run the full `@aus-dash/web` test suite.
3. Run `bun --filter @aus-dash/web build`.

## 8. Test Files In Scope

1. `apps/web/tests/home-page.test.tsx`
2. `apps/web/tests/dashboard-subject-tabs.test.tsx`
3. `apps/web/tests/region-navigation.test.tsx`
4. `apps/web/tests/dashboard-server-prefetch.test.tsx`

## 9. Implementation Notes

1. Keep compatibility with the current selected-area URL query param in this phase.
2. Prefer a new metadata file for areas instead of burying labels/descriptions inside the component.
3. Use the new shell to make future growth cheaper, even if only two areas are active today.
