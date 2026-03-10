import {
  getSourceCatalogItems
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
  persistIngestArtifacts
} from "../repositories/ingest-persistence";
import {
  buildIngestRunAuditFields,
  type IngestRunAuditOptions
} from "./ingest-run-audit";

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
    planId: "vic-resi-1",
    regionCode: "VIC",
    customerType: "residential",
    annualBillAud: 1825
  },
  {
    planId: "vic-resi-2",
    regionCode: "VIC",
    customerType: "residential",
    annualBillAud: 1911
  },
  {
    planId: "qld-resi-1",
    regionCode: "QLD",
    customerType: "residential",
    annualBillAud: 2015
  },
  {
    planId: "sa-resi-1",
    regionCode: "SA",
    customerType: "residential",
    annualBillAud: 2042
  },
  {
    planId: "wa-resi-1",
    regionCode: "WA",
    customerType: "residential",
    annualBillAud: 2148
  },
  {
    planId: "tas-resi-1",
    regionCode: "TAS",
    customerType: "residential",
    annualBillAud: 1887
  },
  {
    planId: "act-resi-1",
    regionCode: "ACT",
    customerType: "residential",
    annualBillAud: 1998
  },
  {
    planId: "nt-resi-1",
    regionCode: "NT",
    customerType: "residential",
    annualBillAud: 2236
  },
  {
    planId: "qld-smb-1",
    regionCode: "QLD",
    customerType: "small_business",
    annualBillAud: 2380
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

function buildRetailObservation(input: {
  seriesId: "energy.retail.offer.annual_bill_aud.mean" | "energy.retail.offer.annual_bill_aud.median";
  regionCode: string;
  observationDate: string;
  intervalStartUtc: string;
  intervalEndUtc: string;
  value: number;
  ingestedAt: string;
}) {
  return {
    seriesId: input.seriesId,
    regionCode: input.regionCode,
    countryCode: "AU",
    market: input.regionCode === "AU" ? "NEM" : input.regionCode,
    metricFamily: "retail",
    date: input.observationDate,
    intervalStartUtc: input.intervalStartUtc,
    intervalEndUtc: input.intervalEndUtc,
    value: input.value,
    unit: "aud",
    currency: "AUD",
    taxStatus: "incl_tax",
    consumptionBand: "household_mid",
    sourceName: "AER",
    sourceUrl: "https://www.aer.gov.au/energy-product-reference-data",
    publishedAt: input.intervalStartUtc,
    ingestedAt: input.ingestedAt,
    vintage: input.observationDate,
    isModeled: false,
    confidence: "official" as const,
    methodologyVersion: "energy-retail-prd-v1"
  };
}

type SyncEnergyRetailPlansOptions = IngestRunAuditOptions & {
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
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";
  const observationDate = useLiveSource ? ingestedAt.slice(0, 10) : "2026-02-27";
  const intervalStartUtc = `${observationDate}T00:00:00Z`;
  const intervalEndUtc = `${observationDate}T23:59:59Z`;
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
  const annualBillsByRegion = new Map<string, number[]>();
  for (const plan of residentialPlans) {
    const existing = annualBillsByRegion.get(plan.regionCode) ?? [];
    existing.push(plan.annualBillAud);
    annualBillsByRegion.set(plan.regionCode, existing);
  }

  const observations = [
    buildRetailObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "AU",
      observationDate,
      intervalStartUtc,
      intervalEndUtc,
      value: annualBillAudMean,
      ingestedAt
    }),
    buildRetailObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "AU",
      observationDate,
      intervalStartUtc,
      intervalEndUtc,
      value: annualBillAudMedian,
      ingestedAt
    }),
    ...[...annualBillsByRegion.entries()]
      .sort(([leftRegion], [rightRegion]) => leftRegion.localeCompare(rightRegion))
      .flatMap(([regionCode, regionalBills]) => [
        buildRetailObservation({
          seriesId: "energy.retail.offer.annual_bill_aud.mean",
          regionCode,
          observationDate,
          intervalStartUtc,
          intervalEndUtc,
          value: mean(regionalBills),
          ingestedAt
        }),
        buildRetailObservation({
          seriesId: "energy.retail.offer.annual_bill_aud.median",
          regionCode,
          observationDate,
          intervalStartUtc,
          intervalEndUtc,
          value: median(regionalBills),
          ingestedAt
        })
      ])
  ];
  const upsertResult = await persistIngestArtifacts({
    backend: ingestBackend,
    storePath: options.storePath,
    sourceCatalog: getSourceCatalogItems(),
    rawSnapshots: [
      {
        sourceId: "aer_prd",
        payload: rawPayload,
        contentType: "application/json",
        capturedAt: ingestedAt
      }
    ],
    observations,
    sourceCursors: [{ sourceId: "aer_prd", cursor: observationDate }],
    ingestionRun: {
      job: "sync-energy-retail-prd-hourly",
      status: "ok",
      startedAt,
      finishedAt: ingestedAt,
      ...buildIngestRunAuditFields(options)
    }
  });

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
    syncedAt: ingestedAt
  };
}
