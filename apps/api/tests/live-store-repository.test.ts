import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createSeedLiveStore,
  resolveLiveStorePath,
  writeLiveStoreSync
} from "@aus-dash/shared";
import {
  getEnergyOverviewFromStore,
  getHousingOverviewFromStore
} from "../src/repositories/live-store-repository";

function createCustomStorePath(name: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), `aus-dash-api-${name}-`));
  return resolveLiveStorePath(path.join(tempDir, "live-store.json"));
}

describe("live store repository", () => {
  test("housing overview reads values from store file", () => {
    const storePath = createCustomStorePath("housing");
    const store = createSeedLiveStore();

    const hviIndex = store.observations.find(
      (observation) =>
        observation.seriesId === "hvi.value.index" &&
        observation.regionCode === "AU" &&
        observation.date === "2025-12-31"
    );
    expect(hviIndex).toBeTruthy();
    if (hviIndex) {
      hviIndex.value = 999.9;
    }
    writeLiveStoreSync(store, storePath);

    const overview = getHousingOverviewFromStore("AU", storePath);
    expect(
      overview.metrics.find((metric) => metric.seriesId === "hvi.value.index")?.value
    ).toBe(999.9);
  });

  test("energy overview reads values from store file", () => {
    const storePath = createCustomStorePath("energy");
    const store = createSeedLiveStore();

    const wholesale = store.observations.find(
      (observation) =>
        observation.seriesId === "energy.wholesale.rrp.au_weighted_aud_mwh" &&
        observation.regionCode === "AU" &&
        observation.date === "2026-02-27T02:00:00Z"
    );
    expect(wholesale).toBeTruthy();
    if (wholesale) {
      wholesale.value = 222.2;
    }
    writeLiveStoreSync(store, storePath);

    const overview = getEnergyOverviewFromStore("AU", storePath);
    expect(overview.panels.liveWholesale.valueAudMwh).toBe(222.2);
  });
});
