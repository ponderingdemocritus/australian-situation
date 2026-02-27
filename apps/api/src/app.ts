import { Hono } from "hono";
import { cors } from "hono/cors";
import { computeAuWeightedWholesaleRrp } from "./domain/energy-wholesale-aggregation";
import { getHousingOverview } from "./domain/housing-overview";
import { SeriesQueryError, querySeries } from "./domain/series-query";

export const app = new Hono();

app.use("/api/*", cors());

type EnergyWholesalePoint = {
  regionCode: string;
  timestamp: string;
  rrpAudMwh: number;
  demandMwh: number;
};

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

const WHOLESALE_FIXTURE: EnergyWholesalePoint[] = [
  { regionCode: "NSW", timestamp: "2026-02-27T01:50:00Z", rrpAudMwh: 112, demandMwh: 4900 },
  { regionCode: "VIC", timestamp: "2026-02-27T01:50:00Z", rrpAudMwh: 96, demandMwh: 3100 },
  { regionCode: "QLD", timestamp: "2026-02-27T01:50:00Z", rrpAudMwh: 125, demandMwh: 2800 },
  { regionCode: "SA", timestamp: "2026-02-27T01:50:00Z", rrpAudMwh: 131, demandMwh: 1300 },
  { regionCode: "TAS", timestamp: "2026-02-27T01:50:00Z", rrpAudMwh: 102, demandMwh: 600 },
  { regionCode: "NSW", timestamp: "2026-02-27T01:55:00Z", rrpAudMwh: 118, demandMwh: 5000 },
  { regionCode: "VIC", timestamp: "2026-02-27T01:55:00Z", rrpAudMwh: 99, demandMwh: 3000 },
  { regionCode: "QLD", timestamp: "2026-02-27T01:55:00Z", rrpAudMwh: 132, demandMwh: 2700 },
  { regionCode: "SA", timestamp: "2026-02-27T01:55:00Z", rrpAudMwh: 136, demandMwh: 1200 },
  { regionCode: "TAS", timestamp: "2026-02-27T01:55:00Z", rrpAudMwh: 103, demandMwh: 620 },
  { regionCode: "NSW", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 120, demandMwh: 5000 },
  { regionCode: "VIC", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 100, demandMwh: 3000 },
  { regionCode: "QLD", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 140, demandMwh: 2000 },
  { regionCode: "SA", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 138, demandMwh: 1250 },
  { regionCode: "TAS", timestamp: "2026-02-27T02:00:00Z", rrpAudMwh: 104, demandMwh: 640 }
];

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getWholesaleSeriesForRegion(region: string): {
  timestamps: string[];
  audMwhValues: number[];
} {
  const timestamps = Array.from(
    new Set(WHOLESALE_FIXTURE.map((point) => point.timestamp))
  ).sort((a, b) => a.localeCompare(b));

  if (region === "AU") {
    const audMwhValues = timestamps.map((timestamp) => {
      const pointsAtTimestamp = WHOLESALE_FIXTURE.filter(
        (point) => point.timestamp === timestamp
      );
      return computeAuWeightedWholesaleRrp(pointsAtTimestamp, {
        weighting: "demand_weighted"
      }).audMwh;
    });

    return { timestamps, audMwhValues };
  }

  const audMwhValues = timestamps.map((timestamp) => {
    const point = WHOLESALE_FIXTURE.find(
      (item) => item.regionCode === region && item.timestamp === timestamp
    );
    return point?.rrpAudMwh ?? 0;
  });

  return { timestamps, audMwhValues };
}

function getRetailAverageByRegion(region: string) {
  const fallback = {
    annualBillAudMean: 1940,
    annualBillAudMedian: 1885,
    usageRateCKwhMean: 31.2,
    dailyChargeAudDayMean: 1.08
  };

  if (region === "NSW") {
    return {
      annualBillAudMean: 2015,
      annualBillAudMedian: 1960,
      usageRateCKwhMean: 32.4,
      dailyChargeAudDayMean: 1.11
    };
  }

  if (region === "VIC") {
    return {
      annualBillAudMean: 1868,
      annualBillAudMedian: 1821,
      usageRateCKwhMean: 29.8,
      dailyChargeAudDayMean: 1.02
    };
  }

  return fallback;
}

function getDmoBenchmarkByRegion(region: string): number {
  if (region === "NSW") {
    return 2060;
  }
  if (region === "VIC") {
    return 1890;
  }
  return 1985;
}

function getElectricityCpiByRegion(region: string): { indexValue: number; period: string } {
  if (region === "VIC") {
    return { indexValue: 148.6, period: "2025-Q4" };
  }
  return { indexValue: 151.2, period: "2025-Q4" };
}

app.get("/api/health", (c) => {
  return c.json({ status: "ok", service: "aus-dash-api" });
});

app.get("/api/housing/overview", (c) => {
  const region = c.req.query("region") ?? "AU";
  const overview = getHousingOverview(region);
  return c.json(overview);
});

app.get("/api/series/:id", (c) => {
  const seriesId = c.req.param("id");
  const region = c.req.query("region") ?? "AU";
  const from = c.req.query("from");
  const to = c.req.query("to");

  try {
    const result = querySeries({ seriesId, region, from, to });
    return c.json(result);
  } catch (error) {
    if (error instanceof SeriesQueryError) {
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

  const { timestamps, audMwhValues } = getWholesaleSeriesForRegion(region);
  const latestIndex = timestamps.length - 1;
  const latestTimestamp = timestamps[latestIndex];
  const latestAudMwh = audMwhValues[latestIndex] ?? 0;

  return c.json({
    region,
    window,
    isModeled: false,
    methodSummary:
      "Wholesale reference prices aggregated using demand-weighted AU rollup.",
    sourceRefs: [
      {
        name: "AEMO NEM Wholesale",
        url: "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem"
      }
    ],
    latest: {
      timestamp: latestTimestamp,
      valueAudMwh: latestAudMwh,
      valueCKwh: latestAudMwh / 10
    },
    rollups: {
      oneHourAvgAudMwh: average(audMwhValues.slice(-12)),
      twentyFourHourAvgAudMwh: average(audMwhValues)
    },
    freshness: {
      updatedAt: latestTimestamp,
      status: "fresh"
    }
  });
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
    region,
    customerType,
    isModeled: false,
    methodSummary: "Daily aggregation of retail plan prices for residential offers.",
    sourceRefs: [
      {
        name: "AER Product Reference Data",
        url: "https://www.aer.gov.au/industry/registers/resources/guidelines/consumer-data-right-product-reference-data-api-resource-data-standards-body"
      }
    ],
    annualBillAudMean: 1940,
    annualBillAudMedian: 1885,
    usageRateCKwhMean: 31.2,
    dailyChargeAudDayMean: 1.08,
    freshness: {
      updatedAt: "2026-02-27T00:00:00Z",
      status: "fresh"
    }
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

  const { timestamps, audMwhValues } = getWholesaleSeriesForRegion(region);
  const latestIndex = timestamps.length - 1;
  const latestTimestamp = timestamps[latestIndex];
  const latestAudMwh = audMwhValues[latestIndex] ?? 0;
  const retail = getRetailAverageByRegion(region);
  const benchmark = getDmoBenchmarkByRegion(region);
  const cpi = getElectricityCpiByRegion(region);

  return c.json({
    region,
    methodSummary:
      "Combines wholesale market signal, retail offer averages, annual benchmark, and CPI context.",
    sourceRefs: [
      {
        name: "AEMO NEM Wholesale",
        url: "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem"
      },
      {
        name: "AER Product Reference Data",
        url: "https://www.aer.gov.au/industry/registers/resources/guidelines/consumer-data-right-product-reference-data-api-resource-data-standards-body"
      },
      {
        name: "ABS CPI",
        url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release"
      }
    ],
    panels: {
      liveWholesale: {
        valueAudMwh: latestAudMwh,
        valueCKwh: latestAudMwh / 10
      },
      retailAverage: {
        annualBillAudMean: retail.annualBillAudMean,
        annualBillAudMedian: retail.annualBillAudMedian
      },
      benchmark: {
        dmoAnnualBillAud: benchmark
      },
      cpiElectricity: {
        indexValue: cpi.indexValue,
        period: cpi.period
      }
    },
    freshness: {
      updatedAt: latestTimestamp,
      status: "fresh"
    }
  });
});

app.get("/api/metadata/freshness", (c) => {
  const series = [
    {
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
      regionCode: "AU",
      expectedCadence: "5m",
      updatedAt: "2026-02-27T02:00:00Z",
      lagMinutes: 4,
      freshnessStatus: "fresh"
    },
    {
      seriesId: "energy.retail.offer.annual_bill_aud.mean",
      regionCode: "AU",
      expectedCadence: "daily",
      updatedAt: "2026-02-26T00:00:00Z",
      lagMinutes: 840,
      freshnessStatus: "fresh"
    },
    {
      seriesId: "energy.cpi.electricity.index",
      regionCode: "AU",
      expectedCadence: "quarterly",
      updatedAt: "2025-10-01T00:00:00Z",
      lagMinutes: 215040,
      freshnessStatus: "stale"
    }
  ];

  const staleSeriesCount = series.filter(
    (entry) => entry.freshnessStatus === "stale"
  ).length;

  return c.json({
    generatedAt: "2026-02-27T02:04:00Z",
    staleSeriesCount,
    series
  });
});

app.get("/api/metadata/sources", (c) => {
  return c.json({
    generatedAt: "2026-02-27T02:04:00Z",
    sources: [
      {
        sourceId: "abs_housing",
        domain: "housing",
        name: "Australian Bureau of Statistics",
        url: "https://www.abs.gov.au/about/data-services/application-programming-interfaces-apis/data-api-user-guide",
        expectedCadence: "monthly|quarterly"
      },
      {
        sourceId: "aemo_wholesale",
        domain: "energy",
        name: "AEMO NEM Wholesale",
        url: "https://www.aemo.com.au/energy-systems/electricity/national-electricity-market-nem/data-nem/data-dashboard-nem",
        expectedCadence: "5m"
      },
      {
        sourceId: "aer_prd",
        domain: "energy",
        name: "AER Product Reference Data",
        url: "https://www.aer.gov.au/industry/registers/resources/guidelines/consumer-data-right-product-reference-data-api-resource-data-standards-body",
        expectedCadence: "daily"
      },
      {
        sourceId: "abs_cpi",
        domain: "macro",
        name: "ABS Consumer Price Index",
        url: "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/consumer-price-index-australia/latest-release",
        expectedCadence: "quarterly"
      }
    ]
  });
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

  const retail = getRetailAverageByRegion(region);

  return c.json({
    region,
    usageProfile,
    isModeled: true,
    confidence: "derived",
    methodologyVersion: "household-estimate-v1",
    methodSummary:
      "Estimated monthly household electricity cost derived from regional retail annual bill averages.",
    sourceRefs: [
      {
        name: "AER Product Reference Data",
        url: "https://www.aer.gov.au/industry/registers/resources/guidelines/consumer-data-right-product-reference-data-api-resource-data-standards-body"
      }
    ],
    monthlyAud: retail.annualBillAudMean / 12,
    updatedAt: "2026-02-27T00:00:00Z"
  });
});
