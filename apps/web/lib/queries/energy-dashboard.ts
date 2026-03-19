import {
  getApiEnergyHouseholdEstimate,
  getApiEnergyLiveWholesale,
  getApiEnergyOverview,
  getApiEnergyRetailAverage,
  getApiV1EnergyCompareRetail,
  getApiV1EnergyCompareWholesale
} from "@aus-dash/sdk";
import {
  formatIsoDate,
  formatOneDecimal,
  formatTwoDecimals,
  formatWholeNumber
} from "../format";
import { createPublicSdkOptions } from "../sdk/public";
import { unwrapSdkData } from "../sdk/unwrap";

export const ENERGY_DASHBOARD_REGIONS = [
  "AU",
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT"
] as const;

export type EnergyDashboardRegion = (typeof ENERGY_DASHBOARD_REGIONS)[number];

export const ENERGY_DASHBOARD_REGION_LABELS: Record<EnergyDashboardRegion, string> = {
  AU: "Australia",
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  SA: "South Australia",
  WA: "Western Australia",
  TAS: "Tasmania",
  NT: "Northern Territory",
  ACT: "Australian Capital Territory"
};

const UNSUPPORTED_LIVE_WHOLESALE_REGIONS = new Set<EnergyDashboardRegion>(["WA", "NT", "ACT"]);

type Metric = {
  detail: string;
  label: string;
  value: string;
};

type ComparisonRow = {
  countryCode: string;
  rank: string;
  updatedAt: string;
  value: string;
};

type NationalComparison = {
  detail: string;
  peerGaps: string[];
  rows: ComparisonRow[];
  summary: string;
  title: string;
};

type MixSummary = {
  coverage: string;
  title: string;
  topRows: string[];
  updatedAt: string;
};

export type EnergyDashboardModel = {
  hero: {
    summary: string;
    title: string;
  };
  householdEstimate: Metric;
  liveWholesale: Metric;
  metrics: Metric[];
  mixes: MixSummary[];
  nationalComparisons: NationalComparison[];
  region: EnergyDashboardRegion;
  regionLabel: string;
  retailAverage: Metric;
};

export function normalizeEnergyDashboardRegion(
  region?: string
): EnergyDashboardRegion {
  if (!region) {
    return "AU";
  }

  const upperRegion = region.toUpperCase();
  return ENERGY_DASHBOARD_REGIONS.includes(upperRegion as EnergyDashboardRegion)
    ? (upperRegion as EnergyDashboardRegion)
    : "AU";
}

function resolveErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    error.data &&
    typeof error.data === "object" &&
    "error" in error.data &&
    error.data.error &&
    typeof error.data.error === "object" &&
    "message" in error.data.error &&
    typeof error.data.error.message === "string"
  ) {
    return error.data.error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "This endpoint is currently unavailable.";
}

function formatSignedPercent(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatOneDecimal(Math.abs(value))}%`;
}

function formatComparisonValue(value: number, unit: "usd_kwh" | "usd_mwh") {
  return unit === "usd_kwh"
    ? `${formatTwoDecimals(value)} USD/kWh`
    : `${formatOneDecimal(value)} USD/MWh`;
}

function buildNationalComparison(input: {
  comparison:
    | {
        auPercentile?: number | null;
        auRank?: number | null;
        comparisons?: Array<{
          gapPct: number;
          peerCountryCode: string;
        }>;
        methodologyVersion?: string;
        peers: string[];
        rows?: Array<{
          countryCode: string;
          date: string;
          rank: number;
          value: number;
        }>;
      }
    | null;
  detailLabel: string;
  title: string;
  unit: "usd_kwh" | "usd_mwh";
}) {
  if (input.comparison === null) {
    return {
      title: input.title,
      summary: "Unavailable",
      detail: "Comparable peer data is not currently available.",
      peerGaps: [],
      rows: []
    } satisfies NationalComparison;
  }

  const comparisonSetSize = input.comparison.peers.length + 1;
  const percentileSuffix =
    typeof input.comparison.auPercentile === "number"
      ? ` · Percentile ${formatWholeNumber(input.comparison.auPercentile)}`
      : "";

  return {
    title: input.title,
    summary: `Australia ranks ${input.comparison.auRank ?? "-"} of ${comparisonSetSize} peers${percentileSuffix}`,
    detail: `${input.detailLabel} · ${input.comparison.methodologyVersion ?? "unknown"}`,
    peerGaps: (input.comparison.comparisons ?? []).map(
      (comparison) =>
        `${comparison.peerCountryCode} ${formatSignedPercent(comparison.gapPct)}`
    ),
    rows: (input.comparison.rows ?? []).map((row) => ({
      countryCode: row.countryCode,
      rank: String(row.rank),
      updatedAt: formatIsoDate(row.date),
      value: formatComparisonValue(row.value, input.unit)
    }))
  } satisfies NationalComparison;
}

function liveWholesaleUnavailableDetail(region: EnergyDashboardRegion, error: unknown) {
  if (UNSUPPORTED_LIVE_WHOLESALE_REGIONS.has(region)) {
    return `Direct live wholesale is not currently available for ${ENERGY_DASHBOARD_REGION_LABELS[region]}.`;
  }

  return resolveErrorMessage(error);
}

export async function getEnergyDashboardData(
  region = "AU"
): Promise<EnergyDashboardModel> {
  const selectedRegion = normalizeEnergyDashboardRegion(region);
  const options = createPublicSdkOptions();
  const [
    overviewResponse,
    liveWholesaleResult,
    retailAverageResult,
    householdEstimateResult,
    retailComparisonResult,
    wholesaleComparisonResult
  ] = await Promise.all([
    getApiEnergyOverview({
      ...options,
      query: { region: selectedRegion }
    }),
    UNSUPPORTED_LIVE_WHOLESALE_REGIONS.has(selectedRegion)
      ? Promise.resolve({
          ok: false as const,
          error: new Error(`Unsupported region: ${selectedRegion}`)
        })
      : getApiEnergyLiveWholesale({
          ...options,
          query: { region: selectedRegion, window: "5m" }
        }).then(
          (value) => ({ ok: true as const, value }),
          (error) => ({ ok: false as const, error })
        ),
    getApiEnergyRetailAverage({
      ...options,
      query: { customer_type: "residential", region: selectedRegion }
    }).then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error })
    ),
    getApiEnergyHouseholdEstimate({
      ...options,
      query: { region: selectedRegion, usage_profile: "household_mid" }
    }).then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error })
    ),
    getApiV1EnergyCompareRetail({
      ...options,
      query: {
        basis: "nominal",
        consumption_band: "household_mid",
        country: "AU",
        peers: "US,DE,ID,CN",
        tax_status: "incl_tax"
      }
    }).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const })
    ),
    getApiV1EnergyCompareWholesale({
      ...options,
      query: {
        country: "AU",
        peers: "US,DE,CN"
      }
    }).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const })
    )
  ]);
  const overview = unwrapSdkData(overviewResponse);
  const liveWholesale = liveWholesaleResult.ok ? unwrapSdkData(liveWholesaleResult.value) : null;
  const retailAverage = retailAverageResult.ok ? unwrapSdkData(retailAverageResult.value) : null;
  const householdEstimate = householdEstimateResult.ok
    ? unwrapSdkData(householdEstimateResult.value)
    : null;
  const retailComparison = retailComparisonResult.ok
    ? unwrapSdkData(retailComparisonResult.value)
    : null;
  const wholesaleComparison = wholesaleComparisonResult.ok
    ? unwrapSdkData(wholesaleComparisonResult.value)
    : null;
  const liveWholesaleDetail =
    liveWholesale === null
      ? liveWholesaleUnavailableDetail(
          selectedRegion,
          liveWholesaleResult.ok ? null : liveWholesaleResult.error
        )
      : `1h avg ${formatOneDecimal(liveWholesale.rollups.oneHourAvgAudMwh)} AUD/MWh · 24h avg ${formatOneDecimal(liveWholesale.rollups.twentyFourHourAvgAudMwh)} AUD/MWh`;

  return {
    region: selectedRegion,
    regionLabel: ENERGY_DASHBOARD_REGION_LABELS[selectedRegion],
    hero: {
      title: "Energy system",
      summary: "Wholesale, retail, and generation signals from the public energy stack."
    },
    liveWholesale:
      liveWholesale === null
        ? {
            label: "Latest interval",
            value: "Unavailable",
            detail: liveWholesaleDetail
          }
        : {
            label: "Latest interval",
            value: `${formatOneDecimal(liveWholesale.latest.valueAudMwh)} AUD/MWh`,
            detail: liveWholesaleDetail
          },
    retailAverage:
      retailAverage === null
        ? {
            label: "Residential mean bill",
            value: "Unavailable",
            detail: "Retail average endpoint is currently unavailable."
          }
        : {
            label: "Residential mean bill",
            value: `${formatWholeNumber(retailAverage.annualBillAudMean)} AUD/year`,
            detail: `${formatOneDecimal(retailAverage.usageRateCKwhMean)} c/kWh · ${formatOneDecimal(retailAverage.dailyChargeAudDayMean)} AUD/day`
          },
    householdEstimate:
      householdEstimate === null
        ? {
            label: "Household estimate",
            value: "Unavailable",
            detail: resolveErrorMessage(householdEstimateResult.ok ? null : householdEstimateResult.error)
          }
        : {
            label: "Household estimate",
            value: `${formatWholeNumber(householdEstimate.monthlyAud)} AUD/month`,
            detail: `${householdEstimate.usageProfile} · ${householdEstimate.confidence}`
          },
    metrics: [
      {
        label: "Live wholesale",
        value:
          liveWholesale === null
            ? "Unavailable"
            : `${formatOneDecimal(overview.panels.liveWholesale.valueAudMwh)} AUD/MWh`,
        detail:
          liveWholesale === null
            ? liveWholesaleDetail
            : `${formatOneDecimal(overview.panels.liveWholesale.valueCKwh)} c/kWh`
      },
      {
        label: "Retail average",
        value: `${formatWholeNumber(overview.panels.retailAverage.annualBillAudMean)} AUD/year`,
        detail: `Median ${formatWholeNumber(overview.panels.retailAverage.annualBillAudMedian)} AUD`
      },
      {
        label: "Benchmark bill",
        value: `${formatWholeNumber(overview.panels.benchmark.dmoAnnualBillAud)} AUD/year`,
        detail: "Default market offer"
      },
      {
        label: "Electricity CPI",
        value: formatOneDecimal(overview.panels.cpiElectricity.indexValue),
        detail: overview.panels.cpiElectricity.period
      }
    ],
    nationalComparisons: [
      buildNationalComparison({
        comparison: retailComparison,
        detailLabel: "Nominal household electricity",
        title: "Retail electricity",
        unit: "usd_kwh"
      }),
      buildNationalComparison({
        comparison: wholesaleComparison,
        detailLabel: "Cross-country annual market pricing",
        title: "Wholesale electricity",
        unit: "usd_mwh"
      })
    ],
    mixes: overview.sourceMixViews.map((view) => ({
      coverage: view.coverageLabel,
      title: view.title,
      topRows: view.rows.slice(0, 3).map((row) => `${row.label} ${formatOneDecimal(row.sharePct)}%`),
      updatedAt: formatIsoDate(view.updatedAt)
    }))
  };
}
