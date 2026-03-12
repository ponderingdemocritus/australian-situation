import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { dashboardPreviewCards } from "../features/site/content";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-6 py-8 md:px-10 md:py-12">
      <section className="grid gap-8 rounded-[2rem] border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(236,253,245,0.92))] p-8 shadow-[0_28px_90px_rgba(9,23,14,0.08)] md:grid-cols-[1.35fr_0.9fr] md:p-12">
        <div className="space-y-6">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Australia situation
            </span>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.05em] text-slate-950 md:text-7xl">
                Australia, read clearly.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                A clean national dashboard for energy, housing, prices, freshness, and provenance.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full bg-emerald-700 px-6 hover:bg-emerald-800">
              <a href="/dashboard">Open dashboard</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-slate-300 bg-white/80 px-6">
              <a href="/dashboard/sources">See sources</a>
            </Button>
          </div>
        </div>

        <Card className="border-black/10 bg-slate-950 text-white shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl tracking-[-0.03em]">What this app exposes</CardTitle>
            <CardDescription className="text-slate-300">
              A simpler interface over the repo&apos;s generated SDK and public data contract.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              National summary pages for major conditions in Australia.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Domain-specific views for energy, housing, sources, and protected price datasets.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              Provenance and freshness information beside the metrics rather than buried behind them.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardPreviewCards.map((card) => (
          <Card key={card.title} className="border-black/10 bg-white/88">
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
