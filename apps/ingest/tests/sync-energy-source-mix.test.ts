import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";

async function loadSyncEnergySourceMix() {
  try {
    return await import("../src/jobs/sync-energy-source-mix");
  } catch {
    return null;
  }
}

describe("energy source mix sync jobs", () => {
  test("persists annual official source mix observations with AU and NT coverage", async () => {
    const moduleExports = await loadSyncEnergySourceMix();
    const syncEnergySourceMixOfficial =
      moduleExports?.syncEnergySourceMixOfficial ?? null;

    expect(typeof syncEnergySourceMixOfficial).toBe("function");
    if (typeof syncEnergySourceMixOfficial !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-source-mix-official-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    const result = await syncEnergySourceMixOfficial({ storePath });
    expect(result).toMatchObject({
      job: "sync-energy-source-mix-official",
      status: "ok",
      pointsIngested: expect.any(Number),
      rowsInserted: expect.any(Number),
      rowsUpdated: expect.any(Number),
      latestPeriod: "2024",
      syncedAt: expect.any(String)
    });
    expect(result.pointsIngested).toBeGreaterThan(0);

    const after = readLiveStoreSync(storePath);
    expect(after.ingestionRuns.length).toBe(beforeRunCount + 1);
    expect(
      after.sourceCursors.find((cursor) => cursor.sourceId === "dcceew_generation_mix")
    ).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "dcceew_generation_mix")
    ).toBeTruthy();

    const auCoalObservation = after.observations.find(
      (observation) =>
        observation.seriesId === "energy.source_mix.official.share_pct.coal" &&
        observation.regionCode === "AU" &&
        observation.date === "2024"
    );
    const ntGasObservation = after.observations.find(
      (observation) =>
        observation.seriesId === "energy.source_mix.official.share_pct.gas" &&
        observation.regionCode === "NT" &&
        observation.date === "2024"
    );

    expect(auCoalObservation).toMatchObject({
      countryCode: "AU",
      market: "annual_official",
      metricFamily: "source_mix",
      unit: "pct",
      methodologyVersion: "energy-source-mix-v1"
    });
    expect(ntGasObservation).toMatchObject({
      countryCode: "AU",
      market: "annual_official",
      metricFamily: "source_mix",
      unit: "pct",
      methodologyVersion: "energy-source-mix-v1"
    });
  });

  test("persists operational source mix observations for NEM, WA, and the derived NEM+WEM aggregate", async () => {
    const moduleExports = await loadSyncEnergySourceMix();
    const syncEnergySourceMixOperational =
      moduleExports?.syncEnergySourceMixOperational ?? null;

    expect(typeof syncEnergySourceMixOperational).toBe("function");
    if (typeof syncEnergySourceMixOperational !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-source-mix-operational-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));

    const result = await syncEnergySourceMixOperational({ storePath });
    expect(result).toMatchObject({
      job: "sync-energy-source-mix-operational",
      status: "ok",
      pointsIngested: expect.any(Number),
      rowsInserted: expect.any(Number),
      rowsUpdated: expect.any(Number),
      latestTimestamp: "2026-02-27T02:00:00Z",
      syncedAt: expect.any(String)
    });
    expect(result.pointsIngested).toBeGreaterThan(0);

    const after = readLiveStoreSync(storePath);
    expect(
      after.sourceCursors.find((cursor) => cursor.sourceId === "aemo_nem_source_mix")
    ).toBeTruthy();
    expect(
      after.sourceCursors.find((cursor) => cursor.sourceId === "aemo_wem_source_mix")
    ).toBeTruthy();

    const waGasObservation = after.observations.find(
      (observation) =>
        observation.seriesId === "energy.source_mix.operational.share_pct.gas" &&
        observation.regionCode === "WA" &&
        observation.date === "2026-02-27T02:00:00Z"
    );
    const auCoalObservation = after.observations.find(
      (observation) =>
        observation.seriesId === "energy.source_mix.operational.share_pct.coal" &&
        observation.regionCode === "AU" &&
        observation.date === "2026-02-27T02:00:00Z"
    );

    expect(waGasObservation).toMatchObject({
      countryCode: "AU",
      market: "WEM",
      metricFamily: "source_mix",
      unit: "pct",
      isModeled: false,
      methodologyVersion: "energy-source-mix-v1"
    });
    expect(auCoalObservation).toMatchObject({
      countryCode: "AU",
      market: "NEM+WEM",
      metricFamily: "source_mix",
      unit: "pct",
      isModeled: true,
      methodologyVersion: "energy-source-mix-v1"
    });
  });
});
