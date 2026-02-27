# Housing Control Center (V1) - Implementation Pack

This folder contains the initial implementation planning pack for the Housing V1 module.

Read in this order:

1. `docs/prd-housing-v1.md`
2. `docs/tdd-plan-housing-v1.md`
3. `docs/repo-layout.md`

## Housing + Energy Expansion Pack

For the combined Australia Housing + Energy roadmap and execution:

1. `docs/roadmap-housing-energy.md`
2. `docs/prd-housing-energy-v1.md`
3. `docs/tdd-plan-housing-energy-v1.md`

## Scope defaults chosen

- Geography: Australia only for V1 (`AU`, states, capital cities)
- Frequency: monthly (rates, index) + quarterly (lending)
- Architecture: `Next.js` frontend + `Hono` API + ingestion worker + Postgres
- Pricing depth: national/state/capital city first; suburb-level via licensed feed in V2

## Delivery outcome

V1 is done when:

1. Overview page loads from stored series (no live upstream dependency at request time).
2. Region toggle works for `AU` / state / capital city.
3. Rates + lending + housing index time series are live.
4. Serviceability widget supports saved scenarios.
5. Stress page ships with qualitative watchlist plumbing for future quantitative upgrade.

## Scaffold quickstart

```bash
cd aus-dash
bun install
```

Start services:

```bash
bun run dev:all
```

Run tests:

```bash
bun run test:all
bun run test:all:e2e
```
