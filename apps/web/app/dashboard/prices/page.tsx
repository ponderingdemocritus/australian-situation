import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import {
  classifyPriceItem,
  promotePriceItem,
  reconcilePriceItem,
  submitPriceIntake
} from "./actions";
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

      <Card className="border-black/10 bg-white/88">
        <CardHeader>
          <CardTitle>Intake batch</CardTitle>
          <CardDescription>Submit a single discovered offer through the protected intake endpoint.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitPriceIntake} className="grid gap-3 md:grid-cols-2">
            <input className="rounded-xl border border-slate-200 px-3 py-2" defaultValue="manual_ui" name="sourceId" placeholder="Source id" />
            <input className="rounded-xl border border-slate-200 px-3 py-2" defaultValue="2026-03-01T00:00:00Z" name="observedAt" placeholder="Observed at" />
            <input className="rounded-xl border border-slate-200 px-3 py-2" defaultValue="Manual entry" name="merchantName" placeholder="Merchant name" />
            <input className="rounded-xl border border-slate-200 px-3 py-2" defaultValue="AU" name="regionCode" placeholder="Region" />
            <input className="rounded-xl border border-slate-200 px-3 py-2" defaultValue="Sample item" name="title" placeholder="Title" />
            <input className="rounded-xl border border-slate-200 px-3 py-2" defaultValue="manual-offer-1" name="externalOfferId" placeholder="External offer id" />
            <input className="rounded-xl border border-slate-200 px-3 py-2" defaultValue="1.00" name="priceAmount" placeholder="Price amount" />
            <input className="rounded-xl border border-slate-200 px-3 py-2" name="categoryHint" placeholder="Category hint" />
            <input className="rounded-xl border border-slate-200 px-3 py-2" name="listingUrl" placeholder="Listing URL" />
            <input className="rounded-xl border border-slate-200 px-3 py-2" name="normalizedUnit" placeholder="Normalized unit" />
            <div className="md:col-span-2">
              <Button type="submit">Submit intake</Button>
            </div>
          </form>
        </CardContent>
      </Card>

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

      <Card className="border-black/10 bg-white/88">
        <CardHeader>
          <CardTitle>Unresolved intake items</CardTitle>
          <CardDescription>Protected operational queue exposed through the SDK.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {prices.unresolvedItems.length === 0 ? (
            <p className="text-sm leading-6 text-slate-600">No unresolved items are currently open.</p>
          ) : (
            prices.unresolvedItems.map((item) => (
              <div
                key={item.unresolvedItemId}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950">
                  {item.title}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {item.merchantName} · {item.priceAmount} · {item.status}
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <form action={reconcilePriceItem} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
                    <input type="hidden" name="unresolvedItemId" value={item.unresolvedItemId} />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="canonicalCategorySlug" placeholder="Category slug" />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="canonicalCategoryName" placeholder="Category name" />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="canonicalProductSlug" placeholder="Product slug" />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="canonicalProductName" placeholder="Product name" />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="notes" placeholder="Notes" />
                    <Button type="submit" variant="outline">Reconcile</Button>
                  </form>

                  <form action={classifyPriceItem} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
                    <input type="hidden" name="unresolvedItemId" value={item.unresolvedItemId} />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="productFamilySlug" placeholder="Product family slug" />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="countryOfOrigin" placeholder="Country of origin" />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="manufacturerName" placeholder="Manufacturer" />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="domesticValueShareBand" placeholder="Domestic value share" />
                    <select className="rounded-lg border border-slate-200 px-3 py-2" name="aiExposureLevel" defaultValue="">
                      <option value="">AI exposure</option>
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="aiExposureReason" placeholder="AI exposure reason" />
                    <input className="rounded-lg border border-slate-200 px-3 py-2" name="comparableUnitBasis" placeholder="Comparable unit basis" />
                    <label className="text-sm text-slate-600">
                      <input className="mr-2" name="isAustralianMade" type="checkbox" />
                      Australian made
                    </label>
                    <label className="text-sm text-slate-600">
                      <input className="mr-2" name="isControlCandidate" type="checkbox" />
                      Control candidate
                    </label>
                    <Button type="submit" variant="outline">Classify</Button>
                  </form>

                  <form action={promotePriceItem} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
                    <input type="hidden" name="unresolvedItemId" value={item.unresolvedItemId} />
                    <p className="text-sm leading-6 text-slate-600">
                      Promote reconciled items for downstream publication once classification is complete.
                    </p>
                    <Button type="submit">Promote</Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardFrame>
  );
}
