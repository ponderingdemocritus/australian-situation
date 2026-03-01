import { defineConfig } from "@playwright/test";

const webHost = process.env.E2E_WEB_HOST ?? "127.0.0.1";
const webPort = Number(process.env.E2E_WEB_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://${webHost}:${webPort}`;
const useExistingServer = process.env.E2E_USE_EXISTING_SERVER === "true";

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
    : {
        command: `AUS_DASH_DISABLE_SERVER_PREFETCH=true bun --filter @aus-dash/web dev -- --hostname ${webHost} --port ${webPort}`,
        url: baseURL,
        timeout: 180_000,
        reuseExistingServer: true
      }
});
