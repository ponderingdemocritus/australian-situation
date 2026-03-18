import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { ValueCard } from "../../../components/value-card";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getSourcesDashboardData } from "../../../lib/queries/sources-dashboard";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const data = await getSourcesDashboardData();

  return (
    <DashboardFrame eyebrow="Sources" summary={data.hero.summary} title={data.hero.title}>
      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Freshness summary</CardTitle>
            <CardDescription>High-level update health for the dashboard catalog.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ValueCard detail={data.summary.generatedAt} label="Status" value={data.summary.freshness} />
            {data.staleSeries.map((series) => (
              <ValueCard
                detail={`${series.cadence} cadence · updated ${series.updatedAt}`}
                key={`${series.seriesId}-${series.region}`}
                label={series.seriesId}
                value={`${series.region} · ${series.lag}`}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source catalog</CardTitle>
            <CardDescription>Public source registry feeding the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.sources.map((source) => (
              <a key={source.url} className="block" href={source.url}>
                <Card>
                  <CardContent className="space-y-1">
                    <div className="text-lg font-semibold text-foreground">{source.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {source.domain} · {source.cadence}
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </CardContent>
        </Card>
      </section>
    </DashboardFrame>
  );
}
