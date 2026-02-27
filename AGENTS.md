# AGENTS

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
