import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSeedLiveStore, resolveLiveStorePath, writeLiveStoreSync } from "@aus-dash/shared";
import { describe, expect, test } from "vitest";
import {
  getEnergyLiveWholesaleFromStore,
  getEnergyRetailAverageFromStore
} from "../src/repositories/live-store-repository";

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

  test("marks regional retail fallback as modeled when only AU data exists", () => {
    const storePath = createCustomStorePath("retail-modeled-fallback");
    const store = createSeedLiveStore();
    store.observations = store.observations.filter(
      (observation) =>
        !(
          observation.regionCode === "VIC" &&
          (observation.seriesId === "energy.retail.offer.annual_bill_aud.mean" ||
            observation.seriesId === "energy.retail.offer.annual_bill_aud.median")
        )
    );
    writeLiveStoreSync(store, storePath);

    const result = getEnergyRetailAverageFromStore("VIC", storePath);

    expect(result.annualBillAudMean).toBeGreaterThan(0);
    expect(result.isModeled).toBe(true);
  });

  test("marks wholesale fallback as modeled when a region falls back to AU", () => {
    const storePath = createCustomStorePath("wholesale-modeled-fallback");
    const store = createSeedLiveStore();
    store.observations = store.observations.filter(
      (observation) =>
        !(
          observation.regionCode === "QLD" &&
          observation.seriesId === "energy.wholesale.rrp.region_aud_mwh"
        )
    );
    writeLiveStoreSync(store, storePath);

    const result = getEnergyLiveWholesaleFromStore("QLD", "5m", storePath);

    expect(result.latest.valueAudMwh).toBeGreaterThan(0);
    expect(result.isModeled).toBe(true);
  });
});
