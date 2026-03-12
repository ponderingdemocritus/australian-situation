import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const packageRoot = path.resolve(import.meta.dirname, "..");
const generatedRoot = path.join(packageRoot, "src/generated");

describe("@aus-dash/sdk generated artifacts", () => {
  test("commits expected generated files and known flat SDK operations", async () => {
    expect(existsSync(path.join(generatedRoot, "client.gen.ts"))).toBe(true);
    expect(existsSync(path.join(generatedRoot, "sdk.gen.ts"))).toBe(true);
    expect(existsSync(path.join(generatedRoot, "types.gen.ts"))).toBe(true);

    const sdk = await import(path.join(generatedRoot, "sdk.gen.ts"));
    expect(sdk).toMatchObject({
      getApiHealth: expect.any(Function),
      getApiMetadataFreshness: expect.any(Function),
      getApiEnergyOverview: expect.any(Function),
      getApiSeriesById: expect.any(Function),
      getApiPricesMajorGoods: expect.any(Function)
    });
  });
});
