# Research Report: SVG Map of Australia with State/Territory Boundaries for React

Generated: 2026-03-01

## Executive Summary

The best approach for this project is to use **inline SVG path data** directly embedded in a React/TypeScript component, with no external dependencies. Two proven, MIT/CC-licensed SVG datasets exist with identical path data (sourced from the same Wikimedia Commons original). The `react-australia-map` JSON structure is the most directly usable, containing all 8 states/territories with pre-extracted path data, abbreviation keys, and label positions. For a Next.js 15 + React 19 + Tailwind CSS 4 stack, building a custom inline SVG component is the clear winner over adding any npm package.

## Research Question

What are the best options for getting a high-quality, accurate SVG map of Australia with state/territory boundaries for use in a React web application, covering all 8 states/territories (NSW, VIC, QLD, SA, WA, TAS, NT, ACT)?

---

## Key Findings

### Finding 1: Available SVG Path Data Sources

Three primary sources were identified, all ultimately derived from the same Wikimedia Commons SVG:

| Source | Format | States | Islands | License | Size | Last Updated |
|--------|--------|--------|---------|---------|------|-------------|
| `react-australia-map` | JSON with path data + labels | 8 (combined) | Merged into parent state | MIT | ~33KB paths | 2017 (stable, same paths) |
| `@svg-maps/australia` | SVG/JS with separate island paths | 8 (split into 15 paths) | Separate paths (Groote Eylandt, Melville Is, Fraser Is, Kangaroo Is, Tasmania sub-islands) | CC-BY-SA-4.0 | ~34KB paths | Oct 2025 (v2.0.0) |
| Wikimedia Commons | Raw SVG | 8 | Varies by file | CC-BY-SA-4.0 | 9-58KB | Various |

**Key difference:** `react-australia-map` merges island paths into their parent state (e.g., NT mainland + Groote Eylandt + Melville Island = single "NT" path with multiple `M` commands). `@svg-maps/australia` keeps them separate (e.g., `nt-mainland`, `nt-groote-eylandt`, `nt-melville-island` as distinct paths). For a choropleth where you color entire states, the merged approach is simpler.

- Source: [react-australia-map GitHub](https://github.com/pvoznyuk/react-australia-map) (MIT)
- Source: [@svg-maps/australia npm](https://www.npmjs.com/package/@svg-maps/australia) (CC-BY-SA-4.0)
- Source: [Wikimedia Commons SVG Maps](https://commons.wikimedia.org/wiki/Category:SVG_maps_of_Australia)

### Finding 2: Existing React Packages (Not Recommended for This Project)

Three npm packages were evaluated:

**react-australia-map (v0.1.3)**
- Last published: December 2017
- Peer deps: React 15, prop-types 15.6.0
- Class component, no TypeScript
- Weekly downloads: Low
- Verdict: **Incompatible** with React 19. Uses class components and old React patterns.

**react-aus-map (v1.1.0)**
- Last published: December 2020
- Peer deps: React 17, @material-ui/core 4, clsx
- Written in TypeScript
- Weekly downloads: Low
- Verdict: **Incompatible**. Depends on Material UI v4 (now v6), React 17, and old build tooling.

**@svg-maps/australia (v2.0.0) + react-svg-map**
- Last published: October 2025
- Data-only package (no React dependency)
- Exports a JS object with viewBox, locations array
- Verdict: **Best package option** if you wanted a dependency, but still adds unnecessary overhead when you can inline the paths.

- Source: [react-australia-map npm](https://www.npmjs.com/package/react-australia-map)
- Source: [react-aus-map npm](https://www.npmjs.com/package/react-aus-map)
- Source: [@svg-maps/australia npm](https://www.npmjs.com/package/@svg-maps/australia)

### Finding 3: The react-australia-map Data Structure (Best for Inline Use)

The `react-australia-map` package contains a JSON file (`australia-states-dimensions.json`) that is perfectly structured for a custom React component. Here is the structure:

```typescript
// Each state has: dimensions (SVG path d attribute), abbreviation, and label position
interface StateData {
  dimensions: string;  // SVG path `d` attribute (multiple M commands for islands)
  abbreviation: string;  // "NSW", "VIC", "QLD", etc.
  label: {
    name: string;     // "New South\nWales" (with newline for multi-line labels)
    x: number;        // Label center X position
    y: number;        // Label center Y position
  };
}

// The JSON is keyed by state abbreviation
type AustraliaMapData = Record<string, StateData>;
```

The 8 states are keyed as: `NSW`, `NT`, `QLD`, `WA`, `SA`, `TAS`, `VIC`, `ACT`

The SVG viewBox is `"0 0 290 262"` -- a compact coordinate space that renders well at any size.

**Important:** The paths for NSW already include the ACT cutout within it (via a secondary `M` command in the NSW path data). Both packages handle this correctly -- ACT renders as a small shape inside NSW.

- Source: [react-australia-map data file](https://github.com/pvoznyuk/react-australia-map/blob/master/src/data/australia-states-dimensions.json)

### Finding 4: SVG ViewBox and Coordinate Space

Both sources use nearly identical coordinate spaces:

- `react-australia-map`: viewBox `"0 0 290 262"` (used in the SVG element)
- `@svg-maps/australia`: viewBox `"6.5 4.8 273 252.8"` (slightly cropped, same paths)

The path coordinates are identical between both sources because they derive from the same Wikimedia Commons SVG file (`Australia_map,_States.svg`).

For the React component, using `viewBox="0 0 290 262"` with `preserveAspectRatio="xMidYMid meet"` gives the best responsive behavior.

### Finding 5: Best Practices for Interactive Choropleth in React

Based on research across multiple sources:

**1. Inline SVG is the best approach for this use case:**
- No network requests, no loading states
- CSS transitions work natively on SVG fill/opacity/transform
- TypeScript types are straightforward
- Tree-shakeable (only the paths you use)
- SSR-compatible with Next.js (renders on server, no client-only JS needed)

**2. State coloring pattern:**
```tsx
// Each path gets its fill from a data lookup
<path
  d={stateData.dimensions}
  fill={colorScale(stateValue)}  // e.g., value-based color
  stroke="rgba(255,255,255,0.2)" // subtle white borders for dark theme
  strokeWidth={0.5}
  className="transition-colors duration-200 hover:opacity-80 cursor-pointer"
/>
```

**3. Dark theme considerations:**
- Use transparent/semi-transparent white strokes for borders: `stroke="rgba(255,255,255,0.15)"`
- State fills should use medium-to-high saturation colors on dark backgrounds
- Hover state: reduce opacity or lighten fill
- Empty/no-data states: use a dark gray like `#374151` (Tailwind gray-700)

**4. Tooltip pattern (no extra dependencies):**
```tsx
// Track mouse position + hovered state
const [tooltip, setTooltip] = useState<{state: string; x: number; y: number} | null>(null);

// On each path:
onMouseEnter={(e) => setTooltip({state: key, x: e.clientX, y: e.clientY})}
onMouseLeave={() => setTooltip(null)}

// Render tooltip as absolute-positioned div (NOT inside SVG)
{tooltip && (
  <div style={{left: tooltip.x, top: tooltip.y}} className="fixed ...">
    {tooltip.state}: {formatValue(data[tooltip.state])}
  </div>
)}
```

**5. Responsive sizing:**
```tsx
<svg
  viewBox="0 0 290 262"
  className="w-full h-auto max-w-lg"
  preserveAspectRatio="xMidYMid meet"
>
```

- Source: [Building Choropleth Maps with React and D3.js](https://www.react-graph-gallery.com/choropleth-map)
- Source: [React Simple Maps Styling](https://www.react-simple-maps.io/docs/styling/)
- Source: [How to create SVG maps in React](https://blog.logrocket.com/how-to-create-svg-maps-react-react-simple-maps/)

### Finding 6: GeoJSON/TopoJSON Approach (Alternative, More Complex)

For reference, there are GeoJSON datasets available:
- `rowanhogan/australian-states` - Full GeoJSON (~large file)
- Natural Earth admin-1 boundaries - Can be simplified with mapshaper
- `cartdeco/Australia-json-data` - GeoJSON and TopoJSON

This approach requires `d3-geo` for projection (geoPath) and either `topojson-client` for TopoJSON or direct GeoJSON parsing. It adds ~30KB+ of dependencies and is only worthwhile if you need:
- Proper geographic projection (Mercator, etc.)
- Zooming/panning
- Non-Australia maps too

For a static choropleth of Australian states, the pre-computed SVG paths are far simpler and lighter.

- Source: [rowanhogan/australian-states GitHub](https://github.com/rowanhogan/australian-states)
- Source: [cartdeco/Australia-json-data GitHub](https://github.com/cartdeco/Australia-json-data)

### Finding 7: Wikimedia Commons SVG Files

Several clean SVG maps are available on Wikimedia Commons:

| File | Size | Notes |
|------|------|-------|
| `Australia_states_blank.svg` | 9 KB | Clean, minimal, CC-BY-SA-4.0 |
| `Australia_map,_States-simple.svg` | 16 KB | Simplified coastline |
| `Australia_map,_States.svg` | ~33 KB | Detailed coastline (source for npm packages) |
| `Map_of_Australia_States_-_Grey_with_White_Borders.svg` | Varies | Based on PSMA data, CC-BY-4.0 |
| `Australia_states_and_territories_labelled.svg` | 58 KB | Includes text labels |

The 9 KB `Australia_states_blank.svg` is the most minimal but may lack some coastal detail. The 33 KB `Australia_map,_States.svg` is the one both npm packages use -- it has good detail without being excessive.

- Source: [Wikimedia: Australia states blank SVG](https://commons.wikimedia.org/wiki/File:Australia_states_blank.svg)
- Source: [Wikimedia: Australia map States SVG](https://commons.wikimedia.org/wiki/File:Australia_map,_States.svg)

---

## Codebase Analysis

The project uses:
- **Next.js 15** with React 19
- **Tailwind CSS 4** (via @tailwindcss/postcss)
- **TypeScript** with strict types
- **Vitest** for testing
- No existing map dependencies
- No D3 or geographic libraries

This confirms that the inline SVG approach is ideal -- no need to add D3 or any map library. The component should be a simple TSX file with the path data inlined.

---

## Recommended Implementation

### Recommended Approach: Custom Inline SVG Component

Create a single TypeScript file that contains:

1. **State path data** extracted from `react-australia-map`'s JSON (MIT licensed, freely usable)
2. **A typed React component** that accepts per-state colors/values
3. **CSS transitions** via Tailwind classes for hover effects
4. **Optional tooltip** using native React state (no extra deps)

### Proposed Component API

```typescript
// Types
interface AustraliaMapProps {
  /** Map of state abbreviation to fill color */
  stateColors?: Partial<Record<AustralianState, string>>;
  /** Default fill for states without a specific color */
  defaultFill?: string;
  /** Stroke color for state borders */
  strokeColor?: string;
  /** Called when a state is clicked */
  onStateClick?: (state: AustralianState) => void;
  /** Called when a state is hovered */
  onStateHover?: (state: AustralianState | null) => void;
  /** Additional className for the SVG element */
  className?: string;
}

type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'TAS' | 'NT' | 'ACT';
```

### Key Implementation Details

- ViewBox: `"0 0 290 262"`
- All 8 states have their islands merged into single paths
- ACT is a small path that renders inside NSW (both have the cutout built into their path data)
- Label positions are included in the data for optional state name rendering
- Total inline path data: ~28KB of TypeScript (compresses well with gzip)

---

## Sources

- [react-australia-map GitHub (MIT)](https://github.com/pvoznyuk/react-australia-map) - Path data source
- [@svg-maps/australia npm (CC-BY-SA-4.0)](https://www.npmjs.com/package/@svg-maps/australia) - Alternative path data
- [react-aus-map npm](https://www.npmjs.com/package/react-aus-map) - TypeScript variant (outdated deps)
- [Wikimedia Commons: SVG Maps of Australia](https://commons.wikimedia.org/wiki/Category:SVG_maps_of_Australia) - Original SVG sources
- [Wikimedia: Australia states blank SVG](https://commons.wikimedia.org/wiki/File:Australia_states_blank.svg) - Minimal 9KB version
- [rowanhogan/australian-states](https://github.com/rowanhogan/australian-states) - GeoJSON alternative
- [cartdeco/Australia-json-data](https://github.com/cartdeco/Australia-json-data) - GeoJSON/TopoJSON
- [Building Choropleth Maps with React](https://www.react-graph-gallery.com/choropleth-map) - Best practices
- [React Simple Maps](https://www.react-simple-maps.io/) - Library approach (not recommended for this case)
- [react-svg-map GitHub](https://github.com/VictorCazanave/react-svg-map) - SVG map component patterns

## Recommendations

1. **Use the `react-australia-map` JSON data structure** -- it has the cleanest format for a custom component (states merged with islands, label positions included, MIT license). Do NOT install the package; just extract the path data into your own TypeScript file.

2. **Build a custom `<AustraliaMap>` component** as a single .tsx file with:
   - Inlined SVG path data (~28KB, compresses to ~8KB gzipped)
   - TypeScript types for the 8 states
   - Tailwind CSS classes for dark theme styling and hover transitions
   - Optional callbacks for click/hover interactivity
   - SSR-compatible (no useEffect, no client-only APIs for base render)

3. **For dark theme**: Use semi-transparent white strokes (`rgba(255,255,255,0.15)`), medium-saturation fills, and Tailwind's `transition-colors` for smooth hover effects.

4. **Do NOT use** `react-australia-map`, `react-aus-map`, or `react-simple-maps` as npm dependencies -- they are outdated, have incompatible peer deps, and add unnecessary bundle weight for what amounts to ~28KB of static path data.

5. **Do NOT use** the GeoJSON/D3/TopoJSON approach unless you need geographic projections or zoom/pan -- it adds 30KB+ of runtime dependencies for no benefit in a static choropleth.

## Open Questions

1. **ACT visibility at small sizes**: ACT is very small on the map (~4x4 coordinate units). At mobile sizes, it may be nearly invisible. Consider adding a zoomed inset or enlarging the ACT path slightly for visibility. Alternatively, an annotation/callout pointing to ACT's location could work.

2. **Tasmania positioning**: Tasmania appears south of the mainland with appropriate Bass Strait separation. The Tasmanian paths include Flinders Island, King Island, and Cape Barren Island as separate sub-paths in the `@svg-maps/australia` version but merged in `react-australia-map`.

3. **License compliance**: The `react-australia-map` data is MIT licensed (no attribution required). The `@svg-maps/australia` data is CC-BY-SA-4.0 (requires attribution and share-alike). If using the Wikimedia-derived paths, check whether the MIT relicensing by react-australia-map is valid for your compliance requirements.
