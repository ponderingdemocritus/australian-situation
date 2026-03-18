import { Card, CardContent } from "@aus-dash/ui";
import { ChartAreaInteractive } from "../../components/chart-area-interactive";
import { DataTable, type DashboardCoverageRow } from "../../components/data-table";
import { SectionCards } from "../../components/section-cards";
import { DashboardFrame } from "../../features/site/components/dashboard-frame";
import { dashboardNavItems } from "../../features/site/content";
import { getDashboardOverview } from "../../lib/queries/dashboard-overview";

export const dynamic = "force-dynamic";

const coverageRows: DashboardCoverageRow[] = [
  { surface: "Overview", route: "/dashboard", endpoint: "getApiHealth", access: "public" },
  { surface: "Overview", route: "/dashboard", endpoint: "getApiEnergyOverview", access: "public" },
  { surface: "Overview", route: "/dashboard", endpoint: "getApiHousingOverview", access: "public" },
  { surface: "Overview", route: "/dashboard", endpoint: "getApiMetadataFreshness", access: "public" },
  { surface: "Overview", route: "/dashboard", endpoint: "getApiMetadataSources", access: "public" },
  { surface: "Energy", route: "/dashboard/energy", endpoint: "getApiEnergyLiveWholesale", access: "public" },
  { surface: "Energy", route: "/dashboard/energy", endpoint: "getApiEnergyRetailAverage", access: "public" },
  { surface: "Energy", route: "/dashboard/energy", endpoint: "getApiEnergyHouseholdEstimate", access: "public/flagged" },
  { surface: "Energy", route: "/dashboard/energy", endpoint: "getApiV1EnergyCompareRetail", access: "public" },
  { surface: "Energy", route: "/dashboard/energy", endpoint: "getApiV1EnergyCompareWholesale", access: "public" },
  { surface: "Housing", route: "/dashboard/housing", endpoint: "getApiHousingOverview", access: "public" },
  { surface: "Sources", route: "/dashboard/sources", endpoint: "getApiMetadataFreshness", access: "public" },
  { surface: "Sources", route: "/dashboard/sources", endpoint: "getApiMetadataSources", access: "public" },
  { surface: "Series", route: "/dashboard/series", endpoint: "getApiSeriesById", access: "public" },
  { surface: "Methodology", route: "/dashboard/methodology", endpoint: "getApiV1MetadataMethodology", access: "public" },
  { surface: "Prices", route: "/dashboard/prices", endpoint: "getApiPricesMajorGoods", access: "protected" },
  { surface: "Prices", route: "/dashboard/prices", endpoint: "getApiPricesAiDeflation", access: "protected" },
  { surface: "Prices", route: "/dashboard/prices", endpoint: "getApiPricesUnresolvedItems", access: "protected" },
  { surface: "Prices", route: "/dashboard/prices", endpoint: "postApiPricesIntakeBatches", access: "protected action" },
  { surface: "Prices", route: "/dashboard/prices", endpoint: "postApiPricesUnresolvedItemsByIdReconcile", access: "protected action" },
  { surface: "Prices", route: "/dashboard/prices", endpoint: "postApiPricesUnresolvedItemsByIdClassify", access: "protected action" },
  { surface: "Prices", route: "/dashboard/prices", endpoint: "postApiPricesUnresolvedItemsByIdPromote", access: "protected action" }
];

export default async function DashboardPage() {
  const overview = await getDashboardOverview();

  return (
    <DashboardFrame
      eyebrow="Overview"
      summary="Structured around the generated SDK, with each section tied to a real data domain."
      title="National dashboard"
    >
      <SectionCards items={overview.metrics} />
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            {overview.hero.title} · {overview.hero.detail} · {overview.metadata.freshness}
          </CardContent>
        </Card>
      </div>
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive
          data={overview.chart && overview.chart.length > 0 ? overview.chart : [{ label: "freshness", lag: 0 }]}
        />
      </div>
      <DataTable data={coverageRows.filter((row) => dashboardNavItems.some((item) => row.route.startsWith(item.href) || row.route === "/dashboard"))} />
    </DashboardFrame>
  );
}
