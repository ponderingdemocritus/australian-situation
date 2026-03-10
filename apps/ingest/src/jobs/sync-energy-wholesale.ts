import {
  getSourceCatalogItems
} from "@aus-dash/shared";
import {
  fetchAemoWholesaleSnapshot,
  type SourceFetch
} from "../sources/live-source-clients";
import { resolveIngestBackend } from "../repositories/ingest-backend";
import {
  persistIngestArtifacts
} from "../repositories/ingest-persistence";
import {
  buildIngestRunAuditFields,
  type IngestRunAuditOptions
} from "./ingest-run-audit";

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
  rowsInserted: number;
  rowsUpdated: number;
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

type SyncEnergyWholesaleOptions = IngestRunAuditOptions & {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  aemoEndpoint?: string;
  fetchImpl?: SourceFetch;
  ingestBackend?: "store" | "postgres";
};

export async function syncEnergyWholesale(
  options: SyncEnergyWholesaleOptions = {}
): Promise<SyncEnergyWholesaleResult> {
  const startedAt = new Date().toISOString();
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";
  const observationVintage = useLiveSource ? ingestedAt.slice(0, 10) : "2026-02-27";
  const sourcePayload =
    "SETTLEMENTDATE,REGIONID,RRP,TOTALDEMAND\n" +
    WHOLESALE_FIXTURE.map((point) =>
      [point.timestamp, `${point.regionCode}1`, point.rrpAudMwh, point.demandMwh].join(",")
    ).join("\n");

  let sourcePoints = WHOLESALE_FIXTURE;
  let rawPayload = sourcePayload;
  if (useLiveSource) {
    const liveSnapshot = await fetchAemoWholesaleSnapshot({
      endpoint: options.aemoEndpoint,
      fetchImpl: options.fetchImpl
    });
    sourcePoints = liveSnapshot.points.map((point) => ({
      regionCode: point.regionCode,
      timestamp: point.timestamp,
      rrpAudMwh: point.rrpAudMwh,
      demandMwh: point.demandMwh
    }));
    rawPayload = liveSnapshot.rawPayload;
  }

  const timestamps = Array.from(
    new Set(sourcePoints.map((point) => point.timestamp))
  ).sort((a, b) => a.localeCompare(b));

  const aggregatedPoints = timestamps.map((timestamp) => {
    const pointsAtTimestamp = sourcePoints.filter(
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

  const observations = aggregatedPoints.map((point) => ({
    seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
    regionCode: "AU",
    countryCode: "AU",
    market: "NEM",
    metricFamily: "wholesale",
    date: point.timestamp,
    intervalStartUtc: point.timestamp,
    intervalEndUtc: point.timestamp,
    value: point.audMwh,
    unit: "aud_mwh",
    currency: "AUD",
    sourceName: "AEMO",
    sourceUrl:
      "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem",
    publishedAt: point.timestamp,
    ingestedAt,
    vintage: observationVintage,
    isModeled: false,
    confidence: "official" as const,
    methodologyVersion: "energy-wholesale-v1"
  }));
  const regionalObservations = sourcePoints.map((point) => ({
    seriesId: "energy.wholesale.rrp.region_aud_mwh",
    regionCode: point.regionCode,
    countryCode: "AU",
    market: point.regionCode,
    metricFamily: "wholesale",
    date: point.timestamp,
    intervalStartUtc: point.timestamp,
    intervalEndUtc: point.timestamp,
    value: point.rrpAudMwh,
    unit: "aud_mwh",
    currency: "AUD",
    sourceName: "AEMO",
    sourceUrl:
      "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem",
    publishedAt: point.timestamp,
    ingestedAt,
    vintage: observationVintage,
    isModeled: false,
    confidence: "official" as const,
    methodologyVersion: "energy-wholesale-v1"
  }));
  const upsertResult = await persistIngestArtifacts({
    backend: ingestBackend,
    storePath: options.storePath,
    sourceCatalog: getSourceCatalogItems(),
    rawSnapshots: [
      {
        sourceId: "aemo_wholesale",
        payload: rawPayload,
        contentType: "text/csv",
        capturedAt: ingestedAt
      }
    ],
    observations: [...observations, ...regionalObservations],
    sourceCursors: [{ sourceId: "aemo_wholesale", cursor: latest.timestamp }],
    ingestionRun: {
      job: "sync-energy-wholesale-5m",
      status: "ok",
      startedAt,
      finishedAt: ingestedAt,
      ...buildIngestRunAuditFields(options)
    }
  });

  return {
    job: "sync-energy-wholesale",
    status: "ok",
    seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
    pointsIngested: aggregatedPoints.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    latest,
    syncedAt: ingestedAt
  };
}
