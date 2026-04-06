import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { MetricTable } from "../../../components/metric-table";
import { ValueCard } from "../../../components/value-card";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getHousingDashboardData } from "../../../lib/queries/housing-dashboard";

export const dynamic = "force-dynamic";

export default async function HousingPage() {
  const housing = await getHousingDashboardData();
  const useTable = housing.metrics.length >= 6;

  return (
    <DashboardFrame eyebrow="Housing" summary={housing.hero.summary} title={housing.hero.title}>
      <section className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Housing indicators</CardTitle>
            <CardDescription>Market value, lending, and borrowing pressure.</CardDescription>
          </CardHeader>
          <CardContent>
            {useTable ? (
              <MetricTable
                rows={housing.metrics.map((metric) => ({
                  label: metric.label,
                  value: metric.value,
                  detail: metric.detail,
                }))}
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {housing.metrics.map((metric) => (
                  <ValueCard detail={metric.detail} key={metric.label} label={metric.label} value={metric.value} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="rounded-md border border-dashed px-4 py-3">
          <p className="text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">Coverage note:</span>{" "}
            {housing.coverageNote}
          </p>
        </aside>
      </section>
    </DashboardFrame>
  );
}
