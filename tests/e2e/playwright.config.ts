import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const webHost = process.env.E2E_WEB_HOST ?? "127.0.0.1";
const webPort = Number(process.env.E2E_WEB_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://${webHost}:${webPort}`;
const apiHost = process.env.E2E_API_HOST ?? "127.0.0.1";
const apiPort = Number(process.env.E2E_API_PORT ?? 3001);
const apiBaseURL = process.env.E2E_API_BASE_URL ?? `http://${apiHost}:${apiPort}`;
const useExistingServer = process.env.E2E_USE_EXISTING_SERVER === "true";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  testDir: "./specs",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  webServer: useExistingServer
    ? undefined
    : [
        {
          command: `AUS_DASH_STORE_PATH=${repoRoot}/apps/ingest/data/live-store.json bun --filter @aus-dash/api start`,
          url: `${apiBaseURL}/api/health`,
          timeout: 180_000,
          reuseExistingServer: true,
          cwd: repoRoot
        },
        {
          command: `NEXT_PUBLIC_API_BASE_URL=${apiBaseURL} bun --filter @aus-dash/web dev -- --hostname ${webHost} --port ${webPort}`,
          url: baseURL,
          timeout: 180_000,
          reuseExistingServer: true,
          cwd: repoRoot
        }
      ]
});
