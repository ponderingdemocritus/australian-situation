import { mkdirSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { StartedServer } from "./helpers";
import { startServer } from "./helpers";

const packageRoot = path.resolve(import.meta.dirname, "..");
const sdkRoot = path.resolve(packageRoot, "..", "sdk");

function packPackage(cwd: string, outputDir: string): string {
  const result = spawnSync("npm", ["pack", "--pack-destination", outputDir], {
    cwd,
    encoding: "utf8"
  });

  expect(result.status).toBe(0);

  return path.join(outputDir, result.stdout.trim().split("\n").at(-1) ?? "");
}

function runInstalledCli(
  installDir: string,
  baseUrl: string,
  args: string[]
): Promise<{ status: number | null; stderr: string; stdout: string }> {
  return new Promise((resolve) => {
    const cliBin = path.join(installDir, "node_modules", ".bin", "aus-dash");
    const child = spawn(cliBin, ["--base-url", baseUrl, ...args], {
      cwd: installDir,
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

describe("@aus-dash/cli packaging", () => {
  let server: StartedServer;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(() => {
    server.stop();
  });

  test("packs, installs, and runs the aus-dash binary", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-cli-pack-"));
    const tarballDir = path.join(tempDir, "tarballs");
    const installDir = path.join(tempDir, "install");
    mkdirSync(tarballDir, { recursive: true });
    mkdirSync(installDir, { recursive: true });

    const sdkTarball = packPackage(sdkRoot, tarballDir);
    const cliTarball = packPackage(packageRoot, tarballDir);

    const installResult = spawnSync("npm", ["install", sdkTarball, cliTarball], {
      cwd: installDir,
      encoding: "utf8"
    });

    expect(installResult.status).toBe(0);

    const result = await runInstalledCli(installDir, server.url, ["health"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      service: "aus-dash-api",
      status: "ok"
    });
  });
});
