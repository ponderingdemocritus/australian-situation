import {
  getSourceCatalogItems
} from "@aus-dash/shared";
import {
  fetchAbsCpiSnapshot,
  type AbsCpiObservation,
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

const ABS_CPI_SOURCE_URL = getSourceCatalogItems(["abs_cpi"])[0]!.url;

const ABS_CPI_FIXTURE: AbsCpiObservation[] = [
  {
    regionCode: "AU",
    date: "2025-Q4",
    value: 151.2,
    unit: "index"
  },
  {
    regionCode: "NSW",
    date: "2025-Q4",
    value: 152.8,
    unit: "index"
  },
  {
    regionCode: "VIC",
    date: "2025-Q4",
    value: 148.6,
    unit: "index"
  },
  {
    regionCode: "QLD",
    date: "2025-Q4",
    value: 149.9,
    unit: "index"
  },
  {
    regionCode: "SA",
    date: "2025-Q4",
    value: 153.1,
    unit: "index"
  },
  {
    regionCode: "WA",
    date: "2025-Q4",
    value: 147.4,
    unit: "index"
  },
  {
    regionCode: "TAS",
    date: "2025-Q4",
    value: 146.8,
    unit: "index"
  },
  {
    regionCode: "ACT",
    date: "2025-Q4",
    value: 150.5,
    unit: "index"
  },
  {
    regionCode: "NT",
    date: "2025-Q4",
    value: 156.2,
    unit: "index"
  }
];

export type SyncMacroAbsCpiResult = {
  job: "sync-macro-abs-cpi";
  status: "ok";
  pointsIngested: number;
  rowsInserted: number;
  rowsUpdated: number;
  syncedAt: string;
};

type SyncMacroAbsCpiOptions = IngestRunAuditOptions & {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  absCpiEndpoint?: string;
  fetchImpl?: SourceFetch;
  ingestBackend?: "store" | "postgres";
};

export async function syncMacroAbsCpi(
  options: SyncMacroAbsCpiOptions = {}
): Promise<SyncMacroAbsCpiResult> {
  const startedAt = new Date().toISOString();
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";

  let points = ABS_CPI_FIXTURE;
  let rawPayload = JSON.stringify({ observations: ABS_CPI_FIXTURE });
  if (useLiveSource) {
    const liveSnapshot = await fetchAbsCpiSnapshot({
      endpoint: options.absCpiEndpoint,
      fetchImpl: options.fetchImpl
    });
    points = liveSnapshot.observations;
    rawPayload = liveSnapshot.rawPayload;
  }

  const observations = points.map((point) => ({
    seriesId: "energy.cpi.electricity.index",
    regionCode: point.regionCode,
    countryCode: "AU",
    market: "AU",
    metricFamily: "macro",
    date: point.date,
    value: point.value,
    unit: point.unit,
    sourceName: "ABS CPI",
    sourceUrl: ABS_CPI_SOURCE_URL,
    publishedAt: ingestedAt,
    ingestedAt,
    vintage: ingestedAt.slice(0, 10),
    isModeled: false,
    confidence: "official" as const,
    methodologyVersion: "macro-abs-cpi-v1"
  }));
  const cursor = [...points].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date;

  const upsertResult = await persistIngestArtifacts({
    backend: ingestBackend,
    storePath: options.storePath,
    sourceCatalog: getSourceCatalogItems(),
    rawSnapshots: [
      {
        sourceId: "abs_cpi",
        payload: rawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      }
    ],
    observations,
    sourceCursors: cursor ? [{ sourceId: "abs_cpi", cursor }] : [],
    ingestionRun: {
      job: "sync-macro-abs-cpi-daily",
      status: "ok",
      startedAt,
      finishedAt: ingestedAt,
      ...buildIngestRunAuditFields(options)
    }
  });

  return {
    job: "sync-macro-abs-cpi",
    status: "ok",
    pointsIngested: observations.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: ingestedAt
  };
}
