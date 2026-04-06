import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { ValueCard } from "../../../components/value-card";
import { EnergyContentTabs } from "../../../features/energy/components/energy-content-tabs";
import { EnergyMixBar } from "../../../features/energy/components/energy-mix-bar";
import { EnergyRegionTabs } from "../../../features/energy/components/energy-region-tabs";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getEnergyDashboardData } from "../../../lib/queries/energy-dashboard";
import { relativeTime } from "../../../lib/relative-time";

export const dynamic = "force-dynamic";

type EnergyPageProps = {
  searchParams: Promise<{ region?: string }>;
};

function PeerGapBadge({ gap }: { gap: string }) {
  const isPositive = gap.includes("+");
  const isNegative = gap.includes("-") && !gap.startsWith("-");
  const dashNegative = gap.match(/\s-\d/);

  let colorClass = "text-muted-foreground";
  if (isPositive) {
    colorClass = "text-emerald-600 border-emerald-500/30";
  } else if (isNegative || dashNegative) {
    colorClass = "text-amber-600 border-amber-500/30";
  }

  return (
    <Badge variant="outline" className={colorClass}>
      {gap}
    </Badge>
  );
}

export default async function EnergyPage({ searchParams }: EnergyPageProps) {
  try {
    const { region } = await searchParams;
    const energy = await getEnergyDashboardData(region);

    const marketSnapshot = (
      <>
        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>Core metrics</CardTitle>
              <CardDescription>Live market, household, and benchmark context.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {energy.metrics.map((metric) => (
                <ValueCard detail={metric.detail} key={metric.label} label={metric.label} value={metric.value} />
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {[energy.liveWholesale, energy.retailAverage, energy.householdEstimate].map((metric) => (
              <Card key={metric.label}>
                <CardHeader>
                  <CardTitle>{metric.label}</CardTitle>
                  <CardDescription>{metric.detail}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-foreground">
                    {metric.value}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </>
    );

    const international = (
      <section className="grid gap-4">
        {energy.nationalComparisons.map((comparison) => (
          <Card key={comparison.title}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">{comparison.title}</div>
                <div className="text-2xl font-semibold text-foreground">
                  {comparison.summary}
                </div>
                <div className="text-sm text-muted-foreground">{comparison.detail}</div>
              </div>
              {comparison.peerGaps.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {comparison.peerGaps.map((gap) => (
                    <PeerGapBadge key={gap} gap={gap} />
                  ))}
                </div>
              ) : null}
              {comparison.rows.length > 0 ? (
                <div className="divide-y">
                  {comparison.rows.map((row) => (
                    <div
                      key={`${comparison.title}-${row.countryCode}`}
                      className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 py-2.5 text-sm"
                    >
                      <span className="font-medium text-muted-foreground">{row.rank}</span>
                      <span className="font-semibold text-foreground">{row.countryCode}</span>
                      <span className="text-foreground">{row.value}</span>
                      <span className="text-muted-foreground">{relativeTime(row.updatedAt)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>
    );

    const generationMix = (
      <section className="grid gap-4">
        {energy.mixes.map((mix) => (
          <Card key={mix.title}>
            <CardHeader>
              <CardTitle>{mix.title}</CardTitle>
              <CardDescription>
                {mix.coverage} · Updated {relativeTime(mix.updatedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnergyMixBar rows={mix.topRows} />
            </CardContent>
          </Card>
        ))}
      </section>
    );

    return (
      <DashboardFrame eyebrow="Energy" summary={energy.hero.summary} title={energy.hero.title}>
        <section className="grid gap-3">
          <EnergyRegionTabs selectedRegion={energy.region} />
          <p className="px-1 text-sm text-muted-foreground">
            Domestic view · {energy.regionLabel}
          </p>
        </section>

        <EnergyContentTabs
          marketSnapshot={marketSnapshot}
          international={international}
          generationMix={generationMix}
        />
      </DashboardFrame>
    );
  } catch {
    return (
      <DashboardFrame
        eyebrow="Energy"
        summary="Wholesale, retail, and generation signals from the public energy stack."
        title="Energy system"
      >
        <Card>
          <CardHeader>
            <CardTitle>Energy data is temporarily unavailable.</CardTitle>
            <CardDescription>Try again once the API is reachable.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              The page is still available, but the energy data could not be loaded at this time.
            </p>
          </CardContent>
        </Card>
      </DashboardFrame>
    );
  }
}
