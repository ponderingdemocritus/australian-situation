import {
  getSourceCatalogItems
} from "@aus-dash/shared";
import {
  fetchEiaElectricitySnapshot,
  fetchEntsoeWholesaleSnapshot,
  type EiaWholesalePricePoint,
  type EntsoeWholesalePoint,
  fetchNeaChinaWholesaleProxySnapshot,
  type NeaChinaWholesaleProxyPoint,
  type SourceFetch
} from "../sources/live-source-clients";
import {
  mapEiaWholesalePointsToObservations,
  mapEntsoeWholesalePointsToObservations,
  mapNeaChinaWholesaleProxyPointsToObservations
} from "../mappers/global-energy";
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

const NEA_CHINA_WHOLESALE_PROXY_FIXTURE: NeaChinaWholesaleProxyPoint[] = [
  {
    countryCode: "CN",
    period: "2022",
    priceCnyKwh: 0.449
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
  neaChinaEndpoint?: string;
  eiaFetchImpl?: SourceFetch;
  entsoeFetchImpl?: SourceFetch;
  neaChinaFetchImpl?: SourceFetch;
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
  let neaChinaPoints = NEA_CHINA_WHOLESALE_PROXY_FIXTURE;
  let eiaRawPayload = JSON.stringify({ wholesale: EIA_WHOLESALE_FIXTURE });
  let entsoeRawPayload = JSON.stringify({ data: ENTSOE_WHOLESALE_FIXTURE });
  let neaChinaRawPayload = JSON.stringify({
    source: "nea_china_wholesale_proxy",
    points: NEA_CHINA_WHOLESALE_PROXY_FIXTURE
  });

  if (useLiveSource) {
    const [eiaSnapshot, entsoeSnapshot, neaChinaSnapshot] = await Promise.all([
      fetchEiaElectricitySnapshot({
        endpoint: options.eiaEndpoint,
        fetchImpl: options.eiaFetchImpl
      }),
      fetchEntsoeWholesaleSnapshot({
        endpoint: options.entsoeEndpoint,
        fetchImpl: options.entsoeFetchImpl
      }),
      fetchNeaChinaWholesaleProxySnapshot({
        endpoint: options.neaChinaEndpoint,
        fetchImpl: options.neaChinaFetchImpl
      })
    ]);
    eiaPoints = eiaSnapshot.wholesalePoints;
    entsoePoints = entsoeSnapshot.points;
    neaChinaPoints = neaChinaSnapshot.points;
    eiaRawPayload = eiaSnapshot.rawPayload;
    entsoeRawPayload = entsoeSnapshot.rawPayload;
    neaChinaRawPayload = neaChinaSnapshot.rawPayload;
  }

  const observations = [
    ...mapEiaWholesalePointsToObservations(eiaPoints, {
      ingestedAt,
      vintage: observationVintage
    }),
    ...mapEntsoeWholesalePointsToObservations(entsoePoints, {
      ingestedAt,
      vintage: observationVintage
    }),
    ...mapNeaChinaWholesaleProxyPointsToObservations(neaChinaPoints, {
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
  const latestNeaChina = [...neaChinaPoints].sort((a, b) => a.period.localeCompare(b.period)).at(-1);

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
  if (latestNeaChina) {
    sourceCursors.push({
      sourceId: "nea_china_wholesale_proxy",
      cursor: latestNeaChina.period
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
      },
      {
        sourceId: "nea_china_wholesale_proxy",
        payload: neaChinaRawPayload,
        contentType: "text/html",
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
