import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import { DashboardFrame } from "../../features/site/components/dashboard-frame";

export default async function DashboardPage() {
  return (
    <DashboardFrame
      eyebrow="Dashboard"
      summary="Structured around the generated SDK, with each section tied to a real data domain."
      title="National dashboard"
    >
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-black/10 bg-white/88">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>
              The front door for the main Australia-wide signals exposed by the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              Energy, housing, prices, and metadata will each be loaded through dedicated SDK query modules.
            </p>
          </CardContent>
        </Card>

        <Card className="border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(241,245,249,0.96))]">
          <CardHeader>
            <CardTitle>Freshness and provenance</CardTitle>
            <CardDescription>
              Source metadata and freshness belong in the primary information architecture.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              Each domain page will expose its own update context instead of treating provenance as an afterthought.
            </p>
          </CardContent>
        </Card>
      </section>
    </DashboardFrame>
  );
}
