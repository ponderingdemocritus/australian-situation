import {
  appendIngestionRun,
  createSeedLiveStore,
  type LiveObservation,
  readLiveStoreSync,
  setSourceCursor,
  stageRawPayload,
  upsertObservations,
  writeLiveStoreSync,
  type SourceCatalogItem
} from "@aus-dash/shared";
import {
  fetchWorldBankNormalizationSnapshot,
  type SourceFetch,
  type WorldBankNormalizationPoint
} from "../sources/live-source-clients";
import { mapWorldBankNormalizationPointsToObservations } from "../mappers/global-energy";
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
    sourceId: "world_bank_normalization",
    domain: "macro",
    name: "World Bank Indicators API",
    url: "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation",
    expectedCadence: "annual"
  }
];

const WORLD_BANK_FIXTURE: WorldBankNormalizationPoint[] = [
  {
    countryCode: "AUS",
    year: "2025",
    indicatorCode: "PA.NUS.FCRF",
    value: 1.53
  },
  {
    countryCode: "AUS",
    year: "2025",
    indicatorCode: "PA.NUS.PPP",
    value: 1.44
  },
  {
    countryCode: "USA",
    year: "2025",
    indicatorCode: "PA.NUS.FCRF",
    value: 1
  },
  {
    countryCode: "USA",
    year: "2025",
    indicatorCode: "PA.NUS.PPP",
    value: 1
  },
  {
    countryCode: "DEU",
    year: "2025",
    indicatorCode: "PA.NUS.FCRF",
    value: 0.92
  },
  {
    countryCode: "DEU",
    year: "2025",
    indicatorCode: "PA.NUS.PPP",
    value: 0.83
  }
];

const DEFAULT_AU_HOUSEHOLD_USAGE_KWH = 6000;
const TARGET_COMPARISON_COUNTRIES = new Set(["AU", "US", "DE"]);

const ISO3_TO_ISO2_COUNTRY: Record<string, string> = {
  AUS: "AU",
  USA: "US",
  DEU: "DE"
};

function normalizeCountryCode(code: string | undefined): string | null {
  if (!code) {
    return null;
  }
  const upper = code.trim().toUpperCase();
  if (upper.length === 2) {
    return upper;
  }
  return ISO3_TO_ISO2_COUNTRY[upper] ?? upper;
}

function toFinitePositive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function collectLatestByCountry(
  observations: LiveObservation[],
  predicate: (observation: LiveObservation) => boolean
): Map<string, LiveObservation> {
  const latestByCountry = new Map<string, LiveObservation>();
  for (const observation of observations) {
    if (!predicate(observation)) {
      continue;
    }

    const countryCode = normalizeCountryCode(
      observation.countryCode ?? observation.regionCode
    );
    if (!countryCode) {
      continue;
    }

    const existing = latestByCountry.get(countryCode);
    if (!existing || observation.date > existing.date) {
      latestByCountry.set(countryCode, observation);
    }
  }

  return latestByCountry;
}

function deriveComparisonObservations(
  observations: LiveObservation[],
  options: {
    ingestedAt: string;
    vintage: string;
  }
): LiveObservation[] {
  const derived: LiveObservation[] = [];
  const auUsageKwh = toFinitePositive(
    process.env.AUS_DASH_AU_HOUSEHOLD_USAGE_KWH,
    DEFAULT_AU_HOUSEHOLD_USAGE_KWH
  );

  const fxByCountry = collectLatestByCountry(
    observations,
    (observation) =>
      observation.seriesId === "macro.fx.local_per_usd" && observation.value > 0
  );
  const pppByCountry = collectLatestByCountry(
    observations,
    (observation) =>
      observation.seriesId === "macro.ppp.local_per_usd" && observation.value > 0
  );

  const nominalRetailUsdByCountry = collectLatestByCountry(
    observations,
    (observation) =>
      observation.seriesId === "energy.retail.price.country.usd_kwh_nominal" &&
      (observation.consumptionBand ?? "household_mid") === "household_mid"
  );
  for (const [countryCode, observation] of nominalRetailUsdByCountry.entries()) {
    if (!TARGET_COMPARISON_COUNTRIES.has(countryCode)) {
      continue;
    }
    derived.push({
      ...observation,
      regionCode: countryCode,
      countryCode,
      market: observation.market ?? countryCode,
      metricFamily: "retail",
      unit: "usd_kwh",
      currency: "USD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      ingestedAt: options.ingestedAt,
      vintage: options.vintage,
      isModeled: observation.taxStatus !== "incl_tax" ? true : observation.isModeled,
      confidence: observation.taxStatus !== "incl_tax" ? "derived" : observation.confidence,
      methodologyVersion: "energy-comparison-v1"
    });
  }

  const localRetailByCountry = collectLatestByCountry(
    observations,
    (observation) =>
      observation.seriesId === "energy.retail.price.country.local_kwh" &&
      (observation.consumptionBand ?? "household_mid") === "household_mid"
  );
  for (const [countryCode, observation] of localRetailByCountry.entries()) {
    if (!TARGET_COMPARISON_COUNTRIES.has(countryCode)) {
      continue;
    }
    const fx = fxByCountry.get(countryCode);
    if (!fx || fx.value <= 0) {
      continue;
    }

    derived.push({
      seriesId: "energy.retail.price.country.usd_kwh_nominal",
      regionCode: countryCode,
      countryCode,
      market: observation.market ?? "GLOBAL",
      metricFamily: "retail",
      date: observation.date,
      value: observation.value / fx.value,
      unit: "usd_kwh",
      currency: "USD",
      taxStatus: observation.taxStatus ?? "incl_tax",
      consumptionBand: observation.consumptionBand ?? "household_mid",
      sourceName: `${observation.sourceName} (FX normalized)`,
      sourceUrl: observation.sourceUrl,
      publishedAt: observation.publishedAt,
      ingestedAt: options.ingestedAt,
      vintage: options.vintage,
      isModeled: true,
      confidence: "derived",
      methodologyVersion: "energy-comparison-v1"
    });
  }

  const latestAuRetailMean = [...observations]
    .filter(
      (observation) =>
        observation.seriesId === "energy.retail.offer.annual_bill_aud.mean" &&
        (observation.regionCode === "AU" || observation.countryCode === "AU")
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const auFx = fxByCountry.get("AU");
  if (latestAuRetailMean && auFx && auFx.value > 0) {
    const audKwh = latestAuRetailMean.value / auUsageKwh;
    derived.push({
      seriesId: "energy.retail.price.country.usd_kwh_nominal",
      regionCode: "AU",
      countryCode: "AU",
      market: "NEM",
      metricFamily: "retail",
      date: latestAuRetailMean.date,
      value: audKwh / auFx.value,
      unit: "usd_kwh",
      currency: "USD",
      taxStatus: "incl_tax",
      consumptionBand: "household_mid",
      sourceName: "AER retail annual mean (modeled)",
      sourceUrl: latestAuRetailMean.sourceUrl,
      publishedAt: latestAuRetailMean.publishedAt,
      ingestedAt: options.ingestedAt,
      vintage: options.vintage,
      isModeled: true,
      confidence: "derived",
      methodologyVersion: "energy-comparison-v1"
    });
  }

  const normalizedNominalByCountry = collectLatestByCountry(
    derived,
    (observation) =>
      observation.seriesId === "energy.retail.price.country.usd_kwh_nominal" &&
      (observation.consumptionBand ?? "household_mid") === "household_mid"
  );
  for (const [countryCode, observation] of normalizedNominalByCountry.entries()) {
    if (!TARGET_COMPARISON_COUNTRIES.has(countryCode)) {
      continue;
    }
    const fx = fxByCountry.get(countryCode);
    const ppp = pppByCountry.get(countryCode);
    if (!fx || !ppp || fx.value <= 0 || ppp.value <= 0) {
      continue;
    }

    const localKwh = observation.value * fx.value;
    derived.push({
      ...observation,
      seriesId: "energy.retail.price.country.usd_kwh_ppp",
      value: localKwh / ppp.value,
      unit: "usd_kwh",
      ingestedAt: options.ingestedAt,
      vintage: options.vintage,
      isModeled: true,
      confidence: "derived",
      methodologyVersion: "energy-comparison-v1"
    });
  }

  const localWholesaleByCountry = collectLatestByCountry(
    observations,
    (observation) => observation.seriesId === "energy.wholesale.spot.country.local_mwh"
  );
  for (const [countryCode, observation] of localWholesaleByCountry.entries()) {
    if (!TARGET_COMPARISON_COUNTRIES.has(countryCode)) {
      continue;
    }
    const fx = fxByCountry.get(countryCode);
    if (!fx || fx.value <= 0) {
      continue;
    }

    derived.push({
      seriesId: "energy.wholesale.spot.country.usd_mwh",
      regionCode: countryCode,
      countryCode,
      market: observation.market ?? "GLOBAL",
      metricFamily: "wholesale",
      date: observation.date,
      intervalStartUtc: observation.intervalStartUtc,
      intervalEndUtc: observation.intervalEndUtc,
      value: observation.value / fx.value,
      unit: "usd_mwh",
      currency: "USD",
      sourceName: `${observation.sourceName} (FX normalized)`,
      sourceUrl: observation.sourceUrl,
      publishedAt: observation.publishedAt,
      ingestedAt: options.ingestedAt,
      vintage: options.vintage,
      isModeled: true,
      confidence: "derived",
      methodologyVersion: "energy-comparison-v1"
    });
  }

  const latestAuWholesaleAud = [...observations]
    .filter(
      (observation) =>
        observation.seriesId === "energy.wholesale.rrp.au_weighted_aud_mwh" &&
        (observation.regionCode === "AU" || observation.countryCode === "AU")
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  if (latestAuWholesaleAud && auFx && auFx.value > 0) {
    derived.push({
      seriesId: "energy.wholesale.spot.country.usd_mwh",
      regionCode: "AU",
      countryCode: "AU",
      market: "NEM",
      metricFamily: "wholesale",
      date: latestAuWholesaleAud.date,
      intervalStartUtc: latestAuWholesaleAud.intervalStartUtc,
      intervalEndUtc: latestAuWholesaleAud.intervalEndUtc,
      value: latestAuWholesaleAud.value / auFx.value,
      unit: "usd_mwh",
      currency: "USD",
      sourceName: "AEMO wholesale (FX normalized)",
      sourceUrl: latestAuWholesaleAud.sourceUrl,
      publishedAt: latestAuWholesaleAud.publishedAt,
      ingestedAt: options.ingestedAt,
      vintage: options.vintage,
      isModeled: true,
      confidence: "derived",
      methodologyVersion: "energy-comparison-v1"
    });
  }

  return derived;
}

export type SyncEnergyNormalizationResult = {
  job: "sync-energy-normalization";
  status: "ok";
  pointsIngested: number;
  rowsInserted: number;
  rowsUpdated: number;
  syncedAt: string;
};

type SyncEnergyNormalizationOptions = {
  storePath?: string;
  sourceMode?: "fixture" | "live";
  worldBankEndpoint?: string;
  worldBankFetchImpl?: SourceFetch;
  ingestBackend?: "store" | "postgres";
};

export async function syncEnergyNormalization(
  options: SyncEnergyNormalizationOptions = {}
): Promise<SyncEnergyNormalizationResult> {
  const startedAt = new Date().toISOString();
  const ingestedAt = new Date().toISOString();
  const ingestBackend = resolveIngestBackend(
    options.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND
  );
  const useLiveSource =
    options.sourceMode === "live" || process.env.AUS_DASH_INGEST_LIVE === "true";

  let worldBankPoints = WORLD_BANK_FIXTURE;
  let worldBankRawPayload = JSON.stringify({ data: WORLD_BANK_FIXTURE });
  if (useLiveSource) {
    const worldBankSnapshot = await fetchWorldBankNormalizationSnapshot({
      endpoint: options.worldBankEndpoint,
      fetchImpl: options.worldBankFetchImpl
    });
    worldBankPoints = worldBankSnapshot.points;
    worldBankRawPayload = worldBankSnapshot.rawPayload;
  }

  const observations = mapWorldBankNormalizationPointsToObservations(worldBankPoints, {
    ingestedAt,
    vintage: "2026-02-28"
  });
  const latestYear = [...worldBankPoints]
    .sort((a, b) => a.year.localeCompare(b.year))
    .at(-1)?.year;

  let upsertResult: { inserted: number; updated: number };
  let comparisonDerivedCount = 0;
  if (ingestBackend === "postgres") {
    await ensureSourceCatalogInPostgres([
      ...createSeedLiveStore().sources,
      ...GLOBAL_SOURCE_CATALOG
    ]);
    await stageRawPayloadInPostgres({
      sourceId: "world_bank_normalization",
      payload: worldBankRawPayload,
      contentType: "application/json",
      capturedAt: ingestedAt
    });
    upsertResult = await upsertObservationsInPostgres(observations);
    if (latestYear) {
      await setSourceCursorInPostgres("world_bank_normalization", latestYear);
    }
    await appendIngestionRunInPostgres({
      job: "sync-energy-normalization-daily",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
  } else {
    const store = readLiveStoreSync(options.storePath);
    stageRawPayload(store, {
      sourceId: "world_bank_normalization",
      payload: worldBankRawPayload,
      contentType: "application/json",
      capturedAt: ingestedAt
    });
    upsertResult = upsertObservations(store, observations);
    const comparisonObservations = deriveComparisonObservations(store.observations, {
      ingestedAt,
      vintage: "2026-02-28"
    });
    comparisonDerivedCount = comparisonObservations.length;
    const comparisonUpsertResult = upsertObservations(store, comparisonObservations);
    upsertResult = {
      inserted: upsertResult.inserted + comparisonUpsertResult.inserted,
      updated: upsertResult.updated + comparisonUpsertResult.updated
    };
    if (latestYear) {
      setSourceCursor(store, "world_bank_normalization", latestYear);
    }
    appendIngestionRun(store, {
      job: "sync-energy-normalization-daily",
      status: "ok",
      startedAt,
      finishedAt: new Date().toISOString(),
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated
    });
    writeLiveStoreSync(store, options.storePath);
  }

  return {
    job: "sync-energy-normalization",
    status: "ok",
    pointsIngested: observations.length + comparisonDerivedCount,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    syncedAt: new Date().toISOString()
  };
}
