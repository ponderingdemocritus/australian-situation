import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
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
      <Card className="border-black/10 bg-white/88">
        <CardHeader>
          <CardTitle>{data.metric.metric}</CardTitle>
          <CardDescription>{data.metric.version}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">{data.metric.description}</p>
          <div className="flex flex-wrap gap-2">
            {data.metric.dimensions.map((dimension) => (
              <span
                key={dimension}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
              >
                {dimension}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardFrame>
  );
}
