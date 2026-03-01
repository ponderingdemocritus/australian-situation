import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSeedLiveStore, resolveLiveStorePath, writeLiveStoreSync } from "@aus-dash/shared";
import { describe, expect, test } from "vitest";
import { getEnergyRetailAverageFromStore } from "../src/repositories/live-store-repository";

function createCustomStorePath(name: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), `aus-dash-api-${name}-`));
  return resolveLiveStorePath(path.join(tempDir, "live-store.json"));
}

describe("store retail average repository", () => {
  test("marks freshness as stale with sentinel updatedAt when retail series is missing", () => {
    const storePath = createCustomStorePath("retail-fallback");
    const store = createSeedLiveStore();
    store.observations = store.observations.filter(
      (observation) =>
        !(
          observation.regionCode === "AU" &&
          (observation.seriesId === "energy.retail.offer.annual_bill_aud.mean" ||
            observation.seriesId === "energy.retail.offer.annual_bill_aud.median")
        )
    );
    writeLiveStoreSync(store, storePath);

    const result = getEnergyRetailAverageFromStore("AU", storePath);

    expect(result.freshness.updatedAt).toBe("1970-01-01");
    expect(result.freshness.status).toBe("stale");
  });
});
