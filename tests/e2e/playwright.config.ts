import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000"
  },
  webServer: {
    command: "bun --filter @aus-dash/web dev -- --port 3000",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: true
  }
});
