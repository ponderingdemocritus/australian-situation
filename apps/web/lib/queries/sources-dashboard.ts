import {
  type FreshnessSeriesItem,
  type SourceCatalogDto,
  freshness as freshnessSdk,
  sources as sourcesSdk
} from "@aus-dash/sdk";
import { formatIsoDate } from "../format";
import { createPublicSdkOptions } from "../sdk/public";
import { unwrapSdkData } from "../sdk/unwrap";

type SourceRow = {
  cadence: string;
  domain: string;
  name: string;
  sourceId: string;
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
  const [sourcesResponse, freshnessResponse] = await Promise.all([
    sourcesSdk(options),
    freshnessSdk(options)
  ]);
  const sources = unwrapSdkData(sourcesResponse);
  const freshnessData = unwrapSdkData(freshnessResponse);

  return {
    hero: {
      title: "Sources and freshness",
      summary: "Where each dashboard signal comes from, how often it updates, and where it is drifting."
    },
    summary: {
      freshness: `${freshnessData.staleSeriesCount} stale series`,
      generatedAt: `Generated ${formatIsoDate(freshnessData.generatedAt)}`
    },
    sources: sources.sources.map((source: SourceCatalogDto) => ({
      cadence: source.expectedCadence,
      domain: source.domain,
      name: source.name,
      sourceId: source.sourceId,
      url: source.url
    })),
    staleSeries: freshnessData.series.map((series: FreshnessSeriesItem) => ({
      cadence: series.expectedCadence,
      lag: `${series.lagMinutes ?? 0} min lag`,
      region: series.regionCode,
      seriesId: series.seriesId,
      updatedAt: formatIsoDate(series.updatedAt ?? "")
    }))
  };
}
