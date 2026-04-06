import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { OilCombinedChart } from "../../../components/oil-combined-chart";
import { OilImportSourcesChart } from "../../../components/oil-import-sources-chart";
import { OilTimeSeriesChart } from "../../../components/oil-timeseries-chart";
import { ValueCard } from "../../../components/value-card";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { formatOneDecimal } from "../../../lib/format";
import { getOilDashboardData } from "../../../lib/queries/oil-dashboard";

export const dynamic = "force-dynamic";

const COLORS = {
  production: "#2563eb",
  imports: "#e11d48",
  exports: "#f59e0b",
  consumption: "#8b5cf6"
} as const;

export default async function OilPage() {
  try {
    const oil = await getOilDashboardData();

    return (
      <DashboardFrame eyebrow="Oil & Petroleum" summary={oil.hero.summary} title={oil.hero.title}>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {oil.metrics.map((metric) => (
            <ValueCard
              detail={metric.detail}
              key={metric.label}
              label={metric.label}
              value={metric.value}
            />
          ))}
        </section>

        {oil.importDependencyPct !== null && (
          <Card>
            <CardHeader>
              <CardTitle>Import dependency</CardTitle>
              <CardDescription>
                Proportion of oil supply sourced from imports vs domestic production
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-medium" style={{ color: COLORS.production }}>
                      Domestic {formatOneDecimal(100 - oil.importDependencyPct)}%
                    </span>
                    <span className="font-medium" style={{ color: COLORS.imports }}>
                      Imported {formatOneDecimal(oil.importDependencyPct)}%
                    </span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-l-full transition-all"
                      style={{
                        width: `${100 - oil.importDependencyPct}%`,
                        backgroundColor: COLORS.production
                      }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: COLORS.imports }}>
                    {formatOneDecimal(oil.importDependencyPct)}%
                  </p>
                  <p className="text-xs text-muted-foreground">import reliance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <OilCombinedChart
          production={oil.productionHistory}
          imports={oil.importHistory}
          exports={oil.exportHistory}
          consumption={oil.consumptionHistory}
        />

        <OilImportSourcesChart
          sources={oil.importSources}
          period={oil.importSourcesPeriod}
          totalUsd={oil.importSourcesTotalUsd}
        />

        <section className="grid gap-4 xl:grid-cols-2">
          <OilTimeSeriesChart
            data={oil.productionHistory}
            title="Production"
            description="Crude oil production over time (kbd)"
            color={COLORS.production}
          />
          <OilTimeSeriesChart
            data={oil.importHistory}
            title="Imports"
            description="Total oil imports over time (kbd)"
            color={COLORS.imports}
          />
          <OilTimeSeriesChart
            data={oil.exportHistory}
            title="Exports"
            description="Total oil exports over time (kbd)"
            color={COLORS.exports}
          />
          <OilTimeSeriesChart
            data={oil.consumptionHistory}
            title="Consumption"
            description="Total oil consumption over time (kbd)"
            color={COLORS.consumption}
          />
        </section>
      </DashboardFrame>
    );
  } catch {
    return (
      <DashboardFrame
        eyebrow="Oil & Petroleum"
        summary="Production, imports, exports, and consumption indicators for Australian crude oil and petroleum products."
        title="Oil & Petroleum"
      >
        <Card>
          <CardHeader>
            <CardTitle>Oil data is temporarily unavailable.</CardTitle>
            <CardDescription>Try again once the API is reachable.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              The page is still available, but the oil data could not be loaded at this time.
            </p>
          </CardContent>
        </Card>
      </DashboardFrame>
    );
  }
}
