import { DataTable, type DashboardCoverageRow } from "../../../components/data-table";
import { DashboardFrame } from "../../../features/site/components/dashboard-frame";

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

export default function StatusPage() {
  return (
    <DashboardFrame
      eyebrow="Status"
      summary="API coverage and data pipeline health across all dashboard sections."
      title="System status"
    >
      <DataTable data={coverageRows} />
    </DashboardFrame>
  );
}
