import {
  appendIngestionRun,
  createSeedLiveStore,
  readLiveStoreSync,
  setSourceCursor,
  stageRawPayload,
  upsertObservations,
  writeLiveStoreSync,
  type SourceCatalogItem
} from "@aus-dash/shared";
import {
  fetchEiaElectricitySnapshot,
  fetchEurostatRetailSnapshot,
  type EiaRetailPricePoint,
  type EurostatRetailPricePoint,
  type SourceFetch
} from "../sources/live-source-clients";
import { mapEiaRetailPointsToObservations, mapEurostatRetailPointsToObservations } from "../mappers/global-energy";
import { resolveIngestBackend } from "../repositories/ingest-backend";
import {
  appendIngestionRunInPostgres,
  ensureSourceCatalogInPostgres,
  setSourceCursorInPostgres,
  stageRawPayloadInPostgres,
  upsertObservationsInPostgres
} from "../repositories/postgres-ingest-repository";

const GLOBAL_SOURCE_CATALOG: SourceCatalogItem[] = [
  {
    sourceId: "eia_electricity",
    domain: "energy",
    name: "US EIA Electricity",
    url: "https://www.eia.gov/opendata/documentation.php",
    expectedCadence: "hourly|monthly"
  },
  {
    sourceId: "eurostat_retail",
    domain: "energy",
    name: "Eurostat Electricity Prices",
    url: "https://ec.europa.eu/eurostat/cache/metadata/en/nrg_pc_204_sims.htm",
    expectedCadence: "semiannual"
  }
];

const EIA_RETAIL_FIXTURE: EiaRetailPricePoint[] = [
  {
    countryCode: "US",
    regionCode: "US",
    period: "2026-01",
    customerType: "residential",
    priceUsdKwh: 0.182
  }
];

const EUROSTAT_RETAIL_FIXTURE: EurostatRetailPricePoint[] = [
  {
    countryCode: "DE",
    period: "2025-S2",
    customerType: "household",
    consumptionBand: "household_mid",
    taxStatus: "incl_tax",
    currency: "EUR",
    priceLocalKwh: 0.319
  }
];

export type SyncEnergyRetailGlobalResult = {
  job: "sync-energy-retail-global";
  status: "ok";
  pointsIngested: number;
  rowsInserted: number;
  rowsUpdated: number;
  syncedAt: string;
};

type SyncEnergyRetailGlobalOptions = {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  eiaEndpoint?: string;
  eurostatEndpoint?: string;
  eiaFetchImpl?: SourceFetch;
  eurostatFetchImpl?: SourceFetch;
  ingestBackend?: "store" | "postgres";
};

export async function syncEnergyRetailGlobal(
  options: SyncEnergyRetailGlobalOptions = {}
): Promise<SyncEnergyRetailGlobalResult> {
  const startedAt = new Date().toISOString();
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";

  let eiaPoints = EIA_RETAIL_FIXTURE;
  let eurostatPoints = EUROSTAT_RETAIL_FIXTURE;
  let eiaRawPayload = JSON.stringify({ retail: EIA_RETAIL_FIXTURE });
  let eurostatRawPayload = JSON.stringify({
    dataset: "nrg_pc_204",
    data: EUROSTAT_RETAIL_FIXTURE
  });

  if (useLiveSource) {
    const [eiaSnapshot, eurostatSnapshot] = await Promise.all([
      fetchEiaElectricitySnapshot({
        endpoint: options.eiaEndpoint,
        fetchImpl: options.eiaFetchImpl
      }),
      fetchEurostatRetailSnapshot({
        endpoint: options.eurostatEndpoint,
        fetchImpl: options.eurostatFetchImpl
      })
    ]);
    eiaPoints = eiaSnapshot.retailPoints;
    eurostatPoints = eurostatSnapshot.points;
    eiaRawPayload = eiaSnapshot.rawPayload;
    eurostatRawPayload = eurostatSnapshot.rawPayload;
  }

  const observations = [
    ...mapEiaRetailPointsToObservations(eiaPoints, {
      ingestedAt,
      vintage: "2026-02-28"
    }),
    ...mapEurostatRetailPointsToObservations(eurostatPoints, {
      ingestedAt,
      vintage: "2026-02-28"
    })
  ];

  const latestEia = [...eiaPoints].sort((a, b) => a.period.localeCompare(b.period)).at(-1);
  const latestEurostat = [...eurostatPoints]
    .sort((a, b) => a.period.localeCompare(b.period))
    .at(-1);

  let upsertResult: { inserted: number; updated: number };
  if (ingestBackend === "postgres") {
    await ensureSourceCatalogInPostgres([
      ...createSeedLiveStore().sources,
      ...GLOBAL_SOURCE_CATALOG
    ]);
    await stageRawPayloadInPostgres({
      sourceId: "eia_electricity",
      payload: eiaRawPayload,
      contentType: "application/json",
      capturedAt: ingestedAt
    });
    await stageRawPayloadInPostgres({
      sourceId: "eurostat_retail",
      payload: eurostatRawPayload,
      contentType: "application/json",
      capturedAt: ingestedAt
    });
    upsertResult = await upsertObservationsInPostgres(observations);
    if (latestEia) {
      await setSourceCursorInPostgres("eia_electricity", latestEia.period);
    }
    if (latestEurostat) {
      await setSourceCursorInPostgres("eurostat_retail", latestEurostat.period);
    }
    await appendIngestionRunInPostgres({
      job: "sync-energy-retail-global-daily",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
  } else {
    const store = readLiveStoreSync(options.storePath);
    stageRawPayload(store, {
      sourceId: "eia_electricity",
      payload: eiaRawPayload,
      contentType: "application/json",
      capturedAt: ingestedAt
    });
    stageRawPayload(store, {
      sourceId: "eurostat_retail",
      payload: eurostatRawPayload,
      contentType: "application/json",
      capturedAt: ingestedAt
    });
    upsertResult = upsertObservations(store, observations);
    if (latestEia) {
      setSourceCursor(store, "eia_electricity", latestEia.period);
    }
    if (latestEurostat) {
      setSourceCursor(store, "eurostat_retail", latestEurostat.period);
    }
    appendIngestionRun(store, {
      job: "sync-energy-retail-global-daily",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
    writeLiveStoreSync(store, options.storePath);
  }

  return {
    job: "sync-energy-retail-global",
    status: "ok",
    pointsIngested: observations.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: new Date().toISOString()
  };
}
