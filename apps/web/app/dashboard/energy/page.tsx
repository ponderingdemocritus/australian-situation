import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { ValueCard } from "../../../components/value-card";
import { EnergyRegionTabs } from "../../../features/energy/components/energy-region-tabs";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getEnergyDashboardData } from "../../../lib/queries/energy-dashboard";

export const dynamic = "force-dynamic";

type EnergyPageProps = {
  searchParams: Promise<{ region?: string }>;
};

export default async function EnergyPage({ searchParams }: EnergyPageProps) {
  try {
    const { region } = await searchParams;
    const energy = await getEnergyDashboardData(region);

    return (
      <DashboardFrame eyebrow="Energy" summary={energy.hero.summary} title={energy.hero.title}>
        <section className="grid gap-3">
          <EnergyRegionTabs selectedRegion={energy.region} />
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Domestic view · {energy.regionLabel}
            </CardContent>
          </Card>
        </section>

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

          <Card>
            <CardHeader>
              <CardTitle>National index against peers</CardTitle>
              <CardDescription>Australia's current position across the peer set.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                          <Badge key={gap} variant="outline">
                            {gap}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    {comparison.rows.length > 0 ? (
                      <div className="grid gap-2">
                        {comparison.rows.map((row) => (
                          <Card key={`${comparison.title}-${row.countryCode}`}>
                            <CardContent className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 text-sm">
                              <span className="font-medium text-muted-foreground">{row.rank}</span>
                              <span className="font-semibold text-foreground">{row.countryCode}</span>
                              <span className="text-foreground">{row.value}</span>
                              <span className="text-muted-foreground">{row.updatedAt}</span>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
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
        </section>

        <section className="grid gap-4">
          {energy.mixes.map((mix) => (
            <Card key={mix.title}>
              <CardHeader>
                <CardTitle>{mix.title}</CardTitle>
                <CardDescription>
                  {mix.coverage} · Updated {mix.updatedAt}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {mix.topRows.map((row) => (
                  <Badge key={row} variant="outline">
                    {row}
                  </Badge>
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
        <Card>
          <CardHeader>
            <CardTitle>Energy data is temporarily unavailable.</CardTitle>
            <CardDescription>Try again once the API is reachable.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              The page is still available, but the live SDK calls for the energy domain did not complete.
            </p>
          </CardContent>
        </Card>
      </DashboardFrame>
    );
  }
}
