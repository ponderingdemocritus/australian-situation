import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";
import { getPricesDashboardData } from "../../../lib/queries/prices-dashboard";

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
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{date}</div>
    </div>
  );
}

export default async function PricesPage() {
  const prices = await getPricesDashboardData();

  if (prices.mode === "locked") {
    return (
      <DashboardFrame eyebrow="Prices" summary={prices.hero.summary} title={prices.hero.title}>
        <Card className="border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))]">
          <CardHeader>
            <CardTitle>Protected view</CardTitle>
            <CardDescription>
              This page uses SDK endpoints that require server-side credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">{prices.message}</p>
          </CardContent>
        </Card>
      </DashboardFrame>
    );
  }

  return (
    <DashboardFrame eyebrow="Prices" summary={prices.hero.summary} title={prices.hero.title}>
      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="border-black/10 bg-white/88">
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

        <Card className="border-black/10 bg-white/88">
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

      <Card className="border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.96))]">
        <CardHeader>
          <CardTitle>Methodology and freshness</CardTitle>
          <CardDescription>{prices.metadata.freshness}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
          <p>{prices.metadata.methodSummary}</p>
          <p>{prices.metadata.secondarySummary}</p>
        </CardContent>
      </Card>
    </DashboardFrame>
  );
}
