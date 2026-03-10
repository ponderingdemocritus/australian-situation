import {
  getSourceCatalogItems
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
  persistIngestArtifacts
} from "../repositories/ingest-persistence";
import {
  buildIngestRunAuditFields,
  type IngestRunAuditOptions
} from "./ingest-run-audit";

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

type SyncEnergyRetailGlobalOptions = IngestRunAuditOptions & {
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
  const observationVintage = useLiveSource ? ingestedAt.slice(0, 10) : "2026-02-28";

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
      vintage: observationVintage
    }),
    ...mapEurostatRetailPointsToObservations(eurostatPoints, {
      ingestedAt,
      vintage: observationVintage
    })
  ];

  const latestEia = [...eiaPoints].sort((a, b) => a.period.localeCompare(b.period)).at(-1);
  const latestEurostat = [...eurostatPoints]
    .sort((a, b) => a.period.localeCompare(b.period))
    .at(-1);

  const sourceCursors = [];
  if (latestEia) {
    sourceCursors.push({ sourceId: "eia_electricity", cursor: latestEia.period });
  }
  if (latestEurostat) {
    sourceCursors.push({ sourceId: "eurostat_retail", cursor: latestEurostat.period });
  }

  const upsertResult = await persistIngestArtifacts({
    backend: ingestBackend,
    storePath: options.storePath,
    sourceCatalog: getSourceCatalogItems(),
    rawSnapshots: [
      {
        sourceId: "eia_electricity",
        payload: eiaRawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      },
      {
        sourceId: "eurostat_retail",
        payload: eurostatRawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      }
    ],
    observations,
    sourceCursors,
    ingestionRun: {
      job: "sync-energy-retail-global-daily",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      ...buildIngestRunAuditFields(options)
    }
  });

  return {
    job: "sync-energy-retail-global",
    status: "ok",
    pointsIngested: observations.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: new Date().toISOString()
  };
}
