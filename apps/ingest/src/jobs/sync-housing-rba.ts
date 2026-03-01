import {
  appendIngestionRun,
  createSeedLiveStore,
  readLiveStoreSync,
  setSourceCursor,
  stageRawPayload,
  upsertObservations,
  writeLiveStoreSync
} from "@aus-dash/shared";
import {
  fetchRbaRatesSnapshot,
  type HousingSeriesObservation,
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

const RBA_SOURCE_URL = "https://www.rba.gov.au/statistics/interest-rates/";

const RBA_FIXTURE: HousingSeriesObservation[] = [
  {
    seriesId: "rates.oo.variable_pct",
    regionCode: "AU",
    date: "2025-12-31",
    value: 6.08,
    unit: "%"
  },
  {
    seriesId: "rates.oo.fixed_pct",
    regionCode: "AU",
    date: "2025-12-31",
    value: 5.79,
    unit: "%"
  }
];

function fixtureCsv(observations: HousingSeriesObservation[]): string {
  const byDate = new Map<string, { variable?: number; fixed?: number }>();
  for (const observation of observations) {
    const existing = byDate.get(observation.date) ?? {};
    if (observation.seriesId === "rates.oo.variable_pct") {
      existing.variable = observation.value;
    } else if (observation.seriesId === "rates.oo.fixed_pct") {
      existing.fixed = observation.value;
    }
    byDate.set(observation.date, existing);
  }

  const rows = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([date, values]) =>
        `${date},${values.variable ?? ""},${values.fixed ?? ""}`
    );
  return ["date,oo_variable_pct,oo_fixed_pct", ...rows].join("\n");
}

export type SyncHousingRbaResult = {
  job: "sync-housing-rba";
  status: "ok";
  pointsIngested: number;
  rowsInserted: number;
  rowsUpdated: number;
  syncedAt: string;
};

type SyncHousingRbaOptions = {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  rbaEndpoint?: string;
  fetchImpl?: SourceFetch;
  ingestBackend?: "store" | "postgres";
};

export async function syncHousingRba(
  options: SyncHousingRbaOptions = {}
): Promise<SyncHousingRbaResult> {
  const startedAt = new Date().toISOString();
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";

  let points = RBA_FIXTURE;
  let rawPayload = fixtureCsv(RBA_FIXTURE);
  if (useLiveSource) {
    const liveSnapshot = await fetchRbaRatesSnapshot({
      endpoint: options.rbaEndpoint,
      fetchImpl: options.fetchImpl
    });
    points = liveSnapshot.observations;
    rawPayload = liveSnapshot.rawPayload;
  }

  const latestDate = [...points].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.date;
  const vintage = latestDate ?? ingestedAt.slice(0, 10);
  const observations = points.map((point) => ({
    ...point,
    sourceName: "RBA",
    sourceUrl: RBA_SOURCE_URL,
    publishedAt: `${point.date}T00:00:00Z`,
    ingestedAt,
    vintage,
    isModeled: false,
    confidence: "official" as const
  }));

  let upsertResult: { inserted: number; updated: number };
  if (ingestBackend === "postgres") {
    await ensureSourceCatalogInPostgres(createSeedLiveStore().sources);
    await stageRawPayloadInPostgres({
      sourceId: "rba_rates",
      payload: rawPayload,
      contentType: "text/csv",
      capturedAt: ingestedAt
    });
    upsertResult = await upsertObservationsInPostgres(observations);
    if (latestDate) {
      await setSourceCursorInPostgres("rba_rates", latestDate);
    }
    await appendIngestionRunInPostgres({
      job: "sync-housing-rba-daily",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
  } else {
    const store = readLiveStoreSync(options.storePath);
    stageRawPayload(store, {
      sourceId: "rba_rates",
      payload: rawPayload,
      contentType: "text/csv",
      capturedAt: ingestedAt
    });
    upsertResult = upsertObservations(store, observations);
    if (latestDate) {
      setSourceCursor(store, "rba_rates", latestDate);
    }
    appendIngestionRun(store, {
      job: "sync-housing-rba-daily",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
    writeLiveStoreSync(store, options.storePath);
  }

  return {
    job: "sync-housing-rba",
    status: "ok",
    pointsIngested: observations.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: new Date().toISOString()
  };
}
