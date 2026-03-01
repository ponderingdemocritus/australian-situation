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
  fetchEntsoeWholesaleSnapshot,
  type EiaWholesalePricePoint,
  type EntsoeWholesalePoint,
  type SourceFetch
} from "../sources/live-source-clients";
import { mapEiaWholesalePointsToObservations, mapEntsoeWholesalePointsToObservations } from "../mappers/global-energy";
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
    sourceId: "entsoe_wholesale",
    domain: "energy",
    name: "ENTSO-E Wholesale",
    url: "https://transparency.entsoe.eu/api",
    expectedCadence: "hourly"
  }
];

const EIA_WHOLESALE_FIXTURE: EiaWholesalePricePoint[] = [
  {
    countryCode: "US",
    regionCode: "ERCOT",
    intervalStartUtc: "2026-02-28T00:00:00Z",
    intervalEndUtc: "2026-02-28T01:00:00Z",
    priceUsdMwh: 67.3
  }
];

const ENTSOE_WHOLESALE_FIXTURE: EntsoeWholesalePoint[] = [
  {
    countryCode: "DE",
    biddingZone: "DE_LU",
    intervalStartUtc: "2026-02-28T00:00:00Z",
    intervalEndUtc: "2026-02-28T01:00:00Z",
    priceEurMwh: 95.4
  }
];

export type SyncEnergyWholesaleGlobalResult = {
  job: "sync-energy-wholesale-global";
  status: "ok";
  pointsIngested: number;
  rowsInserted: number;
  rowsUpdated: number;
  syncedAt: string;
};

type SyncEnergyWholesaleGlobalOptions = {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  eiaEndpoint?: string;
  entsoeEndpoint?: string;
  eiaFetchImpl?: SourceFetch;
  entsoeFetchImpl?: SourceFetch;
  ingestBackend?: "store" | "postgres";
};

export async function syncEnergyWholesaleGlobal(
  options: SyncEnergyWholesaleGlobalOptions = {}
): Promise<SyncEnergyWholesaleGlobalResult> {
  const startedAt = new Date().toISOString();
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";

  let eiaPoints = EIA_WHOLESALE_FIXTURE;
  let entsoePoints = ENTSOE_WHOLESALE_FIXTURE;
  let eiaRawPayload = JSON.stringify({ wholesale: EIA_WHOLESALE_FIXTURE });
  let entsoeRawPayload = JSON.stringify({ data: ENTSOE_WHOLESALE_FIXTURE });

  if (useLiveSource) {
    const [eiaSnapshot, entsoeSnapshot] = await Promise.all([
      fetchEiaElectricitySnapshot({
        endpoint: options.eiaEndpoint,
        fetchImpl: options.eiaFetchImpl
      }),
      fetchEntsoeWholesaleSnapshot({
        endpoint: options.entsoeEndpoint,
        fetchImpl: options.entsoeFetchImpl
      })
    ]);
    eiaPoints = eiaSnapshot.wholesalePoints;
    entsoePoints = entsoeSnapshot.points;
    eiaRawPayload = eiaSnapshot.rawPayload;
    entsoeRawPayload = entsoeSnapshot.rawPayload;
  }

  const observations = [
    ...mapEiaWholesalePointsToObservations(eiaPoints, {
      ingestedAt,
      vintage: "2026-02-28"
    }),
    ...mapEntsoeWholesalePointsToObservations(entsoePoints, {
      ingestedAt,
      vintage: "2026-02-28"
    })
  ];

  const latestEia = [...eiaPoints]
    .sort((a, b) => a.intervalStartUtc.localeCompare(b.intervalStartUtc))
    .at(-1);
  const latestEntsoe = [...entsoePoints]
    .sort((a, b) => a.intervalStartUtc.localeCompare(b.intervalStartUtc))
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
      sourceId: "entsoe_wholesale",
      payload: entsoeRawPayload,
      contentType: "application/json",
      capturedAt: ingestedAt
    });
    upsertResult = await upsertObservationsInPostgres(observations);
    if (latestEia) {
      await setSourceCursorInPostgres("eia_electricity", latestEia.intervalStartUtc);
    }
    if (latestEntsoe) {
      await setSourceCursorInPostgres(
        "entsoe_wholesale",
        latestEntsoe.intervalStartUtc
      );
    }
    await appendIngestionRunInPostgres({
      job: "sync-energy-wholesale-global-hourly",
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
      sourceId: "entsoe_wholesale",
      payload: entsoeRawPayload,
      contentType: "application/json",
      capturedAt: ingestedAt
    });
    upsertResult = upsertObservations(store, observations);
    if (latestEia) {
      setSourceCursor(store, "eia_electricity", latestEia.intervalStartUtc);
    }
    if (latestEntsoe) {
      setSourceCursor(store, "entsoe_wholesale", latestEntsoe.intervalStartUtc);
    }
    appendIngestionRun(store, {
      job: "sync-energy-wholesale-global-hourly",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
    writeLiveStoreSync(store, options.storePath);
  }

  return {
    job: "sync-energy-wholesale-global",
    status: "ok",
    pointsIngested: observations.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: new Date().toISOString()
  };
}
