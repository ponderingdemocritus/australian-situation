import {
  getApiEnergyOverview,
  getApiHealth,
  getApiHousingOverview,
  getApiMetadataFreshness,
  getApiMetadataSources
} from "@aus-dash/sdk";
import { createPublicSdkOptions } from "../sdk/public";

export type DashboardOverviewMetric = {
  detail: string;
  label: string;
  value: string;
};

export type DashboardOverviewModel = {
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

export async function getDashboardOverview(): Promise<DashboardOverviewModel> {
  const options = createPublicSdkOptions();

  const [health, energy, housing, freshness, sources] = await Promise.all([
    getApiHealth(options),
    getApiEnergyOverview({
      ...options,
      query: { region: "AU" }
    }),
    getApiHousingOverview({
      ...options,
      query: { region: "AU" }
    }),
    getApiMetadataFreshness(options),
    getApiMetadataSources(options)
  ]);

  return {
    hero: {
      title: "Australia snapshot",
      description: "Live conditions drawn directly from the generated SDK.",
      detail: `${sources.sources.length} public source${sources.sources.length === 1 ? "" : "s"}`
    },
    metrics: [
      {
        label: "API health",
        value: health.status === "ok" ? "Operational" : health.status,
        detail: health.service
      },
      {
        label: "Live wholesale",
        value: `${oneDecimal.format(energy.panels.liveWholesale.valueAudMwh)} AUD/MWh`,
        detail: `${oneDecimal.format(energy.panels.liveWholesale.valueCKwh)} c/kWh`
      },
      {
        label: "Retail average",
        value: `${wholeNumber.format(energy.panels.retailAverage.annualBillAudMean)} AUD/year`,
        detail: `Median ${wholeNumber.format(energy.panels.retailAverage.annualBillAudMedian)} AUD`
      },
      {
        label: "Housing coverage",
        value: formatTrackedMetricCount(housing.metrics.length),
        detail: `Updated ${housing.updatedAt ?? "Unknown"}`
      }
    ],
    metadata: {
      freshness: `${freshness.staleSeriesCount} stale series`,
      generatedAt: `Generated ${formatShortDate(freshness.generatedAt)}`,
      methodSummary: energy.methodSummary
    }
  };
}
