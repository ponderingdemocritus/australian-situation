import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { DashboardFrame } from "../../features/site/components/dashboard-frame";
import { getDashboardOverview } from "../../lib/queries/dashboard-overview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  return (
    <DashboardFrame
      eyebrow="Dashboard"
      summary="Structured around the generated SDK, with each section tied to a real data domain."
      title="National dashboard"
    >
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-black/10 bg-white/88">
          <CardHeader>
            <CardTitle>{overview.hero.title}</CardTitle>
            <CardDescription>{overview.hero.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {overview.hero.detail}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {overview.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="text-sm font-medium text-slate-500">{metric.label}</div>
                  <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                    {metric.value}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{metric.detail}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(241,245,249,0.96))]">
          <CardHeader>
            <CardTitle>Freshness and provenance</CardTitle>
            <CardDescription>
              Source metadata and freshness belong in the primary information architecture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <div className="text-sm font-medium text-slate-500">Freshness</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {overview.metadata.freshness}
              </div>
              <div className="mt-1 text-sm text-slate-600">{overview.metadata.generatedAt}</div>
            </div>
            <p className="text-sm leading-6 text-slate-600">{overview.metadata.methodSummary}</p>
          </CardContent>
        </Card>
      </section>
    </DashboardFrame>
  );
}
