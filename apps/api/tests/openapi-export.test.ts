import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { app } from "../src/app";

describe("OpenAPI export script", () => {
  test("exports the same JSON served by /api/openapi.json", async () => {
    const response = await app.request("http://api.local/api/openapi.json");
    expect(response.status).toBe(200);
    const servedSpec = await response.json();

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-openapi-export-"));
    const outputPath = path.join(tempDir, "openapi.json");
    const result = spawnSync(
      "bun",
      ["scripts/export-openapi.ts", "--output", outputPath],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        encoding: "utf8"
      }
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const exportedSpec = JSON.parse(readFileSync(outputPath, "utf8"));
    expect(exportedSpec).toEqual(servedSpec);
  });
});
