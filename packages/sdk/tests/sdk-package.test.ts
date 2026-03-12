import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const packageRoot = path.resolve(import.meta.dirname, "..");

describe("@aus-dash/sdk package skeleton", () => {
  test("declares workspace package metadata and a root entrypoint", async () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(packageRoot, "package.json"), "utf8")
    ) as {
      name: string;
      exports: Record<string, string>;
    };

    expect(packageJson.name).toBe("@aus-dash/sdk");
    expect(packageJson.exports["."]).toBe("./src/index.ts");

    const module = await import(path.join(packageRoot, "src/index.ts"));
    expect(Object.keys(module)).toEqual([]);
  });
});
