import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { ValueCard } from "../../../components/value-card";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getOilDashboardData } from "../../../lib/queries/oil-dashboard";
import { formatOneDecimal } from "../../../lib/format";

export const dynamic = "force-dynamic";

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

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Production history</CardTitle>
              <CardDescription>Crude oil production over time (kbd)</CardDescription>
            </CardHeader>
            <CardContent>
              {oil.productionHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No production history available.</p>
              ) : (
                <div className="divide-y">
                  {oil.productionHistory.slice(0, 24).map((point) => (
                    <div
                      key={point.period}
                      className="grid grid-cols-2 items-center gap-3 py-2 text-sm"
                    >
                      <span className="font-medium text-muted-foreground">{point.period}</span>
                      <span className="text-right font-semibold text-foreground">
                        {formatOneDecimal(point.valueKbd)} kbd
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import history</CardTitle>
              <CardDescription>Total oil imports over time (kbd)</CardDescription>
            </CardHeader>
            <CardContent>
              {oil.importHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No import history available.</p>
              ) : (
                <div className="divide-y">
                  {oil.importHistory.slice(0, 24).map((point) => (
                    <div
                      key={point.period}
                      className="grid grid-cols-2 items-center gap-3 py-2 text-sm"
                    >
                      <span className="font-medium text-muted-foreground">{point.period}</span>
                      <span className="text-right font-semibold text-foreground">
                        {formatOneDecimal(point.valueKbd)} kbd
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
