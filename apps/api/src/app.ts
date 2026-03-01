import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import {
  describeRoute,
  openAPIRouteHandler,
  resolver,
  validator
} from "hono-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as v from "valibot";
import {
  computePeerComparisons,
  computePercentile,
  rankComparableObservations
} from "./domain/energy-comparison";
import { OPENAPI_DOCUMENTATION, renderOpenApiDocs } from "./openapi";
import {
  createLiveDataRepository,
  type LiveDataRepository
} from "./repositories/live-data-repository";
import { SeriesRepositoryError } from "./repositories/series-repository-error";

type AppEnvironment = Record<string, string | undefined>;
type ErrorLogger = Pick<Console, "error">;

export type AppDependencies = {
  createRepository?: () => LiveDataRepository;
  env?: AppEnvironment;
  logger?: ErrorLogger;
};

const ERROR_RESPONSE_SCHEMA = v.object({
  error: v.object({
    code: v.string(),
    message: v.string()
  })
});
const HEALTH_RESPONSE_SCHEMA = v.object({
  status: v.string(),
  service: v.string()
});
const JSON_OBJECT_SCHEMA = v.record(v.string(), v.unknown());
const SERIES_PARAM_SCHEMA = v.object({
  id: v.string()
});
const REGION_QUERY_SCHEMA = v.object({
  region: v.optional(v.string())
});
const SERIES_QUERY_SCHEMA = v.object({
  region: v.optional(v.string()),
  from: v.optional(v.string()),
  to: v.optional(v.string())
});
const LIVE_WHOLESALE_QUERY_SCHEMA = v.object({
  region: v.optional(v.string()),
  window: v.optional(v.string())
});
const RETAIL_AVERAGE_QUERY_SCHEMA = v.object({
  region: v.optional(v.string()),
  customer_type: v.optional(v.string())
});
const HOUSEHOLD_ESTIMATE_QUERY_SCHEMA = v.object({
  region: v.optional(v.string()),
  usage_profile: v.optional(v.string())
});
const RETAIL_COMPARE_QUERY_SCHEMA = v.object({
  country: v.optional(v.string()),
  peers: v.optional(v.string()),
  basis: v.optional(v.string()),
  tax_status: v.optional(v.string()),
  consumption_band: v.optional(v.string())
});
const WHOLESALE_COMPARE_QUERY_SCHEMA = v.object({
  country: v.optional(v.string()),
  peers: v.optional(v.string())
});
const METHODOLOGY_QUERY_SCHEMA = v.object({
  metric: v.optional(v.string())
});

function jsonResponse(description: string, schema: unknown = JSON_OBJECT_SCHEMA) {
  return {
    description,
    content: {
      "application/json": {
        schema: resolver(schema as never)
      }
    }
  };
}

const ERROR_RESPONSE = jsonResponse("Error response", ERROR_RESPONSE_SCHEMA);

const ENERGY_WHOLESALE_SUPPORTED_REGIONS = new Set([
  "AU",
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "TAS"
]);

const ENERGY_RETAIL_SUPPORTED_REGIONS = new Set([
  "AU",
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT"
]);

const ENERGY_OVERVIEW_SUPPORTED_REGIONS = ENERGY_RETAIL_SUPPORTED_REGIONS;

const ENERGY_SUPPORTED_WINDOWS = new Set(["5m", "1h", "24h"]);
const ENERGY_RETAIL_COMPARISON_BASIS = new Set(["nominal", "ppp"]);
const ENERGY_RETAIL_TAX_STATUS = new Set(["incl_tax", "excl_tax", "mixed"]);
const ENERGY_RETAIL_CONSUMPTION_BANDS = new Set([
  "household_low",
  "household_mid",
  "household_high",
  "non_household_small"
]);
const ENERGY_HOUSEHOLD_ESTIMATE_ENV_KEY = "ENABLE_ENERGY_HOUSEHOLD_ESTIMATE";

const METHODOLOGY_METADATA = {
  "energy.compare.retail": {
    metric: "energy.compare.retail",
    methodologyVersion: "energy-comparison-v1",
    description:
      "Cross-country household retail electricity price comparison with tax and consumption-band filters.",
    requiredDimensions: [
      "country",
      "peers",
      "basis",
      "tax_status",
      "consumption_band"
    ]
  },
  "energy.compare.wholesale": {
    metric: "energy.compare.wholesale",
    methodologyVersion: "energy-comparison-v1",
    description:
      "Cross-country wholesale spot electricity comparison using harmonized USD/MWh observations.",
    requiredDimensions: ["country", "peers"]
  }
} as const;

function parseCountryList(peers: string | undefined): string[] {
  if (!peers) {
    return [];
  }

  return peers
    .split(",")
    .map((peer) => peer.trim().toUpperCase())
    .filter((peer) => peer.length > 0);
}

function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string
) {
  return c.json(
    {
      error: {
        code,
        message
      }
    },
    status
  );
}

function registerCurrentApiRoutes(
  api: Hono,
  createRepository: () => LiveDataRepository,
  env: AppEnvironment
) {
  api.get(
    "/docs",
    describeRoute({
      tags: ["OpenAPI"],
      summary: "Interactive API documentation",
      responses: {
        200: {
          description: "ReDoc HTML page",
          content: {
            "text/html": {
              schema: {
                type: "string"
              }
            }
          }
        }
      }
    }),
    (c) => {
      return c.html(renderOpenApiDocs("/api/openapi.json"));
    }
  );

  api.get(
    "/health",
    describeRoute({
      tags: ["Health"],
      summary: "Service health check",
      responses: {
        200: jsonResponse("Service status", HEALTH_RESPONSE_SCHEMA)
      }
    }),
    (c) => {
      return c.json({ status: "ok", service: "aus-dash-api" });
    }
  );

  api.get(
    "/housing/overview",
    describeRoute({
      tags: ["Housing"],
      summary: "Housing metrics overview",
      responses: {
        200: jsonResponse("Housing overview payload")
      }
    }),
    validator("query", REGION_QUERY_SCHEMA),
    async (c) => {
      const { region } = c.req.valid("query");
      const repository = createRepository();
      const overview = await repository.getHousingOverview(region ?? "AU");
      return c.json(overview);
    }
  );

  api.get(
    "/series/:id",
    describeRoute({
      tags: ["Series"],
      summary: "Get series points by id",
      responses: {
        200: jsonResponse("Series points payload"),
        400: ERROR_RESPONSE,
        404: ERROR_RESPONSE
      }
    }),
    validator("param", SERIES_PARAM_SCHEMA),
    validator("query", SERIES_QUERY_SCHEMA),
    async (c) => {
      const { id } = c.req.valid("param");
      const { region, from, to } = c.req.valid("query");
      const repository = createRepository();

      try {
        const result = await repository.getSeries({
          seriesId: id,
          region: region ?? "AU",
          from,
          to
        });
        return c.json(result);
      } catch (error) {
        if (error instanceof SeriesRepositoryError) {
          return jsonError(
            c,
            error.status as ContentfulStatusCode,
            error.code,
            error.message
          );
        }

        throw error;
      }
    }
  );

  api.get(
    "/energy/live-wholesale",
    describeRoute({
      tags: ["Energy"],
      summary: "Live wholesale energy snapshot",
      responses: {
        200: jsonResponse("Live wholesale payload"),
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
        200: jsonResponse("Retail average payload"),
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
        200: jsonResponse("Energy overview payload"),
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
    "/metadata/freshness",
    describeRoute({
      tags: ["Metadata"],
      summary: "Freshness metadata for key series",
      responses: {
        200: jsonResponse("Metadata freshness payload")
      }
    }),
    async (c) => {
      const repository = createRepository();
      return c.json(await repository.getMetadataFreshness());
    }
  );

  api.get(
    "/metadata/sources",
    describeRoute({
      tags: ["Metadata"],
      summary: "Source provenance metadata",
      responses: {
        200: jsonResponse("Metadata sources payload")
      }
    }),
    async (c) => {
      const repository = createRepository();
      return c.json(await repository.getMetadataSources());
    }
  );

  api.get(
    "/energy/household-estimate",
    describeRoute({
      tags: ["Energy"],
      summary: "Feature-flagged household cost estimate",
      responses: {
        200: jsonResponse("Household estimate payload"),
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

function registerV1Routes(v1: Hono, createRepository: () => LiveDataRepository) {
  v1.get(
    "/energy/compare/retail",
    describeRoute({
      tags: ["Energy"],
      summary: "Cross-country retail electricity comparison",
      responses: {
        200: jsonResponse("Retail comparison payload"),
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
        200: jsonResponse("Wholesale comparison payload"),
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

  v1.get(
    "/metadata/methodology",
    describeRoute({
      tags: ["Metadata"],
      summary: "Methodology metadata by metric key",
      responses: {
        200: jsonResponse("Methodology payload"),
        404: ERROR_RESPONSE
      }
    }),
    validator("query", METHODOLOGY_QUERY_SCHEMA),
    (c) => {
      const { metric } = c.req.valid("query");
      const response = METHODOLOGY_METADATA[metric as keyof typeof METHODOLOGY_METADATA];
      if (!response) {
        return jsonError(c, 404, "UNKNOWN_METRIC", `Unknown metric: ${metric ?? ""}`);
      }

      return c.json(response);
    }
  );
}

export function createApp(dependencies: AppDependencies = {}) {
  const createRepository = dependencies.createRepository ?? (() => createLiveDataRepository());
  const env = dependencies.env ?? process.env;
  const logger = dependencies.logger ?? console;

  const app = new Hono();
  const api = new Hono();
  const v1 = new Hono();

  api.use("*", cors());
  registerCurrentApiRoutes(api, createRepository, env);
  registerV1Routes(v1, createRepository);
  api.route("/v1", v1);
  api.get(
    "/openapi.json",
    openAPIRouteHandler(app, {
      documentation: OPENAPI_DOCUMENTATION,
      exclude: ["/api/docs"]
    })
  );

  app.route("/api", api);

  app.notFound((c) => {
    return jsonError(c, 404, "NOT_FOUND", `Route not found: ${c.req.path}`);
  });

  app.onError((error, c) => {
    logger.error(error);
    return jsonError(c, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
  });

  return app;
}

export const app = createApp();
