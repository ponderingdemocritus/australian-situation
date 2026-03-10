import { redirect } from "next/navigation";
import { DashboardShell } from "../../features/dashboard/components/dashboard-shell";
import {
  DEFAULT_REGION,
  REGIONS,
  parseMetadataSourcesResponse,
  parseMethodologyMetadataResponse,
  parseRetailComparisonResponse,
  parseWholesaleComparisonResponse,
  parseEnergyOverviewResponse,
  parseHousingOverviewResponse,
  type EnergyOverviewResponse,
  type HousingOverviewResponse,
  type MetadataSourcesResponse,
  type MethodologyMetadataResponse,
  type RegionCode,
  type RetailComparisonResponse,
  type WholesaleComparisonResponse
} from "../../features/dashboard/lib/overview";

const SERVER_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

async function fetchInitialOverview<T>(
  pathWithQuery: string,
  parser: (payload: unknown) => T | null
): Promise<T | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE_URL}${pathWithQuery}`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return parser(await response.json());
  } catch {
    return null;
  }
}

function resolveRegion(segments: string[] | undefined): RegionCode {
  const raw = segments?.[0]?.toUpperCase();
  if (raw && REGIONS.includes(raw as RegionCode)) {
    return raw as RegionCode;
  }
  return DEFAULT_REGION;
}

type PageProps = {
  params: Promise<{ region?: string[] }>;
};

async function fetchInitialStateEnergyOverviews(): Promise<
  Record<RegionCode, EnergyOverviewResponse | null>
> {
  const entries = await Promise.all(
    REGIONS.map(async (targetRegion) => [
      targetRegion,
      await fetchInitialOverview<EnergyOverviewResponse>(
        `/api/energy/overview?region=${targetRegion}`,
        parseEnergyOverviewResponse
      )
    ])
  );

  return Object.fromEntries(entries) as Record<RegionCode, EnergyOverviewResponse | null>;
}

export default async function RegionPage({ params }: PageProps) {
  const { region: segments } = await params;

  if (segments && segments.length > 1) {
    redirect("/");
  }

  const raw = segments?.[0]?.toUpperCase();
  if (raw && !REGIONS.includes(raw as RegionCode)) {
    redirect("/");
  }

  const region = resolveRegion(segments);

  const disableServerPrefetch = process.env.AUS_DASH_DISABLE_SERVER_PREFETCH === "true";
  if (disableServerPrefetch) {
    return <DashboardShell initialRegion={region} />;
  }

  const [
    initialEnergyOverview,
    initialHousingOverview,
    initialRetailComparisonNominal,
    initialRetailComparisonPpp,
    initialWholesaleComparison,
    initialRetailMethodology,
    initialMetadataSources,
    initialStateEnergyOverviews
  ] = await Promise.all([
    fetchInitialOverview<EnergyOverviewResponse>(
      `/api/energy/overview?region=${region}`,
      parseEnergyOverviewResponse
    ),
    fetchInitialOverview<HousingOverviewResponse>(
      `/api/housing/overview?region=${region}`,
      parseHousingOverviewResponse
    ),
    fetchInitialOverview<RetailComparisonResponse>(
      "/api/v1/energy/compare/retail?country=AU&peers=US,DE&basis=nominal&tax_status=incl_tax&consumption_band=household_mid",
      parseRetailComparisonResponse
    ),
    fetchInitialOverview<RetailComparisonResponse>(
      "/api/v1/energy/compare/retail?country=AU&peers=US,DE&basis=ppp&tax_status=incl_tax&consumption_band=household_mid",
      parseRetailComparisonResponse
    ),
    fetchInitialOverview<WholesaleComparisonResponse>(
      "/api/v1/energy/compare/wholesale?country=AU&peers=US,DE",
      parseWholesaleComparisonResponse
    ),
    fetchInitialOverview<MethodologyMetadataResponse>(
      "/api/v1/metadata/methodology?metric=energy.compare.retail",
      parseMethodologyMetadataResponse
    ),
    fetchInitialOverview<MetadataSourcesResponse>(
      "/api/metadata/sources",
      parseMetadataSourcesResponse
    ),
    fetchInitialStateEnergyOverviews()
  ]);

  return (
    <DashboardShell
      initialRegion={region}
      initialEnergyOverview={initialEnergyOverview}
      initialHousingOverview={initialHousingOverview}
      initialRetailComparisonNominal={initialRetailComparisonNominal}
      initialRetailComparisonPpp={initialRetailComparisonPpp}
      initialWholesaleComparison={initialWholesaleComparison}
      initialRetailMethodology={initialRetailMethodology}
      initialMetadataSources={initialMetadataSources}
      initialStateEnergyOverviews={initialStateEnergyOverviews}
    />
  );
}
