import {
  appendIngestionRun,
  readLiveStoreSync,
  setSourceCursor,
  stageRawPayload,
  upsertObservations,
  writeLiveStoreSync
} from "@aus-dash/shared";
import {
  fetchAbsHousingSnapshot,
  type SourceFetch
} from "../sources/live-source-clients";

export type SyncResult = {
  job: "sync-housing-series";
  status: "ok";
  rowsInserted: number;
  rowsUpdated: number;
  syncedAt: string;
};

type SyncHousingSeriesOptions = {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  absEndpoint?: string;
  fetchImpl?: SourceFetch;
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
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";
  let sourceRows = [...HOUSING_FIXTURE];
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

  const store = readLiveStoreSync(options.storePath);
  stageRawPayload(store, {
    sourceId: "abs_housing",
    payload: rawPayload,
    contentType: "application/json",
    capturedAt: new Date().toISOString()
  });
  const observations = sourceRows.map((observation) => ({
    ...observation,
    sourceName: "ABS",
    sourceUrl:
      "https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide",
    publishedAt: "2026-01-02T00:00:00Z",
    ingestedAt: new Date().toISOString(),
    vintage: "2026-02-27",
    isModeled: false,
    confidence: "official" as const
  }));
  const upsertResult = upsertObservations(store, observations);
  setSourceCursor(store, "abs_housing", "2025-12-31");
  appendIngestionRun(store, {
    job: "sync-housing-abs-daily",
    status: "ok",
    startedAt,
    finishedAt: new Date().toISOString(),
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated
  });
  writeLiveStoreSync(store, options.storePath);

  return {
    job: "sync-housing-series",
    status: "ok",
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: new Date().toISOString()
  };
}
