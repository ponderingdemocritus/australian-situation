import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type ObservationConfidence = "official" | "derived" | "qualitative";

export type LiveObservation = {
  seriesId: string;
  regionCode: string;
  countryCode?: string;
  market?: string;
  metricFamily?: string;
  date: string;
  intervalStartUtc?: string;
  intervalEndUtc?: string;
  value: number;
  unit: string;
  currency?: string;
  taxStatus?: string;
  consumptionBand?: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  ingestedAt: string;
  vintage: string;
  isModeled: boolean;
  confidence: ObservationConfidence;
  methodologyVersion?: string;
};

export type SourceCatalogItem = {
  sourceId: string;
  domain: "housing" | "energy" | "macro";
  name: string;
  url: string;
  expectedCadence: string;
};

export type SourceCursor = {
  sourceId: string;
  cursor: string;
  updatedAt: string;
};

export type IngestionRun = {
  runId: string;
  job: string;
  status: "ok" | "failed" | "degraded";
  startedAt: string;
  finishedAt: string;
  rowsInserted: number;
  rowsUpdated: number;
  errorSummary?: string;
};

export type RawSnapshot = {
  snapshotId: string;
  sourceId: string;
  checksumSha256: string;
  capturedAt: string;
  contentType: string;
  payload: string;
};

export type LiveStore = {
  version: 1;
  updatedAt: string;
  observations: LiveObservation[];
  rawSnapshots: RawSnapshot[];
  sources: SourceCatalogItem[];
  sourceCursors: SourceCursor[];
  ingestionRuns: IngestionRun[];
};

export type UpsertResult = {
  inserted: number;
  updated: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function observationKey(observation: LiveObservation): string {
  return [
    observation.seriesId,
    observation.regionCode,
    observation.date,
    observation.vintage
  ].join("|");
}

function makeObservation(
  partial: Omit<LiveObservation, "ingestedAt" | "vintage" | "isModeled" | "confidence"> &
    Partial<
      Pick<LiveObservation, "ingestedAt" | "vintage" | "isModeled" | "confidence">
    >
): LiveObservation {
  return {
    ...partial,
    ingestedAt: partial.ingestedAt ?? "2026-02-27T02:05:00Z",
    vintage: partial.vintage ?? "2026-02-27",
    isModeled: partial.isModeled ?? false,
    confidence: partial.confidence ?? "official"
  };
}

export function createSeedLiveStore(): LiveStore {
  const sourceAbsUrl =
    "https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide";
  const sourceAemoUrl =
    "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem";
  const sourceAerUrl =
    "https://www.aer.gov.au/energy-product-reference-data";
  const sourceRbaUrl =
    "https://www.rba.gov.au/statistics/interest-rates/";

  const observations: LiveObservation[] = [
    makeObservation({
      seriesId: "hvi.value.index",
      regionCode: "AU",
      date: "2025-11-30",
      value: 168.9,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2025-12-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "hvi.value.index",
      regionCode: "AU",
      date: "2025-12-31",
      value: 169.4,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.oo.count",
      regionCode: "AU",
      date: "2025-12-31",
      value: 42580,
      unit: "count",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.oo.value_aud",
      regionCode: "AU",
      date: "2025-12-31",
      value: 27_300_000_000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.investor.count",
      regionCode: "AU",
      date: "2025-12-31",
      value: 16950,
      unit: "count",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.investor.value_aud",
      regionCode: "AU",
      date: "2025-12-31",
      value: 12_150_000_000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.avg_loan_size_aud",
      regionCode: "AU",
      date: "2025-12-31",
      value: 736000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "rates.oo.variable_pct",
      regionCode: "AU",
      date: "2025-12-31",
      value: 6.08,
      unit: "%",
      sourceName: "RBA",
      sourceUrl: sourceRbaUrl,
      publishedAt: "2026-01-05T00:00:00Z"
    }),
    makeObservation({
      seriesId: "rates.oo.fixed_pct",
      regionCode: "AU",
      date: "2025-12-31",
      value: 5.79,
      unit: "%",
      sourceName: "RBA",
      sourceUrl: sourceRbaUrl,
      publishedAt: "2026-01-05T00:00:00Z"
    }),
    makeObservation({
      seriesId: "hvi.value.index",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 172.4,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.oo.count",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 10120,
      unit: "count",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.oo.value_aud",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 7_230_000_000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.investor.count",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 4180,
      unit: "count",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.investor.value_aud",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 3_150_000_000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "lending.avg_loan_size_aud",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 756000,
      unit: "aud",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-02T00:00:00Z"
    }),
    makeObservation({
      seriesId: "rates.oo.variable_pct",
      regionCode: "VIC",
      date: "2025-12-31",
      value: 6.16,
      unit: "%",
      sourceName: "RBA",
      sourceUrl: sourceRbaUrl,
      publishedAt: "2026-01-05T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      regionCode: "AU",
      date: "2026-02-27T01:50:00Z",
      value: 112.6,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: sourceAemoUrl,
      publishedAt: "2026-02-27T01:55:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      regionCode: "AU",
      date: "2026-02-27T01:55:00Z",
      value: 116.9,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: sourceAemoUrl,
      publishedAt: "2026-02-27T02:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      regionCode: "AU",
      date: "2026-02-27T02:00:00Z",
      value: 118,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: sourceAemoUrl,
      publishedAt: "2026-02-27T02:05:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.region_aud_mwh",
      regionCode: "VIC",
      date: "2026-02-27T02:00:00Z",
      value: 100,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: sourceAemoUrl,
      publishedAt: "2026-02-27T02:05:00Z"
    }),
    makeObservation({
      seriesId: "energy.wholesale.rrp.region_aud_mwh",
      regionCode: "NSW",
      date: "2026-02-27T02:00:00Z",
      value: 120,
      unit: "aud_mwh",
      sourceName: "AEMO",
      sourceUrl: sourceAemoUrl,
      publishedAt: "2026-02-27T02:05:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "AU",
      date: "2026-02-27",
      value: 1940,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: sourceAerUrl,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "AU",
      date: "2026-02-27",
      value: 1885,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: sourceAerUrl,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "VIC",
      date: "2026-02-27",
      value: 1868,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: sourceAerUrl,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.retail.offer.annual_bill_aud.median",
      regionCode: "VIC",
      date: "2026-02-27",
      value: 1821,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: sourceAerUrl,
      publishedAt: "2026-02-27T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "AU",
      date: "2025-07-01",
      value: 1985,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: sourceAerUrl,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.benchmark.dmo.annual_bill_aud",
      regionCode: "VIC",
      date: "2025-07-01",
      value: 1890,
      unit: "aud",
      sourceName: "AER",
      sourceUrl: sourceAerUrl,
      publishedAt: "2025-07-01T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "AU",
      date: "2025-Q4",
      value: 151.2,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-31T00:00:00Z"
    }),
    makeObservation({
      seriesId: "energy.cpi.electricity.index",
      regionCode: "VIC",
      date: "2025-Q4",
      value: 148.6,
      unit: "index",
      sourceName: "ABS",
      sourceUrl: sourceAbsUrl,
      publishedAt: "2026-01-31T00:00:00Z"
    })
  ];

  return {
    version: 1,
    updatedAt: "2026-02-27T02:05:00Z",
    observations,
    rawSnapshots: [],
    sources: [
      {
        sourceId: "abs_housing",
        domain: "housing",
        name: "Australian Bureau of Statistics",
        url: sourceAbsUrl,
        expectedCadence: "monthly|quarterly"
      },
      {
        sourceId: "aemo_wholesale",
        domain: "energy",
        name: "AEMO NEM Wholesale",
        url: sourceAemoUrl,
        expectedCadence: "5m"
      },
      {
        sourceId: "aer_prd",
        domain: "energy",
        name: "AER Product Reference Data",
        url: sourceAerUrl,
        expectedCadence: "daily"
      },
      {
        sourceId: "rba_rates",
        domain: "housing",
        name: "RBA Interest Rates",
        url: sourceRbaUrl,
        expectedCadence: "monthly"
      }
    ],
    sourceCursors: [],
    ingestionRuns: []
  };
}

export function resolveLiveStorePath(explicitPath?: string): string {
  if (explicitPath && explicitPath.length > 0) {
    return path.resolve(explicitPath);
  }

  if (process.env.AUS_DASH_STORE_PATH && process.env.AUS_DASH_STORE_PATH.length > 0) {
    return path.resolve(process.env.AUS_DASH_STORE_PATH);
  }

  return path.resolve(process.cwd(), "data/live-store.json");
}

export function writeLiveStoreSync(
  store: LiveStore,
  storePath: string = resolveLiveStorePath()
): void {
  mkdirSync(path.dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function isLiveStore(value: unknown): value is LiveStore {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybe = value as Partial<LiveStore>;
  return (
    maybe.version === 1 &&
    Array.isArray(maybe.observations) &&
    (Array.isArray(maybe.rawSnapshots) || maybe.rawSnapshots === undefined) &&
    Array.isArray(maybe.sources) &&
    Array.isArray(maybe.sourceCursors) &&
    Array.isArray(maybe.ingestionRuns)
  );
}

export function readLiveStoreSync(
  storePath: string = resolveLiveStorePath()
): LiveStore {
  if (!existsSync(storePath)) {
    const seeded = createSeedLiveStore();
    writeLiveStoreSync(seeded, storePath);
    return seeded;
  }

  const content = readFileSync(storePath, "utf8");
  const parsed = JSON.parse(content) as unknown;
  if (!isLiveStore(parsed)) {
    const seeded = createSeedLiveStore();
    writeLiveStoreSync(seeded, storePath);
    return seeded;
  }

  if (Array.isArray(parsed.rawSnapshots)) {
    return parsed;
  }

  // Backfill stores created before raw snapshot support.
  return {
    ...parsed,
    rawSnapshots: []
  };
}

export function upsertObservations(
  store: LiveStore,
  incoming: LiveObservation[]
): UpsertResult {
  const indexByKey = new Map<string, number>();
  store.observations.forEach((observation, index) => {
    indexByKey.set(observationKey(observation), index);
  });

  let inserted = 0;
  let updated = 0;

  for (const nextObservation of incoming) {
    const key = observationKey(nextObservation);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      store.observations.push(nextObservation);
      indexByKey.set(key, store.observations.length - 1);
      inserted += 1;
      continue;
    }

    store.observations[existingIndex] = nextObservation;
    updated += 1;
  }

  if (inserted > 0 || updated > 0) {
    store.updatedAt = nowIso();
  }

  return { inserted, updated };
}

export function setSourceCursor(
  store: LiveStore,
  sourceId: string,
  cursor: string
): void {
  const existing = store.sourceCursors.find((item) => item.sourceId === sourceId);
  if (existing) {
    existing.cursor = cursor;
    existing.updatedAt = nowIso();
    store.updatedAt = existing.updatedAt;
    return;
  }

  const updatedAt = nowIso();
  store.sourceCursors.push({ sourceId, cursor, updatedAt });
  store.updatedAt = updatedAt;
}

export function appendIngestionRun(
  store: LiveStore,
  run: Omit<IngestionRun, "runId">
): IngestionRun {
  const ingestionRun: IngestionRun = {
    runId: `${run.job}-${Date.now()}`,
    ...run
  };
  store.ingestionRuns.push(ingestionRun);
  store.updatedAt = run.finishedAt;
  return ingestionRun;
}

export type StageRawPayloadInput = {
  sourceId: string;
  payload: string;
  contentType: string;
  capturedAt: string;
};

export type StageRawPayloadResult = {
  staged: boolean;
  snapshot: RawSnapshot;
};

export function payloadChecksumSha256(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export function stageRawPayload(
  store: LiveStore,
  input: StageRawPayloadInput
): StageRawPayloadResult {
  const checksumSha256 = payloadChecksumSha256(input.payload);
  const existing = store.rawSnapshots.find(
    (snapshot) =>
      snapshot.sourceId === input.sourceId &&
      snapshot.checksumSha256 === checksumSha256
  );

  if (existing) {
    return {
      staged: false,
      snapshot: existing
    };
  }

  const snapshot: RawSnapshot = {
    snapshotId: `${input.sourceId}-${Date.now()}-${store.rawSnapshots.length + 1}`,
    sourceId: input.sourceId,
    checksumSha256,
    capturedAt: input.capturedAt,
    contentType: input.contentType,
    payload: input.payload
  };
  store.rawSnapshots.push(snapshot);
  store.updatedAt = nowIso();

  return {
    staged: true,
    snapshot
  };
}
