import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getMethodologyDashboardData } from "../../../lib/queries/methodology-dashboard";

export const dynamic = "force-dynamic";

type MethodologyPageProps = {
  searchParams: Promise<{ metric?: string }>;
};

export default async function MethodologyPage({ searchParams }: MethodologyPageProps) {
  const { metric } = await searchParams;
  const data = await getMethodologyDashboardData(metric);

  return (
    <DashboardFrame eyebrow="Methodology" summary={data.hero.summary} title={data.hero.title}>
      <Card>
        <CardHeader>
          <CardTitle>{data.metric.metric}</CardTitle>
          <CardDescription>{data.metric.version}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">{data.metric.description}</p>
          <div className="flex flex-wrap gap-2">
            {data.metric.dimensions.map((dimension) => (
              <Badge key={dimension} variant="outline">
                {dimension}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardFrame>
  );
}
