import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { dashboardPreviewCards } from "../features/site/content";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-6 py-8 md:px-10 md:py-12">
      <Card>
        <CardContent className="grid gap-8 py-8 md:grid-cols-[1.35fr_0.9fr] md:py-12">
          <div className="space-y-6">
            <div className="space-y-4">
              <Badge className="w-fit uppercase" variant="outline">
                Australia situation
              </Badge>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-5xl font-semibold text-foreground md:text-7xl">
                  Australia, read clearly.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                  A clean national dashboard for energy, housing, prices, freshness, and provenance.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="/dashboard">Open dashboard</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/dashboard/sources">See sources</a>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>What this app exposes</CardTitle>
              <CardDescription>
                A simpler interface over the repo&apos;s generated SDK and public data contract.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm leading-6 text-muted-foreground">
              <p>National summary pages for major conditions in Australia.</p>
              <p>Domain-specific views for energy, housing, sources, and protected price datasets.</p>
              <p>Provenance and freshness information beside the metrics rather than buried behind them.</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardPreviewCards.map((card) => (
          <Card key={card.title}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
