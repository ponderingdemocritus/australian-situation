import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

const packageRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");

describe("@aus-dash/sdk drift checks", () => {
  test("passes when exported OpenAPI and generated SDK artifacts are current", () => {
    const result = spawnSync("bun", ["scripts/check-generated.ts"], {
      cwd: packageRoot,
      encoding: "utf8"
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("reports stale OpenAPI and generated SDK artifacts", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-sdk-check-"));
    const staleOpenApiPath = path.join(tempDir, "openapi.json");
    const staleGeneratedPath = path.join(tempDir, "generated");

    cpSync(path.join(repoRoot, "packages/sdk/src/generated"), staleGeneratedPath, {
      recursive: true
    });
    writeFileSync(
      staleOpenApiPath,
      `${readFileSync(path.join(repoRoot, "apps/api/generated/openapi.json"), "utf8")}\n`,
      "utf8"
    );
    writeFileSync(
      path.join(staleGeneratedPath, "sdk.gen.ts"),
      `${readFileSync(path.join(staleGeneratedPath, "sdk.gen.ts"), "utf8")}\n// stale\n`,
      "utf8"
    );

    const module = (await import(path.join(packageRoot, "scripts/check-generated.ts"))) as {
      checkGeneratedArtifacts?: (options: {
        generatedPath: string;
        openApiPath: string;
      }) => Promise<string[]>;
    };

    expect(typeof module.checkGeneratedArtifacts).toBe("function");

    const issues = await module.checkGeneratedArtifacts?.({
      generatedPath: staleGeneratedPath,
      openApiPath: staleOpenApiPath
    });

    expect(issues).toEqual([
      expect.stringContaining("OpenAPI export is stale"),
      expect.stringContaining("SDK generated artifacts are stale")
    ]);
  });

  test("wires drift checks into root scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8")
    ) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["api:openapi:export"]).toBeTruthy();
    expect(packageJson.scripts["sdk:generate"]).toBeTruthy();
    expect(packageJson.scripts["sdk:check"]).toBeTruthy();
    expect(packageJson.scripts["validate:sdk-cli"]).toContain("sdk:check");
    expect(packageJson.scripts.validate).toContain("sdk:check");
  });
});
