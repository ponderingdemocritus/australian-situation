import { describe, expect, test } from "vitest";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";

async function loadSyncEnergyWholesale() {
  try {
    const moduleExports = await import("../src/jobs/sync-energy-wholesale");
    return moduleExports.syncEnergyWholesale;
  } catch {
    return null;
  }
}

describe("syncEnergyWholesale", () => {
  test("returns latest AU weighted wholesale point and ingest stats", async () => {
    const syncEnergyWholesale = await loadSyncEnergyWholesale();
    expect(typeof syncEnergyWholesale).toBe("function");
    if (typeof syncEnergyWholesale !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-wholesale-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));
    const before = readLiveStoreSync(storePath);
    const beforeRunCount = before.ingestionRuns.length;

    const result = await syncEnergyWholesale({ storePath });
    expect(result).toMatchObject({
      job: "sync-energy-wholesale",
      status: "ok",
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      pointsIngested: expect.any(Number),
      rowsInserted: expect.any(Number),
      rowsUpdated: expect.any(Number),
      latest: expect.objectContaining({
        timestamp: expect.any(String),
        audMwh: expect.any(Number),
        cKwh: expect.any(Number)
      }),
      syncedAt: expect.any(String)
    });
    expect(result.pointsIngested).toBeGreaterThan(0);

    const after = readLiveStoreSync(storePath);
    expect(after.ingestionRuns.length).toBe(beforeRunCount + 1);
    expect(
      after.sourceCursors.find((cursor) => cursor.sourceId === "aemo_wholesale")
    ).toBeTruthy();
    expect(
      after.rawSnapshots.find((snapshot) => snapshot.sourceId === "aemo_wholesale")
    ).toBeTruthy();

    const latestWholesaleObservation = after.observations
      .filter(
        (observation) =>
          observation.seriesId === "energy.wholesale.rrp.au_weighted_aud_mwh" &&
          observation.regionCode === "AU"
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    expect(latestWholesaleObservation).toBeTruthy();
    expect(latestWholesaleObservation?.countryCode).toBe("AU");
    expect(latestWholesaleObservation?.market).toBe("NEM");
    expect(latestWholesaleObservation?.metricFamily).toBe("wholesale");
    expect(latestWholesaleObservation?.currency).toBe("AUD");
    expect(latestWholesaleObservation?.methodologyVersion).toBe(
      "energy-wholesale-v1"
    );
  });

  test("supports live mode with injected AEMO fetch source", async () => {
    const syncEnergyWholesale = await loadSyncEnergyWholesale();
    expect(typeof syncEnergyWholesale).toBe("function");
    if (typeof syncEnergyWholesale !== "function") {
      return;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-wholesale-live-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));

    const result = await syncEnergyWholesale({
      storePath,
      sourceMode: "live",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () =>
          [
            "SETTLEMENTDATE,REGIONID,RRP,TOTALDEMAND",
            "2026-02-27T03:00:00Z,NSW1,150,4000",
            "2026-02-27T03:00:00Z,VIC1,100,4000"
          ].join("\n"),
        json: async () => ({})
      })
    });

    expect(result.latest.timestamp).toBe("2026-02-27T03:00:00Z");
    expect(result.latest.audMwh).toBe(125);
    expect(result.latest.cKwh).toBe(12.5);
  });
});
