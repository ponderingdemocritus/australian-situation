import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  getEnergyLiveWholesaleFromStore,
  getEnergyOverviewFromStore,
  getEnergyRetailAverageFromStore,
  getHousingOverviewFromStore,
  getSeriesFromStore,
  getMetadataFreshnessFromStore,
  getMetadataSourcesFromStore,
  SeriesStoreQueryError
} from "./repositories/live-store-repository";

export const app = new Hono();

app.use("/api/*", cors());

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
const ENERGY_HOUSEHOLD_ESTIMATE_ENV_KEY = "ENABLE_ENERGY_HOUSEHOLD_ESTIMATE";

app.get("/api/health", (c) => {
  return c.json({ status: "ok", service: "aus-dash-api" });
});

app.get("/api/housing/overview", (c) => {
  const region = c.req.query("region") ?? "AU";
  const overview = getHousingOverviewFromStore(region);
  return c.json(overview);
});

app.get("/api/series/:id", (c) => {
  const seriesId = c.req.param("id");
  const region = c.req.query("region") ?? "AU";
  const from = c.req.query("from");
  const to = c.req.query("to");

  try {
    const result = getSeriesFromStore({ seriesId, region, from, to });
    return c.json(result);
  } catch (error) {
    if (error instanceof SeriesStoreQueryError) {
      return c.json(
        {
          error: {
            code: error.code,
            message: error.message
          }
        },
        error.status
      );
    }

    throw error;
  }
});

app.get("/api/energy/live-wholesale", (c) => {
  const region = c.req.query("region") ?? "AU";
  const window = c.req.query("window") ?? "5m";

  if (!ENERGY_WHOLESALE_SUPPORTED_REGIONS.has(region)) {
    return c.json(
      {
        error: {
          code: "UNSUPPORTED_REGION",
          message: `Unsupported region: ${region}`
        }
      },
      400
    );
  }

  if (!ENERGY_SUPPORTED_WINDOWS.has(window)) {
    return c.json(
      {
        error: {
          code: "UNSUPPORTED_WINDOW",
          message: `Unsupported window: ${window}`
        }
      },
      400
    );
  }

  return c.json(
    getEnergyLiveWholesaleFromStore(region, window as "5m" | "1h" | "24h")
  );
});

app.get("/api/energy/retail-average", (c) => {
  const region = c.req.query("region") ?? "AU";
  const customerType = c.req.query("customer_type") ?? "residential";

  if (!ENERGY_RETAIL_SUPPORTED_REGIONS.has(region)) {
    return c.json(
      {
        error: {
          code: "UNSUPPORTED_REGION",
          message: `Unsupported region: ${region}`
        }
      },
      400
    );
  }

  return c.json({
    ...getEnergyRetailAverageFromStore(region),
    customerType
  });
});

app.get("/api/energy/overview", (c) => {
  const region = c.req.query("region") ?? "AU";
  if (!ENERGY_OVERVIEW_SUPPORTED_REGIONS.has(region)) {
    return c.json(
      {
        error: {
          code: "UNSUPPORTED_REGION",
          message: `Unsupported region: ${region}`
        }
      },
      400
    );
  }

  return c.json(getEnergyOverviewFromStore(region));
});

app.get("/api/metadata/freshness", (c) => {
  return c.json(getMetadataFreshnessFromStore());
});

app.get("/api/metadata/sources", (c) => {
  return c.json(getMetadataSourcesFromStore());
});

app.get("/api/energy/household-estimate", (c) => {
  const flagEnabled = process.env[ENERGY_HOUSEHOLD_ESTIMATE_ENV_KEY] === "true";
  if (!flagEnabled) {
    return c.json(
      {
        error: {
          code: "FEATURE_DISABLED",
          message: "Energy household estimate is disabled"
        }
      },
      403
    );
  }

  const region = c.req.query("region") ?? "AU";
  const usageProfile = c.req.query("usage_profile") ?? "default";
  if (!ENERGY_RETAIL_SUPPORTED_REGIONS.has(region)) {
    return c.json(
      {
        error: {
          code: "UNSUPPORTED_REGION",
          message: `Unsupported region: ${region}`
        }
      },
      400
    );
  }

  const retail = getEnergyRetailAverageFromStore(region);

  return c.json({
    region,
    usageProfile,
    isModeled: true,
    confidence: "derived",
    methodologyVersion: "household-estimate-v1",
    methodSummary:
      "Estimated monthly household electricity cost derived from regional retail annual bill averages.",
    sourceRefs: retail.sourceRefs,
    monthlyAud: retail.annualBillAudMean / 12,
    updatedAt: retail.freshness.updatedAt
  });
});
