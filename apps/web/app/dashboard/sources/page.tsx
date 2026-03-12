import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getSourcesDashboardData } from "../../../lib/queries/sources-dashboard";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const data = await getSourcesDashboardData();

  return (
    <DashboardFrame eyebrow="Sources" summary={data.hero.summary} title={data.hero.title}>
      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.96))]">
          <CardHeader>
            <CardTitle>Freshness summary</CardTitle>
            <CardDescription>High-level update health for the dashboard catalog.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="text-sm font-medium text-slate-500">Status</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {data.summary.freshness}
              </div>
              <div className="mt-1 text-sm text-slate-600">{data.summary.generatedAt}</div>
            </div>
            {data.staleSeries.map((series) => (
              <div key={`${series.seriesId}-${series.region}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-medium text-slate-500">{series.seriesId}</div>
                <div className="mt-2 text-base font-semibold text-slate-950">
                  {series.region} · {series.lag}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {series.cadence} cadence · updated {series.updatedAt}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-black/10 bg-white/88">
          <CardHeader>
            <CardTitle>Source catalog</CardTitle>
            <CardDescription>Public source registry feeding the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.sources.map((source) => (
              <a
                key={source.url}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-slate-900 transition hover:border-emerald-200 hover:bg-emerald-50"
                href={source.url}
              >
                <div className="text-lg font-semibold tracking-[-0.02em]">{source.name}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {source.domain} · {source.cadence}
                </div>
              </a>
            ))}
          </CardContent>
        </Card>
      </section>
    </DashboardFrame>
  );
}
