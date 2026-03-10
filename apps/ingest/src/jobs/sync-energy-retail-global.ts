import {
  getSourceCatalogItems
} from "@aus-dash/shared";
import {
  fetchBeijingResidentialTariffSnapshot,
  fetchEiaElectricitySnapshot,
  fetchEurostatRetailSnapshot,
  type BeijingResidentialTariffPoint,
  type EiaRetailPricePoint,
  type EurostatRetailPricePoint,
  fetchPlnRetailTariffSnapshot,
  type PlnRetailTariffPoint,
  type SourceFetch
} from "../sources/live-source-clients";
import {
  mapBeijingResidentialTariffPointsToObservations,
  mapEiaRetailPointsToObservations,
  mapEurostatRetailPointsToObservations,
  mapPlnRetailPointsToObservations
} from "../mappers/global-energy";
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

const PLN_RETAIL_FIXTURE: PlnRetailTariffPoint[] = [
  {
    countryCode: "ID",
    period: "2025-12-12",
    tariffClass: "R-1 (Subsidi)",
    customerType: "residential",
    consumptionBand: "household_low",
    taxStatus: "mixed",
    currency: "IDR",
    priceLocalKwh: 605
  },
  {
    countryCode: "ID",
    period: "2025-12-12",
    tariffClass: "R-1 (Non-Subsidi)",
    customerType: "residential",
    consumptionBand: "household_mid",
    taxStatus: "mixed",
    currency: "IDR",
    priceLocalKwh: 1444.7
  },
  {
    countryCode: "ID",
    period: "2025-12-12",
    tariffClass: "R-2",
    customerType: "residential",
    consumptionBand: "household_high",
    taxStatus: "mixed",
    currency: "IDR",
    priceLocalKwh: 1699.53
  }
];

const BEIJING_RETAIL_PROXY_FIXTURE: BeijingResidentialTariffPoint[] = [
  {
    countryCode: "CN",
    period: "2021-10-25",
    tariffClass: "Residential electricity users",
    customerType: "residential",
    consumptionBand: "household_mid",
    taxStatus: "mixed",
    currency: "CNY",
    priceLocalKwh: 0.4883
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
  plnEndpoint?: string;
  beijingTariffEndpoint?: string;
  eiaFetchImpl?: SourceFetch;
  eurostatFetchImpl?: SourceFetch;
  plnFetchImpl?: SourceFetch;
  beijingTariffFetchImpl?: SourceFetch;
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
  let plnPoints = PLN_RETAIL_FIXTURE;
  let beijingRetailProxyPoints = BEIJING_RETAIL_PROXY_FIXTURE;
  let eiaRawPayload = JSON.stringify({ retail: EIA_RETAIL_FIXTURE });
  let eurostatRawPayload = JSON.stringify({
    dataset: "nrg_pc_204",
    data: EUROSTAT_RETAIL_FIXTURE
  });
  let plnRawPayload = JSON.stringify({
    date: "2025-12-12T14:00:08",
    content: { rendered: "fixture" },
    points: PLN_RETAIL_FIXTURE
  });
  let beijingRetailProxyRawPayload = JSON.stringify({
    source: "beijing_residential_tariff",
    points: BEIJING_RETAIL_PROXY_FIXTURE
  });

  if (useLiveSource) {
    const [eiaSnapshot, eurostatSnapshot, plnSnapshot, beijingRetailProxySnapshot] =
      await Promise.all([
      fetchEiaElectricitySnapshot({
        endpoint: options.eiaEndpoint,
        fetchImpl: options.eiaFetchImpl
      }),
      fetchEurostatRetailSnapshot({
        endpoint: options.eurostatEndpoint,
        fetchImpl: options.eurostatFetchImpl
      }),
      fetchPlnRetailTariffSnapshot({
        endpoint: options.plnEndpoint,
        fetchImpl: options.plnFetchImpl
      }),
      fetchBeijingResidentialTariffSnapshot({
        endpoint: options.beijingTariffEndpoint,
        fetchImpl: options.beijingTariffFetchImpl
      })
      ]);
    eiaPoints = eiaSnapshot.retailPoints;
    eurostatPoints = eurostatSnapshot.points;
    plnPoints = plnSnapshot.points;
    beijingRetailProxyPoints = beijingRetailProxySnapshot.points;
    eiaRawPayload = eiaSnapshot.rawPayload;
    eurostatRawPayload = eurostatSnapshot.rawPayload;
    plnRawPayload = plnSnapshot.rawPayload;
    beijingRetailProxyRawPayload = beijingRetailProxySnapshot.rawPayload;
  }

  const observations = [
    ...mapEiaRetailPointsToObservations(eiaPoints, {
      ingestedAt,
      vintage: observationVintage
    }),
    ...mapEurostatRetailPointsToObservations(eurostatPoints, {
      ingestedAt,
      vintage: observationVintage
    }),
    ...mapPlnRetailPointsToObservations(
      plnPoints.filter((point) => point.consumptionBand === "household_mid"),
      {
      ingestedAt,
      vintage: observationVintage
      }
    ),
    ...mapBeijingResidentialTariffPointsToObservations(beijingRetailProxyPoints, {
      ingestedAt,
      vintage: observationVintage
    })
  ];

  const latestEia = [...eiaPoints].sort((a, b) => a.period.localeCompare(b.period)).at(-1);
  const latestEurostat = [...eurostatPoints]
    .sort((a, b) => a.period.localeCompare(b.period))
    .at(-1);
  const latestPln = [...plnPoints].sort((a, b) => a.period.localeCompare(b.period)).at(-1);
  const latestBeijingRetailProxy = [...beijingRetailProxyPoints]
    .sort((a, b) => a.period.localeCompare(b.period))
    .at(-1);

  const sourceCursors = [];
  if (latestEia) {
    sourceCursors.push({ sourceId: "eia_electricity", cursor: latestEia.period });
  }
  if (latestEurostat) {
    sourceCursors.push({ sourceId: "eurostat_retail", cursor: latestEurostat.period });
  }
  if (latestPln) {
    sourceCursors.push({ sourceId: "pln_tariff", cursor: latestPln.period });
  }
  if (latestBeijingRetailProxy) {
    sourceCursors.push({
      sourceId: "beijing_residential_tariff",
      cursor: latestBeijingRetailProxy.period
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
        sourceId: "eurostat_retail",
        payload: eurostatRawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      },
      {
        sourceId: "pln_tariff",
        payload: plnRawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      },
      {
        sourceId: "beijing_residential_tariff",
        payload: beijingRetailProxyRawPayload,
        contentType: "text/html",
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
