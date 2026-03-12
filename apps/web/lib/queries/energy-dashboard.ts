import {
  getApiEnergyHouseholdEstimate,
  getApiEnergyLiveWholesale,
  getApiEnergyOverview,
  getApiEnergyRetailAverage,
  getApiV1EnergyCompareRetail,
  getApiV1EnergyCompareWholesale
} from "@aus-dash/sdk";
import { formatIsoDate, formatOneDecimal, formatWholeNumber } from "../format";
import { createPublicSdkOptions } from "../sdk/public";
import { unwrapSdkData } from "../sdk/unwrap";

type Metric = {
  detail: string;
  label: string;
  value: string;
};

type MixSummary = {
  coverage: string;
  title: string;
  topRows: string[];
  updatedAt: string;
};

export type EnergyDashboardModel = {
  comparisons: Metric[];
  hero: {
    summary: string;
    title: string;
  };
  householdEstimate: Metric;
  liveWholesale: Metric;
  metrics: Metric[];
  mixes: MixSummary[];
  retailAverage: Metric;
};

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

export async function getEnergyDashboardData(): Promise<EnergyDashboardModel> {
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
      query: { region: "AU" }
    }),
    getApiEnergyLiveWholesale({
      ...options,
      query: { region: "AU", window: "5m" }
    }).then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error })
    ),
    getApiEnergyRetailAverage({
      ...options,
      query: { customer_type: "residential", region: "AU" }
    }).then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error })
    ),
    getApiEnergyHouseholdEstimate({
      ...options,
      query: { region: "AU", usage_profile: "household_mid" }
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

  return {
    hero: {
      title: "Energy system",
      summary: "Wholesale, retail, and generation signals from the public energy stack."
    },
    liveWholesale:
      liveWholesale === null
        ? {
            label: "Latest interval",
            value: "Unavailable",
            detail: "Live wholesale endpoint is currently unavailable."
          }
        : {
            label: "Latest interval",
            value: `${formatOneDecimal(liveWholesale.latest.valueAudMwh)} AUD/MWh`,
            detail: `1h avg ${formatOneDecimal(liveWholesale.rollups.oneHourAvgAudMwh)} AUD/MWh · 24h avg ${formatOneDecimal(liveWholesale.rollups.twentyFourHourAvgAudMwh)} AUD/MWh`
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
        value: `${formatOneDecimal(overview.panels.liveWholesale.valueAudMwh)} AUD/MWh`,
        detail: `${formatOneDecimal(overview.panels.liveWholesale.valueCKwh)} c/kWh`
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
    comparisons: [
      {
        label: "Retail comparison",
        value:
          retailComparison === null
            ? "Unavailable"
            : `Rank ${retailComparison.auRank ?? "-"} of ${retailComparison.peers.length + 1}`,
        detail:
          retailComparison === null
            ? "Comparable peer data is not currently available."
            : "Nominal household electricity"
      },
      {
        label: "Wholesale comparison",
        value:
          wholesaleComparison === null
            ? "Unavailable"
            : `Rank ${wholesaleComparison.auRank ?? "-"} of ${wholesaleComparison.peers.length + 1}`,
        detail:
          wholesaleComparison === null
            ? "Comparable peer data is not currently available."
            : "Cross-country annual market pricing"
      }
    ],
    mixes: overview.sourceMixViews.map((view) => ({
      coverage: view.coverageLabel,
      title: view.title,
      topRows: view.rows.slice(0, 3).map((row) => `${row.label} ${formatOneDecimal(row.sharePct)}%`),
      updatedAt: formatIsoDate(view.updatedAt)
    }))
  };
}
