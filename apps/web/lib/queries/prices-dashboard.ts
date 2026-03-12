import { getApiPricesAiDeflation, getApiPricesMajorGoods } from "@aus-dash/sdk";
import { formatIsoDate, formatOneDecimal } from "../format";
import { createProtectedSdkOptions } from "../sdk/protected";
import { unwrapSdkData } from "../sdk/unwrap";

type PriceIndexRow = {
  date: string;
  label: string;
  value: string;
};

type LockedPricesDashboard = {
  hero: {
    summary: string;
    title: string;
  };
  message: string;
  mode: "locked";
};

type ReadyPricesDashboard = {
  aiDeflation: PriceIndexRow[];
  hero: {
    summary: string;
    title: string;
  };
  majorGoods: PriceIndexRow[];
  metadata: {
    freshness: string;
    methodSummary: string;
    secondarySummary: string;
  };
  mode: "ready";
};

export type PricesDashboardModel = LockedPricesDashboard | ReadyPricesDashboard;

const lockedHero = {
  title: "Prices and baskets",
  summary: "Protected price datasets stay server-side until credentials are configured."
} as const;

export async function getPricesDashboardData(): Promise<PricesDashboardModel> {
  const options = createProtectedSdkOptions();
  if (!options) {
    return {
      hero: lockedHero,
      message: "Set AUS_DASH_WEB_USERNAME and AUS_DASH_WEB_PASSWORD to enable protected price views.",
      mode: "locked"
    };
  }

  const [majorGoodsResponse, aiDeflationResponse] = await Promise.all([
    getApiPricesMajorGoods({
      ...options,
      query: { region: "AU" }
    }),
    getApiPricesAiDeflation({
      ...options,
      query: { region: "AU" }
    })
  ]);
  const majorGoods = unwrapSdkData(majorGoodsResponse);
  const aiDeflation = unwrapSdkData(aiDeflationResponse);

  return {
    hero: lockedHero,
    mode: "ready",
    majorGoods: majorGoods.indexes.map((index) => ({
      date: formatIsoDate(index.date),
      label: index.label,
      value: formatOneDecimal(index.value)
    })),
    aiDeflation: aiDeflation.indexes.map((index) => ({
      date: formatIsoDate(index.date),
      label: index.label,
      value: formatOneDecimal(index.value)
    })),
    metadata: {
      freshness: `Major goods: ${majorGoods.freshness.status} · AI deflation: ${aiDeflation.freshness.status}`,
      methodSummary: majorGoods.methodSummary,
      secondarySummary: aiDeflation.methodSummary
    }
  };
}
