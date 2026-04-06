import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@aus-dash/ui";
import {
  classifyPriceItem,
  promotePriceItem,
  reconcilePriceItem,
  submitPriceIntake
} from "../actions";
import { DashboardFrame } from "../../../../features/site/components/dashboard-frame";
import { getPricesDashboardData } from "../../../../lib/queries/prices-dashboard";

export const dynamic = "force-dynamic";

export default async function PricesAdminPage() {
  const prices = await getPricesDashboardData();

  if (prices.mode === "locked") {
    return (
      <DashboardFrame eyebrow="Prices · Admin" summary="Manage intake and reconciliation for the price pipeline." title="Price admin queue">
        <Card>
          <CardHeader>
            <CardTitle>Credentials required</CardTitle>
            <CardDescription>
              This page requires server-side credentials to access the price pipeline.
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
    <DashboardFrame eyebrow="Prices · Admin" summary="Manage intake and reconciliation for the price pipeline." title="Price admin queue">
      <Card>
        <CardHeader>
          <CardTitle>Intake batch</CardTitle>
          <CardDescription>Submit a single discovered offer for processing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={submitPriceIntake} className="grid gap-3 md:grid-cols-2">
            <Input defaultValue="manual_ui" name="sourceId" placeholder="Source id" />
            <Input defaultValue="2026-03-01T00:00:00Z" name="observedAt" placeholder="Observed at" />
            <Input defaultValue="Manual entry" name="merchantName" placeholder="Merchant name" />
            <Input defaultValue="AU" name="regionCode" placeholder="Region" />
            <Input defaultValue="Sample item" name="title" placeholder="Title" />
            <Input defaultValue="manual-offer-1" name="externalOfferId" placeholder="External offer id" />
            <Input defaultValue="1.00" name="priceAmount" placeholder="Price amount" />
            <Input name="categoryHint" placeholder="Category hint" />
            <Input name="listingUrl" placeholder="Listing URL" />
            <Input name="normalizedUnit" placeholder="Normalized unit" />
            <div className="md:col-span-2">
              <Button type="submit">Submit intake</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unresolved intake items</CardTitle>
          <CardDescription>Items awaiting reconciliation, classification, or promotion.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {prices.unresolvedItems.length === 0 ? (
            <p className="text-sm leading-6 text-muted-foreground">No unresolved items are currently open.</p>
          ) : (
            prices.unresolvedItems.map((item) => (
              <Card key={item.unresolvedItemId}>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {item.title}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {item.merchantName} · {item.priceAmount} · {item.status}
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <form action={reconcilePriceItem}>
                      <Card>
                        <CardContent className="grid gap-2">
                          <input type="hidden" name="unresolvedItemId" value={item.unresolvedItemId} />
                          <Input name="canonicalCategorySlug" placeholder="Category slug" />
                          <Input name="canonicalCategoryName" placeholder="Category name" />
                          <Input name="canonicalProductSlug" placeholder="Product slug" />
                          <Input name="canonicalProductName" placeholder="Product name" />
                          <Input name="notes" placeholder="Notes" />
                          <Button type="submit" variant="outline">Reconcile</Button>
                        </CardContent>
                      </Card>
                    </form>

                    <form action={classifyPriceItem}>
                      <Card>
                        <CardContent className="grid gap-2">
                          <input type="hidden" name="unresolvedItemId" value={item.unresolvedItemId} />
                          <Input name="productFamilySlug" placeholder="Product family slug" />
                          <Input name="countryOfOrigin" placeholder="Country of origin" />
                          <Input name="manufacturerName" placeholder="Manufacturer" />
                          <Input name="domesticValueShareBand" placeholder="Domestic value share" />
                          <Select defaultValue="" name="aiExposureLevel">
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="AI exposure" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">low</SelectItem>
                              <SelectItem value="medium">medium</SelectItem>
                              <SelectItem value="high">high</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input name="aiExposureReason" placeholder="AI exposure reason" />
                          <Input name="comparableUnitBasis" placeholder="Comparable unit basis" />
                          <Label>
                            <Checkbox name="isAustralianMade" />
                            Australian made
                          </Label>
                          <Label>
                            <Checkbox name="isControlCandidate" />
                            Control candidate
                          </Label>
                          <Button type="submit" variant="outline">Classify</Button>
                        </CardContent>
                      </Card>
                    </form>

                    <form action={promotePriceItem}>
                      <Card>
                        <CardContent className="grid gap-2">
                          <input type="hidden" name="unresolvedItemId" value={item.unresolvedItemId} />
                          <p className="text-sm leading-6 text-muted-foreground">
                            Promote reconciled items for downstream publication once classification is complete.
                          </p>
                          <Button type="submit">Promote</Button>
                        </CardContent>
                      </Card>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardFrame>
  );
}
