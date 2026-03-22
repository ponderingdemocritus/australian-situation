import type { OilImportSource, OilOverviewResponse, OilTimeSeriesResponse } from "@aus-dash/sdk";
import { importSources, overview3, timeseries } from "@aus-dash/sdk";
import { formatOneDecimal } from "../format";
import { createPublicSdkOptions } from "../sdk/public";
import { unwrapSdkData } from "../sdk/unwrap";

type Metric = {
  detail: string;
  label: string;
  value: string;
};

export type OilTimePoint = { period: string; valueKbd: number };

export type OilImportSourceItem = {
  countryCode: string;
  countryName: string;
  sharePct: number;
  valueUsd: number;
};

export type OilDashboardModel = {
  consumptionHistory: OilTimePoint[];
  exportHistory: OilTimePoint[];
  hero: {
    summary: string;
    title: string;
  };
  importDependencyPct: number | null;
  importHistory: OilTimePoint[];
  importSources: OilImportSourceItem[];
  importSourcesPeriod: string | null;
  importSourcesTotalUsd: number | null;
  metrics: Metric[];
  productionHistory: OilTimePoint[];
};

function formatKbd(point: { valueKbd: number } | null | undefined): string {
  if (!point) return "Unavailable";
  return `${formatOneDecimal(point.valueKbd)} kbd`;
}

export async function getOilDashboardData(): Promise<OilDashboardModel> {
  const options = createPublicSdkOptions();

  const fetchTs = (seriesId: string) =>
    timeseries({
      ...options,
      query: { series_id: seriesId, region: "AU" }
    }).then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const })
    );

  const [overviewResponse, productionResult, importResult, exportResult, consumptionResult, importSourcesResult] =
    await Promise.all([
      overview3({ ...options, query: { region: "AU" } }),
      fetchTs("oil.production.crude.au.kbd"),
      fetchTs("oil.imports.total.au.kbd"),
      fetchTs("oil.exports.total.au.kbd"),
      fetchTs("oil.consumption.total.au.kbd"),
      importSources({ ...options, query: {} }).then(
        (value) => ({ ok: true as const, value }),
        () => ({ ok: false as const })
      )
    ]);

  const overview = unwrapSdkData(overviewResponse) as OilOverviewResponse;
  const unwrapTs = (result: typeof productionResult) =>
    result.ok ? (unwrapSdkData(result.value) as OilTimeSeriesResponse) : null;
  const productionTs = unwrapTs(productionResult);
  const importTs = unwrapTs(importResult);
  const exportTs = unwrapTs(exportResult);
  const consumptionTs = unwrapTs(consumptionResult);

  const production = overview.production ?? null;
  const imports = overview.imports ?? null;
  const exports = overview.exports ?? null;
  const consumption = overview.consumption ?? null;

  // Import dependency: imports / (production + imports) as a percentage
  const importDependencyPct =
    production && imports && (production.valueKbd + imports.valueKbd) > 0
      ? (imports.valueKbd / (production.valueKbd + imports.valueKbd)) * 100
      : null;

  // Import sources by country
  type ImportSourcesData = { sources: OilImportSource[]; period: string; totalValueUsd: number };
  const importSourcesData = importSourcesResult.ok
    ? (unwrapSdkData(importSourcesResult.value) as ImportSourcesData)
    : null;

  return {
    hero: {
      title: "Oil & Petroleum",
      summary:
        "Production, imports, exports, and consumption indicators for Australian crude oil and petroleum products."
    },
    importDependencyPct,
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
    importHistory: importTs?.points ?? [],
    exportHistory: exportTs?.points ?? [],
    consumptionHistory: consumptionTs?.points ?? [],
    importSources: (importSourcesData?.sources ?? []).map((s) => ({
      countryCode: s.countryCode,
      countryName: s.countryName,
      sharePct: s.sharePct,
      valueUsd: s.valueUsd
    })),
    importSourcesPeriod: importSourcesData?.period ?? null,
    importSourcesTotalUsd: importSourcesData?.totalValueUsd ?? null
  };
}
