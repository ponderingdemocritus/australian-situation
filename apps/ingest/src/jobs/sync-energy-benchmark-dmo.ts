import {
  createSeedLiveStore
} from "@aus-dash/shared";
import {
  fetchAerRetailPlansSnapshot,
  type AerRetailPlan,
  type SourceFetch
} from "../sources/live-source-clients";
import { resolveIngestBackend } from "../repositories/ingest-backend";
import {
  persistIngestArtifacts
} from "../repositories/ingest-persistence";

const AER_SOURCE_URL = "https://www.aer.gov.au/energy-product-reference-data";

const DMO_PLAN_FIXTURE: AerRetailPlan[] = [
  {
    planId: "dmo-vic-1",
    regionCode: "VIC",
    customerType: "residential",
    annualBillAud: 1890
  },
  {
    planId: "dmo-nsw-1",
    regionCode: "NSW",
    customerType: "residential",
    annualBillAud: 2050
  },
  {
    planId: "dmo-qld-1",
    regionCode: "QLD",
    customerType: "residential",
    annualBillAud: 2015
  }
];

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function buildBenchmarkObservations(plans: AerRetailPlan[], ingestedAt: string) {
  const residential = plans.filter((plan) => plan.customerType === "residential");
  const byRegion = new Map<string, number[]>();
  for (const plan of residential) {
    const existing = byRegion.get(plan.regionCode) ?? [];
    existing.push(plan.annualBillAud);
    byRegion.set(plan.regionCode, existing);
  }

  const regionalMeans = [...byRegion.entries()].map(([regionCode, values]) => ({
    regionCode,
    value: mean(values)
  }));
  const auMean = mean(regionalMeans.map((entry) => entry.value));
  const publishedAt = `${dateOnly(ingestedAt)}T00:00:00Z`;
  const vintage = dateOnly(ingestedAt);

  return [
    {
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "AU",
      countryCode: "AU",
      market: "NEM",
      metricFamily: "retail",
      date: dateOnly(ingestedAt),
      value: auMean,
      unit: "aud",
      currency: "AUD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      sourceName: "AER DMO benchmark (modeled)",
      sourceUrl: AER_SOURCE_URL,
      publishedAt,
      ingestedAt,
      vintage,
      isModeled: true,
      confidence: "derived" as const,
      methodologyVersion: "energy-benchmark-dmo-v1"
    },
    ...regionalMeans.map((entry) => ({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: entry.regionCode,
      countryCode: "AU",
      market: "NEM",
      metricFamily: "retail",
      date: dateOnly(ingestedAt),
      value: entry.value,
      unit: "aud",
      currency: "AUD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      sourceName: "AER DMO benchmark (modeled)",
      sourceUrl: AER_SOURCE_URL,
      publishedAt,
      ingestedAt,
      vintage,
      isModeled: true,
      confidence: "derived" as const,
      methodologyVersion: "energy-benchmark-dmo-v1"
    }))
  ];
}

export type SyncEnergyBenchmarkDmoResult = {
  job: "sync-energy-benchmark-dmo";
  status: "ok";
  pointsIngested: number;
  rowsInserted: number;
  rowsUpdated: number;
  syncedAt: string;
};

type SyncEnergyBenchmarkDmoOptions = {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  aerEndpoint?: string;
  fetchImpl?: SourceFetch;
  ingestBackend?: "store" | "postgres";
};

export async function syncEnergyBenchmarkDmo(
  options: SyncEnergyBenchmarkDmoOptions = {}
): Promise<SyncEnergyBenchmarkDmoResult> {
  const startedAt = new Date().toISOString();
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";

  let plans = DMO_PLAN_FIXTURE;
  let rawPayload = JSON.stringify({ data: DMO_PLAN_FIXTURE });
  if (useLiveSource) {
    const liveSnapshot = await fetchAerRetailPlansSnapshot({
      endpoint: options.aerEndpoint,
      fetchImpl: options.fetchImpl
    });
    plans = liveSnapshot.plans;
    rawPayload = liveSnapshot.rawPayload;
  }

  const observations = buildBenchmarkObservations(plans, ingestedAt);
  const cursor = dateOnly(ingestedAt);

  const upsertResult = await persistIngestArtifacts({
    backend: ingestBackend,
    storePath: options.storePath,
    sourceCatalog: createSeedLiveStore().sources,
    rawSnapshots: [
      {
        sourceId: "aer_prd",
        payload: rawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      }
    ],
    observations,
    sourceCursors: [{ sourceId: "aer_prd", cursor }],
    ingestionRun: {
      job: "sync-energy-benchmark-dmo-daily",
      status: "ok",
      startedAt,
      finishedAt: ingestedAt
    }
  });

  return {
    job: "sync-energy-benchmark-dmo",
    status: "ok",
    pointsIngested: observations.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: ingestedAt
  };
}
