import {
  getSourceCatalogItems
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
  persistIngestArtifacts
} from "../repositories/ingest-persistence";
import {
  buildIngestRunAuditFields,
  type IngestRunAuditOptions
} from "./ingest-run-audit";

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

type SyncEnergyWholesaleGlobalOptions = IngestRunAuditOptions & {
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
  const observationVintage = useLiveSource ? ingestedAt.slice(0, 10) : "2026-02-28";

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
      vintage: observationVintage
    }),
    ...mapEntsoeWholesalePointsToObservations(entsoePoints, {
      ingestedAt,
      vintage: observationVintage
    })
  ];

  const latestEia = [...eiaPoints]
    .sort((a, b) => a.intervalStartUtc.localeCompare(b.intervalStartUtc))
    .at(-1);
  const latestEntsoe = [...entsoePoints]
    .sort((a, b) => a.intervalStartUtc.localeCompare(b.intervalStartUtc))
    .at(-1);

  const sourceCursors = [];
  if (latestEia) {
    sourceCursors.push({
      sourceId: "eia_electricity",
      cursor: latestEia.intervalStartUtc
    });
  }
  if (latestEntsoe) {
    sourceCursors.push({
      sourceId: "entsoe_wholesale",
      cursor: latestEntsoe.intervalStartUtc
    });
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
        sourceId: "entsoe_wholesale",
        payload: entsoeRawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      }
    ],
    observations,
    sourceCursors,
    ingestionRun: {
      job: "sync-energy-wholesale-global-hourly",
      status: "ok",
      startedAt,
      finishedAt: ingestedAt,
      ...buildIngestRunAuditFields(options)
    }
  });

  return {
    job: "sync-energy-wholesale-global",
    status: "ok",
    pointsIngested: observations.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: ingestedAt
  };
}
