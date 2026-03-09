import {
  createSeedLiveStore,
} from "@aus-dash/shared";
import {
  fetchAbsHousingSnapshot,
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

export type SyncResult = {
  job: "sync-housing-series";
  status: "ok";
  rowsInserted: number;
  rowsUpdated: number;
  syncedAt: string;
};

type HousingFixtureRow = {
  seriesId: string;
  regionCode: string;
  date: string;
  value: number;
  unit: string;
};

type SyncHousingSeriesOptions = IngestRunAuditOptions & {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  absEndpoint?: string;
  fetchImpl?: SourceFetch;
  ingestBackend?: "store" | "postgres";
};

const HOUSING_FIXTURE = [
  {
    seriesId: "hvi.value.index",
    regionCode: "AU",
    date: "2025-12-31",
    value: 169.4,
    unit: "index"
  },
  {
    seriesId: "lending.avg_loan_size_aud",
    regionCode: "AU",
    date: "2025-12-31",
    value: 736000,
    unit: "aud"
  },
  {
    seriesId: "rates.oo.variable_pct",
    regionCode: "AU",
    date: "2025-12-31",
    value: 6.08,
    unit: "%"
  },
  {
    seriesId: "lending.investor.count",
    regionCode: "AU",
    date: "2025-12-31",
    value: 16950,
    unit: "count"
  },
  {
    seriesId: "hvi.value.index",
    regionCode: "VIC",
    date: "2025-12-31",
    value: 172.4,
    unit: "index"
  },
  {
    seriesId: "lending.avg_loan_size_aud",
    regionCode: "VIC",
    date: "2025-12-31",
    value: 756000,
    unit: "aud"
  },
  {
    seriesId: "rates.oo.variable_pct",
    regionCode: "VIC",
    date: "2025-12-31",
    value: 6.16,
    unit: "%"
  },
  {
    seriesId: "lending.investor.count",
    regionCode: "VIC",
    date: "2025-12-31",
    value: 4180,
    unit: "count"
  }
] as const;

export async function syncHousingSeries(
  options: SyncHousingSeriesOptions = {}
): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";
  let sourceRows: HousingFixtureRow[] = [...HOUSING_FIXTURE];
  let rawPayload = JSON.stringify({ observations: HOUSING_FIXTURE });
  if (useLiveSource) {
    const liveSnapshot = await fetchAbsHousingSnapshot({
      endpoint: options.absEndpoint,
      fetchImpl: options.fetchImpl
    });
    sourceRows = liveSnapshot.observations.map((observation) => ({
      seriesId: observation.seriesId,
      regionCode: observation.regionCode,
      date: observation.date,
      value: observation.value,
      unit: observation.unit
    }));
    rawPayload = liveSnapshot.rawPayload;
  }

  const latestDate = [...sourceRows].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date;
  const vintage = latestDate ?? ingestedAt.slice(0, 10);
  const observations = sourceRows.map((observation) => ({
    ...observation,
    sourceName: "ABS",
    sourceUrl:
      "https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide",
    publishedAt: `${observation.date}T00:00:00Z`,
    ingestedAt,
    vintage,
    isModeled: false,
    confidence: "official" as const
  }));
  const upsertResult = await persistIngestArtifacts({
    backend: ingestBackend,
    storePath: options.storePath,
    sourceCatalog: createSeedLiveStore().sources,
    rawSnapshots: [
      {
        sourceId: "abs_housing",
        payload: rawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      }
    ],
    observations,
    sourceCursors: [{ sourceId: "abs_housing", cursor: latestDate ?? vintage }],
    ingestionRun: {
      job: "sync-housing-abs-daily",
      status: "ok",
      startedAt,
      finishedAt: ingestedAt,
      ...buildIngestRunAuditFields(options)
    }
  });

  return {
    job: "sync-housing-series",
    status: "ok",
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: ingestedAt
  };
}
