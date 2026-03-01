import type { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import {
  computePeerComparisons,
  computePercentile,
  rankComparableObservations
} from "../domain/energy-comparison";
import type { LiveDataRepository } from "../repositories/live-data-contract";
import {
  ENERGY_OVERVIEW_SUPPORTED_REGIONS,
  ENERGY_RETAIL_COMPARISON_BASIS,
  ENERGY_RETAIL_CONSUMPTION_BANDS,
  ENERGY_RETAIL_SUPPORTED_REGIONS,
  ENERGY_RETAIL_TAX_STATUS,
  ENERGY_SUPPORTED_WINDOWS,
  ENERGY_WHOLESALE_SUPPORTED_REGIONS
} from "./api-domain-constants";
import {
  ENERGY_HOUSEHOLD_ESTIMATE_ENV_KEY,
  ENERGY_HOUSEHOLD_ESTIMATE_RESPONSE_SCHEMA,
  ENERGY_LIVE_WHOLESALE_RESPONSE_SCHEMA,
  ENERGY_OVERVIEW_RESPONSE_SCHEMA,
  ENERGY_RETAIL_AVERAGE_RESPONSE_SCHEMA,
  ERROR_RESPONSE,
  HOUSEHOLD_ESTIMATE_QUERY_SCHEMA,
  LIVE_WHOLESALE_QUERY_SCHEMA,
  REGION_QUERY_SCHEMA,
  RETAIL_AVERAGE_QUERY_SCHEMA,
  RETAIL_COMPARE_QUERY_SCHEMA,
  RETAIL_COMPARISON_RESPONSE_SCHEMA,
  WHOLESALE_COMPARE_QUERY_SCHEMA,
  WHOLESALE_COMPARISON_RESPONSE_SCHEMA,
  jsonError,
  jsonResponse,
  parseCountryList
} from "./route-contracts";

type AppEnvironment = Record<string, string | undefined>;

export function registerEnergyRoutes(
  api: Hono,
  createRepository: () => LiveDataRepository,
  env: AppEnvironment
) {
  api.get(
    "/energy/live-wholesale",
    describeRoute({
      tags: ["Energy"],
      summary: "Live wholesale energy snapshot",
      responses: {
        200: jsonResponse(
          "Live wholesale payload",
          ENERGY_LIVE_WHOLESALE_RESPONSE_SCHEMA
        ),
        400: ERROR_RESPONSE
      }
    }),
    validator("query", LIVE_WHOLESALE_QUERY_SCHEMA),
    async (c) => {
      const { region, window } = c.req.valid("query");
      const targetRegion = region ?? "AU";
      const targetWindow = window ?? "5m";
      const repository = createRepository();

      if (!ENERGY_WHOLESALE_SUPPORTED_REGIONS.has(targetRegion)) {
        return jsonError(c, 400, "UNSUPPORTED_REGION", `Unsupported region: ${targetRegion}`);
      }

      if (!ENERGY_SUPPORTED_WINDOWS.has(targetWindow)) {
        return jsonError(c, 400, "UNSUPPORTED_WINDOW", `Unsupported window: ${targetWindow}`);
      }

      return c.json(
        await repository.getEnergyLiveWholesale(
          targetRegion,
          targetWindow as "5m" | "1h" | "24h"
        )
      );
    }
  );

  api.get(
    "/energy/retail-average",
    describeRoute({
      tags: ["Energy"],
      summary: "Retail average summary",
      responses: {
        200: jsonResponse(
          "Retail average payload",
          ENERGY_RETAIL_AVERAGE_RESPONSE_SCHEMA
        ),
        400: ERROR_RESPONSE
      }
    }),
    validator("query", RETAIL_AVERAGE_QUERY_SCHEMA),
    async (c) => {
      const { region, customer_type: customerType } = c.req.valid("query");
      const targetRegion = region ?? "AU";
      const repository = createRepository();

      if (!ENERGY_RETAIL_SUPPORTED_REGIONS.has(targetRegion)) {
        return jsonError(c, 400, "UNSUPPORTED_REGION", `Unsupported region: ${targetRegion}`);
      }

      return c.json({
        ...(await repository.getEnergyRetailAverage(targetRegion)),
        customerType: customerType ?? "residential"
      });
    }
  );

  api.get(
    "/energy/overview",
    describeRoute({
      tags: ["Energy"],
      summary: "Energy dashboard overview",
      responses: {
        200: jsonResponse("Energy overview payload", ENERGY_OVERVIEW_RESPONSE_SCHEMA),
        400: ERROR_RESPONSE
      }
    }),
    validator("query", REGION_QUERY_SCHEMA),
    async (c) => {
      const { region } = c.req.valid("query");
      const targetRegion = region ?? "AU";
      const repository = createRepository();

      if (!ENERGY_OVERVIEW_SUPPORTED_REGIONS.has(targetRegion)) {
        return jsonError(c, 400, "UNSUPPORTED_REGION", `Unsupported region: ${targetRegion}`);
      }

      return c.json(await repository.getEnergyOverview(targetRegion));
    }
  );

  api.get(
    "/energy/household-estimate",
    describeRoute({
      tags: ["Energy"],
      summary: "Feature-flagged household cost estimate",
      responses: {
        200: jsonResponse(
          "Household estimate payload",
          ENERGY_HOUSEHOLD_ESTIMATE_RESPONSE_SCHEMA
        ),
        400: ERROR_RESPONSE,
        403: ERROR_RESPONSE
      }
    }),
    validator("query", HOUSEHOLD_ESTIMATE_QUERY_SCHEMA),
    async (c) => {
      const flagEnabled = env[ENERGY_HOUSEHOLD_ESTIMATE_ENV_KEY] === "true";
      if (!flagEnabled) {
        return jsonError(
          c,
          403,
          "FEATURE_DISABLED",
          "Energy household estimate is disabled"
        );
      }

      const { region, usage_profile: usageProfile } = c.req.valid("query");
      const targetRegion = region ?? "AU";
      const repository = createRepository();
      if (!ENERGY_RETAIL_SUPPORTED_REGIONS.has(targetRegion)) {
        return jsonError(c, 400, "UNSUPPORTED_REGION", `Unsupported region: ${targetRegion}`);
      }

      const retail = await repository.getEnergyRetailAverage(targetRegion);

      return c.json({
        region: targetRegion,
        usageProfile: usageProfile ?? "default",
        isModeled: true,
        confidence: "derived",
        methodologyVersion: "household-estimate-v1",
        methodSummary:
          "Estimated monthly household electricity cost derived from regional retail annual bill averages.",
        sourceRefs: retail.sourceRefs,
        monthlyAud: retail.annualBillAudMean / 12,
        updatedAt: retail.freshness.updatedAt
      });
    }
  );
}

export function registerV1EnergyRoutes(
  v1: Hono,
  createRepository: () => LiveDataRepository
) {
  v1.get(
    "/energy/compare/retail",
    describeRoute({
      tags: ["Energy"],
      summary: "Cross-country retail electricity comparison",
      responses: {
        200: jsonResponse("Retail comparison payload", RETAIL_COMPARISON_RESPONSE_SCHEMA),
        400: ERROR_RESPONSE,
        404: ERROR_RESPONSE
      }
    }),
    validator("query", RETAIL_COMPARE_QUERY_SCHEMA),
    async (c) => {
      const {
        country,
        peers: peersQuery,
        basis,
        tax_status: taxStatus,
        consumption_band: consumptionBand
      } = c.req.valid("query");
      const repository = createRepository();
      const targetCountry = (country ?? "AU").toUpperCase();
      const peers = parseCountryList(peersQuery);
      const targetBasis = basis ?? "nominal";
      const targetTaxStatus = taxStatus ?? "incl_tax";
      const targetConsumptionBand = consumptionBand ?? "household_mid";

      if (!ENERGY_RETAIL_COMPARISON_BASIS.has(targetBasis)) {
        return jsonError(c, 400, "UNSUPPORTED_BASIS", `Unsupported basis: ${targetBasis}`);
      }

      if (!ENERGY_RETAIL_TAX_STATUS.has(targetTaxStatus)) {
        return jsonError(
          c,
          400,
          "UNSUPPORTED_TAX_STATUS",
          `Unsupported tax status: ${targetTaxStatus}`
        );
      }

      if (!ENERGY_RETAIL_CONSUMPTION_BANDS.has(targetConsumptionBand)) {
        return jsonError(
          c,
          400,
          "UNSUPPORTED_CONSUMPTION_BAND",
          `Unsupported consumption band: ${targetConsumptionBand}`
        );
      }

      const { rows } = await repository.getEnergyRetailComparison({
        country: targetCountry,
        peers,
        basis: targetBasis as "nominal" | "ppp",
        taxStatus: targetTaxStatus,
        consumptionBand: targetConsumptionBand
      });

      const missingPeers = peers.filter(
        (peer) => !rows.some((row) => row.countryCode === peer)
      );
      if (missingPeers.length > 0) {
        return jsonError(
          c,
          404,
          "NO_COMPARABLE_PEER_DATA",
          `No comparable data for peers: ${missingPeers.join(",")}`
        );
      }

      const rankedRows = rankComparableObservations(rows);
      const countryRow = rankedRows.find((row) => row.countryCode === targetCountry);
      const methodologyVersion =
        countryRow?.methodologyVersion ?? rankedRows[0]?.methodologyVersion ?? "unknown";

      return c.json({
        country: targetCountry,
        peers,
        basis: targetBasis,
        taxStatus: targetTaxStatus,
        consumptionBand: targetConsumptionBand,
        auRank: countryRow?.rank ?? null,
        methodologyVersion,
        rows: rankedRows,
        comparisons: computePeerComparisons(targetCountry, rankedRows, peers)
      });
    }
  );

  v1.get(
    "/energy/compare/wholesale",
    describeRoute({
      tags: ["Energy"],
      summary: "Cross-country wholesale electricity comparison",
      responses: {
        200: jsonResponse(
          "Wholesale comparison payload",
          WHOLESALE_COMPARISON_RESPONSE_SCHEMA
        ),
        404: ERROR_RESPONSE
      }
    }),
    validator("query", WHOLESALE_COMPARE_QUERY_SCHEMA),
    async (c) => {
      const { country, peers: peersQuery } = c.req.valid("query");
      const repository = createRepository();
      const targetCountry = (country ?? "AU").toUpperCase();
      const peers = parseCountryList(peersQuery);
      const { rows } = await repository.getEnergyWholesaleComparison({
        country: targetCountry,
        peers
      });

      const missingPeers = peers.filter(
        (peer) => !rows.some((row) => row.countryCode === peer)
      );
      if (missingPeers.length > 0) {
        return jsonError(
          c,
          404,
          "NO_COMPARABLE_PEER_DATA",
          `No comparable data for peers: ${missingPeers.join(",")}`
        );
      }

      const rankedRows = rankComparableObservations(rows);
      const countryRow = rankedRows.find((row) => row.countryCode === targetCountry);
      const methodologyVersion =
        countryRow?.methodologyVersion ?? rankedRows[0]?.methodologyVersion ?? "unknown";

      return c.json({
        country: targetCountry,
        peers,
        auRank: countryRow?.rank ?? null,
        auPercentile: countryRow ? computePercentile(countryRow.rank, rankedRows.length) : null,
        methodologyVersion,
        rows: rankedRows,
        comparisons: computePeerComparisons(targetCountry, rankedRows, peers)
      });
    }
  );
}
