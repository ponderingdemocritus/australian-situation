import type { Context } from "hono";
import { resolver } from "hono-openapi";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as v from "valibot";

export const ERROR_RESPONSE_SCHEMA = v.object({
  error: v.object({
    code: v.string(),
    message: v.string()
  })
});

export const HEALTH_RESPONSE_SCHEMA = v.object({
  status: v.string(),
  service: v.string()
});

export const SOURCE_REF_SCHEMA = v.object({
  name: v.string(),
  url: v.string()
});

export const FRESHNESS_SCHEMA = v.object({
  updatedAt: v.string(),
  status: v.string()
});

export const SERIES_POINT_SCHEMA = v.object({
  date: v.string(),
  value: v.number()
});

export const HOUSING_OVERVIEW_RESPONSE_SCHEMA = v.object({
  region: v.string(),
  requiredSeriesIds: v.array(v.string()),
  missingSeriesIds: v.array(v.string()),
  metrics: v.array(
    v.object({
      seriesId: v.string(),
      date: v.string(),
      value: v.number()
    })
  ),
  updatedAt: v.nullable(v.string())
});

export const SERIES_RESPONSE_SCHEMA = v.object({
  seriesId: v.string(),
  region: v.string(),
  points: v.array(SERIES_POINT_SCHEMA)
});

export const ENERGY_LIVE_WHOLESALE_RESPONSE_SCHEMA = v.object({
  region: v.string(),
  window: v.string(),
  isModeled: v.boolean(),
  methodSummary: v.string(),
  sourceRefs: v.array(SOURCE_REF_SCHEMA),
  latest: v.object({
    timestamp: v.string(),
    valueAudMwh: v.number(),
    valueCKwh: v.number()
  }),
  rollups: v.object({
    oneHourAvgAudMwh: v.number(),
    twentyFourHourAvgAudMwh: v.number()
  }),
  freshness: FRESHNESS_SCHEMA
});

export const ENERGY_RETAIL_AVERAGE_RESPONSE_SCHEMA = v.object({
  region: v.string(),
  customerType: v.string(),
  isModeled: v.boolean(),
  methodSummary: v.string(),
  sourceRefs: v.array(SOURCE_REF_SCHEMA),
  annualBillAudMean: v.number(),
  annualBillAudMedian: v.number(),
  usageRateCKwhMean: v.number(),
  dailyChargeAudDayMean: v.number(),
  freshness: FRESHNESS_SCHEMA
});

export const ENERGY_OVERVIEW_RESPONSE_SCHEMA = v.object({
  region: v.string(),
  methodSummary: v.string(),
  sourceRefs: v.array(SOURCE_REF_SCHEMA),
  panels: v.object({
    liveWholesale: v.object({
      valueAudMwh: v.number(),
      valueCKwh: v.number()
    }),
    retailAverage: v.object({
      annualBillAudMean: v.number(),
      annualBillAudMedian: v.number()
    }),
    benchmark: v.object({
      dmoAnnualBillAud: v.number()
    }),
    cpiElectricity: v.object({
      indexValue: v.number(),
      period: v.string()
    })
  }),
  freshness: FRESHNESS_SCHEMA
});

export const METADATA_FRESHNESS_RESPONSE_SCHEMA = v.object({
  generatedAt: v.string(),
  staleSeriesCount: v.number(),
  series: v.array(
    v.object({
      seriesId: v.string(),
      regionCode: v.string(),
      expectedCadence: v.string(),
      updatedAt: v.string(),
      lagMinutes: v.number(),
      freshnessStatus: v.string()
    })
  )
});

export const METADATA_SOURCES_RESPONSE_SCHEMA = v.object({
  generatedAt: v.string(),
  sources: v.array(
    v.object({
      sourceId: v.string(),
      domain: v.string(),
      name: v.string(),
      url: v.string(),
      expectedCadence: v.string()
    })
  )
});

export const ENERGY_HOUSEHOLD_ESTIMATE_RESPONSE_SCHEMA = v.object({
  region: v.string(),
  usageProfile: v.string(),
  isModeled: v.boolean(),
  confidence: v.string(),
  methodologyVersion: v.string(),
  methodSummary: v.string(),
  sourceRefs: v.array(SOURCE_REF_SCHEMA),
  monthlyAud: v.number(),
  updatedAt: v.string()
});

export const RANKED_COMPARABLE_OBSERVATION_SCHEMA = v.object({
  countryCode: v.string(),
  date: v.string(),
  value: v.number(),
  methodologyVersion: v.nullable(v.string()),
  rank: v.number()
});

export const RETAIL_COMPARISON_RESPONSE_SCHEMA = v.object({
  country: v.string(),
  peers: v.array(v.string()),
  basis: v.string(),
  taxStatus: v.string(),
  consumptionBand: v.string(),
  auRank: v.nullable(v.number()),
  methodologyVersion: v.string(),
  rows: v.array(RANKED_COMPARABLE_OBSERVATION_SCHEMA),
  comparisons: v.array(
    v.object({
      peerCountryCode: v.string(),
      peerValue: v.number(),
      gap: v.number(),
      gapPct: v.number()
    })
  )
});

export const WHOLESALE_COMPARISON_RESPONSE_SCHEMA = v.object({
  country: v.string(),
  peers: v.array(v.string()),
  auRank: v.nullable(v.number()),
  auPercentile: v.nullable(v.number()),
  methodologyVersion: v.string(),
  rows: v.array(RANKED_COMPARABLE_OBSERVATION_SCHEMA),
  comparisons: v.array(
    v.object({
      peerCountryCode: v.string(),
      peerValue: v.number(),
      gap: v.number(),
      gapPct: v.number()
    })
  )
});

export const METHODOLOGY_RESPONSE_SCHEMA = v.object({
  metric: v.string(),
  methodologyVersion: v.string(),
  description: v.string(),
  requiredDimensions: v.array(v.string())
});

export const JSON_OBJECT_SCHEMA = v.record(v.string(), v.unknown());

export const SERIES_PARAM_SCHEMA = v.object({
  id: v.string()
});

export const REGION_QUERY_SCHEMA = v.object({
  region: v.optional(v.string())
});

export const SERIES_QUERY_SCHEMA = v.object({
  region: v.optional(v.string()),
  from: v.optional(v.string()),
  to: v.optional(v.string())
});

export const LIVE_WHOLESALE_QUERY_SCHEMA = v.object({
  region: v.optional(v.string()),
  window: v.optional(v.string())
});

export const RETAIL_AVERAGE_QUERY_SCHEMA = v.object({
  region: v.optional(v.string()),
  customer_type: v.optional(v.string())
});

export const HOUSEHOLD_ESTIMATE_QUERY_SCHEMA = v.object({
  region: v.optional(v.string()),
  usage_profile: v.optional(v.string())
});

export const RETAIL_COMPARE_QUERY_SCHEMA = v.object({
  country: v.optional(v.string()),
  peers: v.optional(v.string()),
  basis: v.optional(v.string()),
  tax_status: v.optional(v.string()),
  consumption_band: v.optional(v.string())
});

export const WHOLESALE_COMPARE_QUERY_SCHEMA = v.object({
  country: v.optional(v.string()),
  peers: v.optional(v.string())
});

export const METHODOLOGY_QUERY_SCHEMA = v.object({
  metric: v.optional(v.string())
});

export function jsonResponse(description: string, schema: unknown = JSON_OBJECT_SCHEMA) {
  return {
    description,
    content: {
      "application/json": {
        schema: resolver(schema as never)
      }
    }
  };
}

export const ERROR_RESPONSE = jsonResponse("Error response", ERROR_RESPONSE_SCHEMA);

export const ENERGY_HOUSEHOLD_ESTIMATE_ENV_KEY = "ENABLE_ENERGY_HOUSEHOLD_ESTIMATE";

export const METHODOLOGY_METADATA = {
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

export function parseCountryList(peers: string | undefined): string[] {
  if (!peers) {
    return [];
  }

  return peers
    .split(",")
    .map((peer) => peer.trim().toUpperCase())
    .filter((peer) => peer.length > 0);
}

export function jsonError(
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
