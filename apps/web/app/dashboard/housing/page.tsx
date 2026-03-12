import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getHousingDashboardData } from "../../../lib/queries/housing-dashboard";

export const dynamic = "force-dynamic";

export default async function HousingPage() {
  const housing = await getHousingDashboardData();

  return (
    <DashboardFrame eyebrow="Housing" summary={housing.hero.summary} title={housing.hero.title}>
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-black/10 bg-white/88">
          <CardHeader>
            <CardTitle>Housing indicators</CardTitle>
            <CardDescription>Market value, lending, and borrowing pressure.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {housing.metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-medium text-slate-500">{metric.label}</div>
                <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                  {metric.value}
                </div>
                <div className="mt-1 text-sm text-slate-600">{metric.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,247,237,0.96))]">
          <CardHeader>
            <CardTitle>Coverage note</CardTitle>
            <CardDescription>The housing page should show what is absent, not only what is present.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">{housing.coverageNote}</p>
          </CardContent>
        </Card>
      </section>
    </DashboardFrame>
  );
}
