import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@aus-dash/ui";
import { ValueCard } from "../../../components/value-card";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getPricesDashboardData } from "../../../lib/queries/prices-dashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";

function PriceIndexCard({
  date,
  label,
  value
}: {
  date: string;
  label: string;
  value: string;
}) {
  return <ValueCard detail={date} label={label} value={value} />;
}

export default async function PricesPage() {
  try {
    const prices = await getPricesDashboardData();

    if (prices.mode === "locked") {
      return (
        <DashboardFrame eyebrow="Prices" summary={prices.hero.summary} title={prices.hero.title}>
          <Card>
            <CardHeader>
              <CardTitle>Credentials required</CardTitle>
              <CardDescription>
                This page requires server-side credentials to display price data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{prices.message}</p>
            </CardContent>
          </Card>
        </DashboardFrame>
      );
    }

    return (
      <DashboardFrame eyebrow="Prices" summary={prices.hero.summary} title={prices.hero.title}>
        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Major goods</CardTitle>
              <CardDescription>Curated household basket indexes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {prices.majorGoods.map((index) => (
                <PriceIndexCard key={`${index.label}-${index.date}`} {...index} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI deflation</CardTitle>
              <CardDescription>AI-exposed vs control cohorts.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {prices.aiDeflation.map((index) => (
                <PriceIndexCard key={`${index.label}-${index.date}`} {...index} />
              ))}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Methodology and freshness</CardTitle>
            <CardDescription>{prices.metadata.freshness}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>{prices.metadata.methodSummary}</p>
            <p>{prices.metadata.secondarySummary}</p>
          </CardContent>
        </Card>

        <div>
          <Button asChild variant="outline">
            <Link href="/dashboard/prices/admin">Open admin queue</Link>
          </Button>
        </div>
      </DashboardFrame>
    );
  } catch {
    return (
      <DashboardFrame
        eyebrow="Prices"
        summary="Price tracking for major goods and AI-exposed categories."
        title="Prices and baskets"
      >
        <Card>
          <CardHeader>
            <CardTitle>Price data is temporarily unavailable.</CardTitle>
            <CardDescription>Try again once the API is reachable.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">
              The price data could not be loaded at this time. The API may be offline or credentials may be misconfigured.
            </p>
          </CardContent>
        </Card>
      </DashboardFrame>
    );
  }
}
