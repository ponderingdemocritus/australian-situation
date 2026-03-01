# E2E Test Notes

Playwright uses a local web server by default.

## Default run

```bash
bun --filter @aus-dash/e2e test
```

This starts `@aus-dash/web` with:
- `AUS_DASH_DISABLE_SERVER_PREFETCH=true`
- host/port from Playwright config (default `127.0.0.1:3000`)

## Reuse existing web server

```bash
E2E_USE_EXISTING_SERVER=true bun --filter @aus-dash/e2e test
```

Optional overrides:
- `E2E_WEB_HOST`
- `E2E_WEB_PORT`
- `E2E_BASE_URL`
