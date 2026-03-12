import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getSeriesDashboardData } from "../../../lib/queries/series-dashboard";

export const dynamic = "force-dynamic";

type SeriesPageProps = {
  searchParams: Promise<{ id?: string; region?: string }>;
};

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
  const { id, region } = await searchParams;
  const data = await getSeriesDashboardData(id, region);

  return (
    <DashboardFrame eyebrow="Series" summary={data.hero.summary} title={data.hero.title}>
      <Card className="border-black/10 bg-white/88">
        <CardHeader>
          <CardTitle>{data.seriesId}</CardTitle>
          <CardDescription>Region {data.region}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.points.map((point) => (
            <div
              key={`${point.date}-${point.value}`}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
            >
              <div className="text-sm font-medium text-slate-500">{point.date}</div>
              <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {point.value}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </DashboardFrame>
  );
}
