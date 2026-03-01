import {
  getEnergyLiveWholesaleFromStore,
  getEnergyOverviewFromStore,
  getEnergyRetailComparisonFromStore,
  getEnergyRetailAverageFromStore,
  getEnergyWholesaleComparisonFromStore,
  getHousingOverviewFromStore,
  getMetadataFreshnessFromStore,
  getMetadataSourcesFromStore,
  getSeriesFromStore,
  type GetEnergyRetailComparisonInput,
  type GetEnergyWholesaleComparisonInput
} from "./live-store-repository";
import { createPostgresLiveDataRepository } from "./postgres-live-repository";

export type ApiDataBackend = "store" | "postgres";

export function resolveApiDataBackend(value: string | undefined): ApiDataBackend {
  if (!value || value.length === 0 || value === "store") {
    return "store";
  }
  if (value === "postgres") {
    return "postgres";
  }
  throw new Error(`Unsupported API data backend: ${value}`);
}

export type LiveDataRepository = {
  getHousingOverview(region: string): Promise<ReturnType<typeof getHousingOverviewFromStore>>;
  getSeries(input: {
    seriesId: string;
    region: string;
    from?: string;
    to?: string;
  }): Promise<ReturnType<typeof getSeriesFromStore>>;
  getEnergyLiveWholesale(
    region: string,
    window: "5m" | "1h" | "24h"
  ): Promise<ReturnType<typeof getEnergyLiveWholesaleFromStore>>;
  getEnergyRetailAverage(
    region: string
  ): Promise<ReturnType<typeof getEnergyRetailAverageFromStore>>;
  getEnergyRetailComparison(
    input: GetEnergyRetailComparisonInput
  ): Promise<ReturnType<typeof getEnergyRetailComparisonFromStore>>;
  getEnergyWholesaleComparison(
    input: GetEnergyWholesaleComparisonInput
  ): Promise<ReturnType<typeof getEnergyWholesaleComparisonFromStore>>;
  getEnergyOverview(region: string): Promise<ReturnType<typeof getEnergyOverviewFromStore>>;
  getMetadataFreshness(): Promise<ReturnType<typeof getMetadataFreshnessFromStore>>;
  getMetadataSources(): Promise<ReturnType<typeof getMetadataSourcesFromStore>>;
};

function createStoreLiveDataRepository(): LiveDataRepository {
  return {
    getHousingOverview: async (region) => getHousingOverviewFromStore(region),
    getSeries: async (input) =>
      getSeriesFromStore({
        seriesId: input.seriesId,
        region: input.region,
        from: input.from,
        to: input.to
      }),
    getEnergyLiveWholesale: async (region, window) =>
      getEnergyLiveWholesaleFromStore(region, window),
    getEnergyRetailAverage: async (region) => getEnergyRetailAverageFromStore(region),
    getEnergyRetailComparison: async (input) =>
      getEnergyRetailComparisonFromStore(input),
    getEnergyWholesaleComparison: async (input) =>
      getEnergyWholesaleComparisonFromStore(input),
    getEnergyOverview: async (region) => getEnergyOverviewFromStore(region),
    getMetadataFreshness: async () => getMetadataFreshnessFromStore(),
    getMetadataSources: async () => getMetadataSourcesFromStore()
  };
}

export function createLiveDataRepository(
  backend: ApiDataBackend = resolveApiDataBackend(process.env.AUS_DASH_DATA_BACKEND)
): LiveDataRepository {
  if (backend === "postgres") {
    return createPostgresLiveDataRepository() as LiveDataRepository;
  }

  return createStoreLiveDataRepository();
}
