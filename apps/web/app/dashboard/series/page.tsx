import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { ValueCard } from "../../../components/value-card";
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
      <Card>
        <CardHeader>
          <CardTitle>{data.seriesId}</CardTitle>
          <CardDescription>Region {data.region}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.points.map((point) => (
            <ValueCard key={`${point.date}-${point.value}`} label={point.date} value={point.value} />
          ))}
        </CardContent>
      </Card>
    </DashboardFrame>
  );
}
