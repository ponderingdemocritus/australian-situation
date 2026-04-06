import { ChartAreaInteractive } from "../../components/chart-area-interactive";
import { SectionCards } from "../../components/section-cards";
import { DashboardFrame } from "../../features/site/components/dashboard-frame";
import { getDashboardOverview } from "../../lib/queries/dashboard-overview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  return (
    <DashboardFrame
      eyebrow="Overview"
      summary="A live summary of Australian economic indicators across energy, housing, and prices."
      title="National dashboard"
    >
      <SectionCards items={overview.metrics} />
      <div className="space-y-1 px-4 lg:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {overview.hero.title}
        </h2>
        <p className="text-sm text-muted-foreground">{overview.hero.detail}</p>
        <p className="text-sm text-muted-foreground">{overview.metadata.freshness}</p>
      </div>
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive
          data={overview.chart && overview.chart.length > 0 ? overview.chart : [{ label: "freshness", lag: 0 }]}
        />
      </div>
    </DashboardFrame>
  );
}
