import { DashboardShell } from "../features/dashboard/components/dashboard-shell";
import {
  DEFAULT_REGION,
  parseEnergyOverviewResponse,
  parseHousingOverviewResponse,
  type EnergyOverviewResponse,
  type HousingOverviewResponse
} from "../features/dashboard/lib/overview";

const SERVER_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

async function fetchInitialOverview<T>(
  path: string,
  parser: (payload: unknown) => T | null
): Promise<T | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE_URL}${path}?region=${DEFAULT_REGION}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }

    return parser(await response.json());
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const [initialEnergyOverview, initialHousingOverview] = await Promise.all([
    fetchInitialOverview<EnergyOverviewResponse>(
      "/api/energy/overview",
      parseEnergyOverviewResponse
    ),
    fetchInitialOverview<HousingOverviewResponse>(
      "/api/housing/overview",
      parseHousingOverviewResponse
    )
  ]);

  return (
    <DashboardShell
      initialRegion={DEFAULT_REGION}
      initialEnergyOverview={initialEnergyOverview}
      initialHousingOverview={initialHousingOverview}
    />
  );
}
