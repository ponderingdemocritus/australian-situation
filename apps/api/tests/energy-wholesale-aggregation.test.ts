import { describe, expect, test } from "vitest";

type RegionalRrpPoint = {
  regionCode: string;
  timestamp: string;
  rrpAudMwh: number;
  demandMwh: number;
};

const FIXTURE_POINTS: RegionalRrpPoint[] = [
  { regionCode: "NSW", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 120, demandMwh: 5000 },
  { regionCode: "VIC", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 100, demandMwh: 3000 },
  { regionCode: "QLD", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 140, demandMwh: 2000 }
];

async function loadAggregator() {
  try {
    return await import("../src/domain/energy-wholesale-aggregation");
  } catch {
    return null;
  }
}

describe("computeAuWeightedWholesaleRrp", () => {
  test("computes demand-weighted AU average in aud/mwh and c/kwh", async () => {
    const moduleExports = await loadAggregator();
    const computeAuWeightedWholesaleRrp =
      moduleExports?.computeAuWeightedWholesaleRrp;

    expect(typeof computeAuWeightedWholesaleRrp).toBe("function");
    if (typeof computeAuWeightedWholesaleRrp !== "function") {
      return;
    }

    const result = computeAuWeightedWholesaleRrp(FIXTURE_POINTS, {
      weighting: "demand_weighted"
    });

    expect(result).toMatchObject({
      weighting: "demand_weighted",
      audMwh: expect.any(Number),
      cKwh: expect.any(Number)
    });
    expect(result.audMwh).toBeCloseTo(118, 6);
    expect(result.cKwh).toBeCloseTo(11.8, 6);
  });
});
