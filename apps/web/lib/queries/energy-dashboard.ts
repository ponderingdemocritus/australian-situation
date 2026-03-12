import {
  getApiEnergyOverview,
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
  metrics: Metric[];
  mixes: MixSummary[];
};

export async function getEnergyDashboardData(): Promise<EnergyDashboardModel> {
  const options = createPublicSdkOptions();
  const [overviewResponse, retailComparisonResult, wholesaleComparisonResult] =
    await Promise.all([
    getApiEnergyOverview({
      ...options,
      query: { region: "AU" }
    }),
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
