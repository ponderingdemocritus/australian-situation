import {
  getEnergyLiveWholesaleFromStore,
  getEnergyOverviewFromStore,
  getEnergyRetailComparisonFromStore,
  getEnergyRetailAverageFromStore,
  getEnergyWholesaleComparisonFromStore,
  getHousingOverviewFromStore,
  getMetadataFreshnessFromStore,
  getMetadataSourcesFromStore,
  getSeriesFromStore
} from "./live-store-repository";
import type {
  LiveDataRepository,
  GetEnergyRetailComparisonInput,
  GetEnergyWholesaleComparisonInput
} from "./live-data-contract";
import { createPostgresLiveDataRepository } from "./postgres-live-repository";

export type {
  LiveDataRepository,
  GetEnergyRetailComparisonInput,
  GetEnergyWholesaleComparisonInput
} from "./live-data-contract";

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
    return createPostgresLiveDataRepository();
  }

  return createStoreLiveDataRepository();
}
