import { getApiHousingOverview } from "@aus-dash/sdk";
import { formatIsoDate, formatTwoDecimals, formatWholeNumber } from "../format";
import { createPublicSdkOptions } from "../sdk/public";

type Metric = {
  detail: string;
  label: string;
  value: string;
};

export type HousingDashboardModel = {
  coverageNote: string;
  hero: {
    summary: string;
    title: string;
  };
  metrics: Metric[];
};

function describeMetric(seriesId: string, value: number): { label: string; value: string } {
  switch (seriesId) {
    case "hvi.value.index":
      return { label: "Home value index", value: formatOneDecimalOrWhole(value) };
    case "lending.avg_loan_size_aud":
      return { label: "Average loan size", value: `${formatWholeNumber(value)} AUD` };
    case "rates.oo.variable_pct":
      return { label: "Owner-occupier variable rate", value: `${formatTwoDecimals(value)}%` };
    case "lending.investor.count":
      return { label: "Investor lending", value: formatWholeNumber(value) };
    default:
      return { label: seriesId, value: formatWholeNumber(value) };
  }
}

function formatOneDecimalOrWhole(value: number) {
  if (Number.isInteger(value)) {
    return formatWholeNumber(value);
  }
  return value.toFixed(1);
}

export async function getHousingDashboardData(): Promise<HousingDashboardModel> {
  const overview = await getApiHousingOverview({
    ...createPublicSdkOptions(),
    query: { region: "AU" }
  });

  return {
    hero: {
      title: "Housing pressure",
      summary: "Property values, lending, and mortgage pressure for the national market."
    },
    metrics: overview.metrics.map((metric) => {
      const described = describeMetric(metric.seriesId, metric.value);
      return {
        label: described.label,
        value: described.value,
        detail: formatIsoDate(metric.date)
      };
    }),
    coverageNote: `${overview.missingSeriesIds.length} series currently missing from the housing overview.`
  };
}
