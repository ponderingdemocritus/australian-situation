# E2E Test Notes

Playwright uses local API and web servers by default.

## Default run

```bash
bun --filter @aus-dash/e2e test
```

This starts:
- `@aus-dash/api` against `apps/ingest/data/live-store.json`
- `@aus-dash/web` with `NEXT_PUBLIC_API_BASE_URL` pointed at that API

The web server uses host/port from Playwright config (default `127.0.0.1:3000`).

## Reuse existing web server

```bash
E2E_USE_EXISTING_SERVER=true bun --filter @aus-dash/e2e test
```

Optional overrides:
- `E2E_WEB_HOST`
- `E2E_WEB_PORT`
- `E2E_BASE_URL`
- `E2E_API_HOST`
- `E2E_API_PORT`
- `E2E_API_BASE_URL`
