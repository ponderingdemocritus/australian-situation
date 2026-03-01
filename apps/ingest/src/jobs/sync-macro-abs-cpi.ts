import {
  appendIngestionRun,
  createSeedLiveStore,
  type SourceCatalogItem,
  readLiveStoreSync,
  setSourceCursor,
  stageRawPayload,
  upsertObservations,
  writeLiveStoreSync
} from "@aus-dash/shared";
import {
  fetchAbsCpiSnapshot,
  type AbsCpiObservation,
  type SourceFetch
} from "../sources/live-source-clients";
import { resolveIngestBackend } from "../repositories/ingest-backend";
import {
  appendIngestionRunInPostgres,
  ensureSourceCatalogInPostgres,
  setSourceCursorInPostgres,
  stageRawPayloadInPostgres,
  upsertObservationsInPostgres
} from "../repositories/postgres-ingest-repository";

const ABS_CPI_SOURCE_CATALOG: SourceCatalogItem = {
  sourceId: "abs_cpi",
  domain: "macro",
  name: "ABS CPI Electricity",
  url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release",
  expectedCadence: "quarterly"
};

const ABS_CPI_FIXTURE: AbsCpiObservation[] = [
  {
    regionCode: "AU",
    date: "2025-Q4",
    value: 151.2,
    unit: "index"
  },
  {
    regionCode: "VIC",
    date: "2025-Q4",
    value: 148.6,
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

type SyncMacroAbsCpiOptions = {
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
    sourceUrl: ABS_CPI_SOURCE_CATALOG.url,
    publishedAt: ingestedAt,
    ingestedAt,
    vintage: ingestedAt.slice(0, 10),
    isModeled: false,
    confidence: "official" as const,
    methodologyVersion: "macro-abs-cpi-v1"
  }));
  const cursor = [...points].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date;

  let upsertResult: { inserted: number; updated: number };
  if (ingestBackend === "postgres") {
    await ensureSourceCatalogInPostgres([
      ...createSeedLiveStore().sources,
      ABS_CPI_SOURCE_CATALOG
    ]);
    await stageRawPayloadInPostgres({
      sourceId: "abs_cpi",
      payload: rawPayload,
      contentType: "application/json",
      capturedAt: ingestedAt
    });
    upsertResult = await upsertObservationsInPostgres(observations);
    if (cursor) {
      await setSourceCursorInPostgres("abs_cpi", cursor);
    }
    await appendIngestionRunInPostgres({
      job: "sync-macro-abs-cpi-daily",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
  } else {
    const store = readLiveStoreSync(options.storePath);
    stageRawPayload(store, {
      sourceId: "abs_cpi",
      payload: rawPayload,
      contentType: "application/json",
      capturedAt: ingestedAt
    });
    upsertResult = upsertObservations(store, observations);
    if (cursor) {
      setSourceCursor(store, "abs_cpi", cursor);
    }
    appendIngestionRun(store, {
      job: "sync-macro-abs-cpi-daily",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
    writeLiveStoreSync(store, options.storePath);
  }

  return {
    job: "sync-macro-abs-cpi",
    status: "ok",
    pointsIngested: observations.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: new Date().toISOString()
  };
}
