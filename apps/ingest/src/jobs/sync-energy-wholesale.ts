type WholesalePoint = {
  regionCode: string;
  timestamp: string;
  rrpAudMwh: number;
  demandMwh: number;
};

export type SyncEnergyWholesaleResult = {
  job: "sync-energy-wholesale";
  status: "ok";
  seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh";
  pointsIngested: number;
  latest: {
    timestamp: string;
    audMwh: number;
    cKwh: number;
  };
  syncedAt: string;
};

const WHOLESALE_FIXTURE: WholesalePoint[] = [
  { regionCode: "NSW", timestamp: "2026-02-27T01:55:00Z", rrpAudMwh: 118, demandMwh: 5000 },
  { regionCode: "VIC", timestamp: "2026-02-27T01:55:00Z", rrpAudMwh: 99, demandMwh: 3000 },
  { regionCode: "QLD", timestamp: "2026-02-27T01:55:00Z", rrpAudMwh: 132, demandMwh: 2700 },
  { regionCode: "SA", timestamp: "2026-02-27T01:55:00Z", rrpAudMwh: 136, demandMwh: 1200 },
  { regionCode: "TAS", timestamp: "2026-02-27T01:55:00Z", rrpAudMwh: 103, demandMwh: 620 },
  { regionCode: "NSW", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 120, demandMwh: 5000 },
  { regionCode: "VIC", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 100, demandMwh: 3000 },
  { regionCode: "QLD", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 140, demandMwh: 2000 },
  { regionCode: "SA", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 138, demandMwh: 1250 },
  { regionCode: "TAS", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 104, demandMwh: 640 }
];

function computeDemandWeightedAudMwh(points: WholesalePoint[]): number {
  const totalDemand = points.reduce((sum, point) => sum + point.demandMwh, 0);
  if (totalDemand <= 0) {
    throw new Error("total demand must be greater than 0");
  }
  return (
    points.reduce((sum, point) => sum + point.rrpAudMwh * point.demandMwh, 0) /
    totalDemand
  );
}

export async function syncEnergyWholesale(): Promise<SyncEnergyWholesaleResult> {
  const timestamps = Array.from(
    new Set(WHOLESALE_FIXTURE.map((point) => point.timestamp))
  ).sort((a, b) => a.localeCompare(b));

  const aggregatedPoints = timestamps.map((timestamp) => {
    const pointsAtTimestamp = WHOLESALE_FIXTURE.filter(
      (point) => point.timestamp === timestamp
    );
    const audMwh = computeDemandWeightedAudMwh(pointsAtTimestamp);
    return {
      timestamp,
      audMwh,
      cKwh: audMwh / 10
    };
  });

  const latest = aggregatedPoints[aggregatedPoints.length - 1];
  if (!latest) {
    throw new Error("no wholesale points to ingest");
  }

  return {
    job: "sync-energy-wholesale",
    status: "ok",
    seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
    pointsIngested: aggregatedPoints.length,
    latest,
    syncedAt: new Date().toISOString()
  };
}
