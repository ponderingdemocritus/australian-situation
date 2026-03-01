import type { LiveObservation } from "@aus-dash/shared";
import type {
  EiaRetailPricePoint,
  EiaWholesalePricePoint,
  EntsoeWholesalePoint,
  EurostatRetailPricePoint,
  WorldBankNormalizationPoint
} from "../sources/live-source-clients";

type MapperOptions = {
  ingestedAt: string;
  vintage: string;
};

const ISO3_TO_ISO2_COUNTRY: Record<string, string> = {
  AUS: "AU",
  USA: "US",
  DEU: "DE"
};

function toPublishedAtFromPeriod(period: string, fallback: string): string {
  if (/^\d{4}-\d{2}$/.test(period)) {
    return `${period}-01T00:00:00Z`;
  }
  if (/^\d{4}$/.test(period)) {
    return `${period}-01-01T00:00:00Z`;
  }
  const parsed = Date.parse(period);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return new Date(parsed).toISOString();
}

function toPublishedAtFromYear(year: string, fallback: string): string {
  if (/^\d{4}$/.test(year)) {
    return `${year}-01-01T00:00:00Z`;
  }
  return fallback;
}

function normalizeCountryCode(code: string): string {
  const upper = code.trim().toUpperCase();
  if (upper.length === 2) {
    return upper;
  }
  return ISO3_TO_ISO2_COUNTRY[upper] ?? upper;
}

export function mapEiaRetailPointsToObservations(
  points: EiaRetailPricePoint[],
  options: MapperOptions
): LiveObservation[] {
  return points.map((point) => ({
    seriesId: "energy.retail.price.country.usd_kwh_nominal",
    regionCode: point.regionCode,
    countryCode: point.countryCode,
    market: "US",
    metricFamily: "retail",
    date: point.period,
    value: point.priceUsdKwh,
    unit: "usd_kwh",
    currency: "USD",
    taxStatus: "mixed",
    consumptionBand:
      point.customerType === "residential" ? "household_mid" : "non_household_small",
    sourceName: "EIA",
    sourceUrl: "https://www.eia.gov/opendata/documentation.php",
    publishedAt: toPublishedAtFromPeriod(point.period, options.ingestedAt),
    ingestedAt: options.ingestedAt,
    vintage: options.vintage,
    isModeled: false,
    confidence: "official",
    methodologyVersion: "energy-global-eia-v1"
  }));
}

export function mapEiaWholesalePointsToObservations(
  points: EiaWholesalePricePoint[],
  options: MapperOptions
): LiveObservation[] {
  return points.map((point) => ({
    seriesId: "energy.wholesale.spot.country.usd_mwh",
    regionCode: point.regionCode,
    countryCode: point.countryCode,
    market: "US",
    metricFamily: "wholesale",
    date: point.intervalStartUtc,
    intervalStartUtc: point.intervalStartUtc,
    intervalEndUtc: point.intervalEndUtc,
    value: point.priceUsdMwh,
    unit: "usd_mwh",
    currency: "USD",
    sourceName: "EIA",
    sourceUrl: "https://www.eia.gov/opendata/documentation.php",
    publishedAt: point.intervalEndUtc,
    ingestedAt: options.ingestedAt,
    vintage: options.vintage,
    isModeled: false,
    confidence: "official",
    methodologyVersion: "energy-global-eia-v1"
  }));
}

export function mapEntsoeWholesalePointsToObservations(
  points: EntsoeWholesalePoint[],
  options: MapperOptions
): LiveObservation[] {
  return points.map((point) => ({
    seriesId: "energy.wholesale.spot.country.local_mwh",
    regionCode: point.biddingZone,
    countryCode: point.countryCode,
    market: "ENTSOE",
    metricFamily: "wholesale",
    date: point.intervalStartUtc,
    intervalStartUtc: point.intervalStartUtc,
    intervalEndUtc: point.intervalEndUtc,
    value: point.priceEurMwh,
    unit: "eur_mwh",
    currency: "EUR",
    sourceName: "ENTSO-E",
    sourceUrl:
      "https://transparencyplatform.zendesk.com/hc/en-us/articles/12845911031188-How-to-get-security-token",
    publishedAt: point.intervalEndUtc,
    ingestedAt: options.ingestedAt,
    vintage: options.vintage,
    isModeled: false,
    confidence: "official",
    methodologyVersion: "energy-global-entsoe-v1"
  }));
}

export function mapEurostatRetailPointsToObservations(
  points: EurostatRetailPricePoint[],
  options: MapperOptions
): LiveObservation[] {
  return points.map((point) => ({
    seriesId: "energy.retail.price.country.local_kwh",
    regionCode: point.countryCode,
    countryCode: point.countryCode,
    market: "EUROSTAT",
    metricFamily: "retail",
    date: point.period,
    value: point.priceLocalKwh,
    unit: "local_kwh",
    currency: point.currency,
    taxStatus: point.taxStatus,
    consumptionBand: point.consumptionBand,
    sourceName: "Eurostat",
    sourceUrl:
      "https://ec.europa.eu/eurostat/cache/metadata/en/nrg_pc_204_sims.htm",
    publishedAt: toPublishedAtFromPeriod(point.period, options.ingestedAt),
    ingestedAt: options.ingestedAt,
    vintage: options.vintage,
    isModeled: false,
    confidence: "official",
    methodologyVersion: "energy-global-eurostat-v1"
  }));
}

export function mapWorldBankNormalizationPointsToObservations(
  points: WorldBankNormalizationPoint[],
  options: MapperOptions
): LiveObservation[] {
  const mapped: LiveObservation[] = [];
  for (const point of points) {
    const countryCode = normalizeCountryCode(point.countryCode);
    const seriesId =
      point.indicatorCode === "PA.NUS.FCRF"
        ? "macro.fx.local_per_usd"
        : point.indicatorCode === "PA.NUS.PPP"
          ? "macro.ppp.local_per_usd"
          : null;
    if (!seriesId) {
      continue;
    }

    mapped.push({
      seriesId,
      regionCode: countryCode,
      countryCode,
      market: "WORLD_BANK",
      metricFamily: "normalization",
      date: point.year,
      value: point.value,
      unit: "local_per_usd",
      currency: "LOCAL",
      sourceName: "World Bank",
      sourceUrl:
        "https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation",
      publishedAt: toPublishedAtFromYear(point.year, options.ingestedAt),
      ingestedAt: options.ingestedAt,
      vintage: options.vintage,
      isModeled: false,
      confidence: "official",
      methodologyVersion: "energy-global-world-bank-v1"
    });
  }

  return mapped;
}
