import { getApiSeriesById } from "@aus-dash/sdk";
import { createPublicSdkOptions } from "../sdk/public";
import { unwrapSdkData } from "../sdk/unwrap";

export type SeriesDashboardModel = {
  hero: {
    summary: string;
    title: string;
  };
  points: Array<{
    date: string;
    value: string;
  }>;
  region: string;
  seriesId: string;
};

export async function getSeriesDashboardData(
  seriesId = "prices.major_goods.overall.index",
  region = "AU"
): Promise<SeriesDashboardModel> {
  const response = await getApiSeriesById({
    ...createPublicSdkOptions(),
    path: { id: seriesId },
    query: { region }
  });
  const data = unwrapSdkData(response);

  return {
    hero: {
      title: "Series explorer",
      summary: "Direct access to SDK series points for selected public metrics."
    },
    seriesId: data.seriesId,
    region: data.region,
    points: data.points.map((point) => ({
      date: point.date,
      value: point.value.toFixed(2)
    }))
  };
}
