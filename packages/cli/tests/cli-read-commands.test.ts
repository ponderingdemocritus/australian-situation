import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getRequestListener } from "@hono/node-server";
import { app } from "../../../apps/api/src/app";

type StartedServer = {
  stop: () => void;
  url: string;
};

const packageRoot = path.resolve(import.meta.dirname, "..");

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();

    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not resolve a free TCP port"));
        return;
      }

      const { port } = address;
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function startServer(): Promise<StartedServer> {
  const port = await getAvailablePort();
  const server = createHttpServer(getRequestListener(app.fetch));

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    stop: () => server.close(),
    url: `http://127.0.0.1:${port}`
  };
}

function runCli(baseUrl: string, args: string[]) {
  return new Promise<{ status: number | null; stderr: string; stdout: string }>((resolve) => {
    const child = spawn("bun", ["src/index.ts", "--base-url", baseUrl, ...args], {
      cwd: packageRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status, stderr, stdout });
    });
  });
}

describe("@aus-dash/cli read commands", () => {
  let server: StartedServer;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(() => {
    server.stop();
  });

  test("prints health as JSON", async () => {
    const result = await runCli(server.url, ["health"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      service: "aus-dash-api",
      status: "ok"
    });
  });

  test("prints metadata freshness as JSON", async () => {
    const result = await runCli(server.url, ["metadata", "freshness"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      generatedAt: expect.any(String),
      series: expect.any(Array),
      staleSeriesCount: expect.any(Number)
    });
  });

  test("prints metadata sources as JSON", async () => {
    const result = await runCli(server.url, ["metadata", "sources"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      generatedAt: expect.any(String),
      sources: expect.any(Array)
    });
  });

  test("prints energy overview as JSON", async () => {
    const result = await runCli(server.url, ["energy", "overview", "--region", "AU"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      region: "AU"
    });
  });

  test("prints energy retail average as JSON", async () => {
    const result = await runCli(server.url, ["energy", "retail-average", "--region", "AU"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      region: "AU"
    });
  });

  test("prints energy live wholesale as JSON", async () => {
    const result = await runCli(server.url, ["energy", "live-wholesale", "--region", "AU"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      region: "AU"
    });
  });

  test("prints series get as JSON", async () => {
    const result = await runCli(server.url, [
      "series",
      "get",
      "energy.wholesale.rrp.au_weighted_aud_mwh",
      "--region",
      "AU"
    ]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      points: expect.any(Array),
      region: "AU",
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh"
    });
  });
});
