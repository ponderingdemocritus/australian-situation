import type { OilOverviewResponse, OilTimeSeriesResponse } from "@aus-dash/sdk";
import { overview3, timeseries } from "@aus-dash/sdk";
import { formatOneDecimal } from "../format";
import { createPublicSdkOptions } from "../sdk/public";
import { unwrapSdkData } from "../sdk/unwrap";

type Metric = {
  detail: string;
  label: string;
  value: string;
};

export type OilDashboardModel = {
  hero: {
    summary: string;
    title: string;
  };
  importHistory: Array<{ period: string; valueKbd: number }>;
  metrics: Metric[];
  productionHistory: Array<{ period: string; valueKbd: number }>;
};

function formatKbd(point: { valueKbd: number } | null | undefined): string {
  if (!point) return "Unavailable";
  return `${formatOneDecimal(point.valueKbd)} kbd`;
}

export async function getOilDashboardData(): Promise<OilDashboardModel> {
  const options = createPublicSdkOptions();

  const [overviewResponse, productionResult, importResult] = await Promise.all([
    overview3({ ...options, query: { region: "AU" } }),
    timeseries({
      ...options,
      query: { series_id: "oil.production.crude.au.kbd", region: "AU" }
    }).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const })
    ),
    timeseries({
      ...options,
      query: { series_id: "oil.imports.total.au.kbd", region: "AU" }
    }).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const })
    )
  ]);

  const overview = unwrapSdkData(overviewResponse) as OilOverviewResponse;
  const productionTs = productionResult.ok
    ? (unwrapSdkData(productionResult.value) as OilTimeSeriesResponse)
    : null;
  const importTs = importResult.ok
    ? (unwrapSdkData(importResult.value) as OilTimeSeriesResponse)
    : null;

  const production = overview.production ?? null;
  const imports = overview.imports ?? null;
  const exports = overview.exports ?? null;
  const consumption = overview.consumption ?? null;

  return {
    hero: {
      title: "Oil & Petroleum",
      summary:
        "Production, imports, exports, and consumption indicators for Australian crude oil and petroleum products."
    },
    metrics: [
      {
        label: "Production",
        value: formatKbd(production),
        detail: production ? `${production.period} · ${production.countryCode}` : "Data unavailable"
      },
      {
        label: "Imports",
        value: formatKbd(imports),
        detail: imports ? `${imports.period} · ${imports.countryCode}` : "Data unavailable"
      },
      {
        label: "Exports",
        value: formatKbd(exports),
        detail: exports ? `${exports.period} · ${exports.countryCode}` : "Data unavailable"
      },
      {
        label: "Consumption",
        value: formatKbd(consumption),
        detail: consumption
          ? `${consumption.period} · ${consumption.countryCode}`
          : "Data unavailable"
      }
    ],
    productionHistory: productionTs?.points ?? [],
    importHistory: importTs?.points ?? []
  };
}
