import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getEnergyDashboardData } from "../../../lib/queries/energy-dashboard";

export const dynamic = "force-dynamic";

export default async function EnergyPage() {
  try {
    const energy = await getEnergyDashboardData();

    return (
      <DashboardFrame eyebrow="Energy" summary={energy.hero.summary} title={energy.hero.title}>
        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-black/10 bg-white/88">
            <CardHeader>
              <CardTitle>Core metrics</CardTitle>
              <CardDescription>Live market, household, and benchmark context.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {energy.metrics.map((metric) => (
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

          <Card className="border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.96))]">
            <CardHeader>
              <CardTitle>Cross-country position</CardTitle>
              <CardDescription>How Australia sits in the comparison set.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {energy.comparisons.map((comparison) => (
                <div key={comparison.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <div className="text-sm font-medium text-slate-500">{comparison.label}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    {comparison.value}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{comparison.detail}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          {energy.mixes.map((mix) => (
            <Card key={mix.title} className="border-black/10 bg-white/88">
              <CardHeader>
                <CardTitle>{mix.title}</CardTitle>
                <CardDescription>
                  {mix.coverage} · Updated {mix.updatedAt}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {mix.topRows.map((row) => (
                  <span
                    key={row}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                  >
                    {row}
                  </span>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>
      </DashboardFrame>
    );
  } catch {
    return (
      <DashboardFrame
        eyebrow="Energy"
        summary="Wholesale, retail, and generation signals from the public energy stack."
        title="Energy system"
      >
        <Card className="border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(254,242,242,0.96))]">
          <CardHeader>
            <CardTitle>Energy data is temporarily unavailable.</CardTitle>
            <CardDescription>Try again once the API is reachable.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              The page is still available, but the live SDK calls for the energy domain did not complete.
            </p>
          </CardContent>
        </Card>
      </DashboardFrame>
    );
  }
}
