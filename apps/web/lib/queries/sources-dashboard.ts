import { getApiMetadataFreshness, getApiMetadataSources } from "@aus-dash/sdk";
import { formatIsoDate } from "../format";
import { createPublicSdkOptions } from "../sdk/public";

type SourceRow = {
  cadence: string;
  domain: string;
  name: string;
  url: string;
};

type StaleSeriesRow = {
  cadence: string;
  lag: string;
  region: string;
  seriesId: string;
  updatedAt: string;
};

export type SourcesDashboardModel = {
  hero: {
    summary: string;
    title: string;
  };
  sources: SourceRow[];
  staleSeries: StaleSeriesRow[];
  summary: {
    freshness: string;
    generatedAt: string;
  };
};

export async function getSourcesDashboardData(): Promise<SourcesDashboardModel> {
  const options = createPublicSdkOptions();
  const [sources, freshness] = await Promise.all([
    getApiMetadataSources(options),
    getApiMetadataFreshness(options)
  ]);

  return {
    hero: {
      title: "Sources and freshness",
      summary: "Where each dashboard signal comes from, how often it updates, and where it is drifting."
    },
    summary: {
      freshness: `${freshness.staleSeriesCount} stale series`,
      generatedAt: `Generated ${formatIsoDate(freshness.generatedAt)}`
    },
    sources: sources.sources.map((source) => ({
      cadence: source.expectedCadence,
      domain: source.domain,
      name: source.name,
      url: source.url
    })),
    staleSeries: freshness.series.map((series) => ({
      cadence: series.expectedCadence,
      lag: `${series.lagMinutes} min lag`,
      region: series.regionCode,
      seriesId: series.seriesId,
      updatedAt: formatIsoDate(series.updatedAt)
    }))
  };
}
