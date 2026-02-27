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
  type AerRetailPlan,
  selectResidentialPlans
} from "../mappers/aer-prd";
import {
  fetchAerRetailPlansSnapshot,
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

export type SyncEnergyRetailPlansResult = {
  job: "sync-energy-retail-plans";
  status: "ok";
  totalPlansSeen: number;
  residentialPlansIngested: number;
  rowsInserted: number;
  rowsUpdated: number;
  aggregates: {
    annualBillAudMean: number;
    annualBillAudMedian: number;
  };
  syncedAt: string;
};

const PLAN_FIXTURE: AerRetailPlan[] = [
  {
    planId: "nsw-resi-1",
    regionCode: "NSW",
    customerType: "residential",
    annualBillAud: 1910
  },
  {
    planId: "nsw-resi-2",
    regionCode: "NSW",
    customerType: "residential",
    annualBillAud: 2010
  },
  {
    planId: "qld-smb-1",
    regionCode: "QLD",
    customerType: "small_business",
    annualBillAud: 2380
  },
  {
    planId: "vic-resi-1",
    regionCode: "VIC",
    customerType: "residential",
    annualBillAud: 1825
  }
];

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

type SyncEnergyRetailPlansOptions = {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  aerEndpoint?: string;
  fetchImpl?: SourceFetch;
  ingestBackend?: "store" | "postgres";
};

export async function syncEnergyRetailPlans(
  options: SyncEnergyRetailPlansOptions = {}
): Promise<SyncEnergyRetailPlansResult> {
  const startedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";
  let plans = PLAN_FIXTURE;
  let rawPayload = JSON.stringify({ data: PLAN_FIXTURE });
  if (useLiveSource) {
    const liveSnapshot = await fetchAerRetailPlansSnapshot({
      endpoint: options.aerEndpoint,
      fetchImpl: options.fetchImpl
    });
    plans = liveSnapshot.plans;
    rawPayload = liveSnapshot.rawPayload;
  }

  const residentialPlans = selectResidentialPlans(plans);
  const annualBills = residentialPlans.map((plan) => plan.annualBillAud);
  const annualBillAudMean = mean(annualBills);
  const annualBillAudMedian = median(annualBills);

  const observations = [
    {
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "AU",
      date: "2026-02-27",
      value: annualBillAudMean,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: "https://www.aer.gov.au/energy-product-reference-data",
      publishedAt: "2026-02-27T00:00:00Z",
      ingestedAt: new Date().toISOString(),
      vintage: "2026-02-27",
      isModeled: false,
      confidence: "official" as const
    },
    {
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "AU",
      date: "2026-02-27",
      value: annualBillAudMedian,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: "https://www.aer.gov.au/energy-product-reference-data",
      publishedAt: "2026-02-27T00:00:00Z",
      ingestedAt: new Date().toISOString(),
      vintage: "2026-02-27",
      isModeled: false,
      confidence: "official" as const
    }
  ];
  let upsertResult: { inserted: number; updated: number };
  if (ingestBackend === "postgres") {
    await ensureSourceCatalogInPostgres(createSeedLiveStore().sources);
    await stageRawPayloadInPostgres({
      sourceId: "aer_prd",
      payload: rawPayload,
      contentType: "application/json",
      capturedAt: new Date().toISOString()
    });
    upsertResult = await upsertObservationsInPostgres(observations);
    await setSourceCursorInPostgres("aer_prd", "2026-02-27");
    await appendIngestionRunInPostgres({
      job: "sync-energy-retail-prd-hourly",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
  } else {
    const store = readLiveStoreSync(options.storePath);
    stageRawPayload(store, {
      sourceId: "aer_prd",
      payload: rawPayload,
      contentType: "application/json",
      capturedAt: new Date().toISOString()
    });
    upsertResult = upsertObservations(store, observations);
    setSourceCursor(store, "aer_prd", "2026-02-27");
    appendIngestionRun(store, {
      job: "sync-energy-retail-prd-hourly",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
    writeLiveStoreSync(store, options.storePath);
  }

  return {
    job: "sync-energy-retail-plans",
    status: "ok",
    totalPlansSeen: plans.length,
    residentialPlansIngested: residentialPlans.length,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    aggregates: {
      annualBillAudMean,
      annualBillAudMedian
    },
    syncedAt: new Date().toISOString()
  };
}
