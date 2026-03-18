import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { ValueCard } from "../../../components/value-card";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getHousingDashboardData } from "../../../lib/queries/housing-dashboard";

export const dynamic = "force-dynamic";

export default async function HousingPage() {
  const housing = await getHousingDashboardData();

  return (
    <DashboardFrame eyebrow="Housing" summary={housing.hero.summary} title={housing.hero.title}>
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Housing indicators</CardTitle>
            <CardDescription>Market value, lending, and borrowing pressure.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {housing.metrics.map((metric) => (
              <ValueCard detail={metric.detail} key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coverage note</CardTitle>
            <CardDescription>The housing page should show what is absent, not only what is present.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">{housing.coverageNote}</p>
          </CardContent>
        </Card>
      </section>
    </DashboardFrame>
  );
}
