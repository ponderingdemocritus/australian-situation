import {
  type FreshnessSeriesItem,
  overview as overviewSdk,
  health as healthSdk,
  overview2 as housingOverviewSdk,
  freshness as freshnessSdk,
  sources as sourcesSdk
} from "@aus-dash/sdk";
import { createPublicSdkOptions } from "../sdk/public";
import { unwrapSdkData } from "../sdk/unwrap";

export type DashboardOverviewMetric = {
  detail: string;
  label: string;
  value: string;
};

export type DashboardOverviewModel = {
  chart: Array<{
    label: string;
    lag: number;
  }>;
  hero: {
    description: string;
    detail: string;
    title: string;
  };
  metadata: {
    freshness: string;
    generatedAt: string;
    methodSummary: string;
  };
  metrics: DashboardOverviewMetric[];
};

const wholeNumber = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 0
});

const oneDecimal = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

function formatShortDate(value: string) {
  return value.slice(0, 10);
}

function formatTrackedMetricCount(count: number) {
  return `${count} tracked metric${count === 1 ? "" : "s"}`;
}

function buildLiveWholesaleMetric(
  panel:
    | {
        valueAudMwh: number;
        valueCKwh: number;
      }
    | null
    | undefined
): DashboardOverviewMetric {
  if (!panel) {
    return {
      label: "Live wholesale",
      value: "Unavailable",
      detail: "Overview panel unavailable"
    };
  }

  return {
    label: "Live wholesale",
    value: `${oneDecimal.format(panel.valueAudMwh)} AUD/MWh`,
    detail: `${oneDecimal.format(panel.valueCKwh)} c/kWh`
  };
}

function buildRetailAverageMetric(
  panel:
    | {
        annualBillAudMean: number;
        annualBillAudMedian: number;
      }
    | null
    | undefined
): DashboardOverviewMetric {
  if (!panel) {
    return {
      label: "Retail average",
      value: "Unavailable",
      detail: "Median unavailable"
    };
  }

  return {
    label: "Retail average",
    value: `${wholeNumber.format(panel.annualBillAudMean)} AUD/year`,
    detail: `Median ${wholeNumber.format(panel.annualBillAudMedian)} AUD`
  };
}

export async function getDashboardOverview(): Promise<DashboardOverviewModel> {
  const options = createPublicSdkOptions();

  const [healthResponse, energyResponse, housingResponse, freshnessResponse, sourcesResponse] =
    await Promise.all([
    healthSdk(options),
    overviewSdk({
      ...options,
      query: { region: "AU" }
    }),
    housingOverviewSdk({
      ...options,
      query: { region: "AU" }
    }),
    freshnessSdk(options),
    sourcesSdk(options)
  ]);
  const health = unwrapSdkData(healthResponse);
  const energy = unwrapSdkData(energyResponse);
  const housing = unwrapSdkData(housingResponse);
  const freshnessData = unwrapSdkData(freshnessResponse);
  const sources = unwrapSdkData(sourcesResponse);

  return {
    hero: {
      title: "Australia snapshot",
      description: "Live conditions drawn directly from the generated SDK.",
      detail: `${sources.sources.length} public source${sources.sources.length === 1 ? "" : "s"}`
    },
    chart: freshnessData.series.slice(0, 6).map((series: FreshnessSeriesItem) => ({
      label: series.seriesId.split(".").slice(-2).join("."),
      lag: series.lagMinutes ?? 0
    })),
    metrics: [
      {
        label: "API health",
        value: health.status === "ok" ? "Operational" : health.status,
        detail: health.service
      },
      buildLiveWholesaleMetric(energy.panels.liveWholesale),
      buildRetailAverageMetric(energy.panels.retailAverage),
      {
        label: "Housing coverage",
        value: formatTrackedMetricCount(housing.metrics.length),
        detail: `Updated ${housing.updatedAt ?? "Unknown"}`
      }
    ],
    metadata: {
      freshness: `${freshnessData.staleSeriesCount} stale series`,
      generatedAt: `Generated ${formatShortDate(freshnessData.generatedAt)}`,
      methodSummary: energy.methodSummary
    }
  };
}
