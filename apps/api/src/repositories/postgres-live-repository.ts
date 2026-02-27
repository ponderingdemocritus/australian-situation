import { getDb, observations, sources } from "@aus-dash/db";
import { and, eq, gte, lte } from "drizzle-orm";
import { SeriesRepositoryError } from "./series-repository-error";

const SUPPORTED_REGIONS = new Set([
  "AU",
  "NSW",
  "VIC",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT",
  "SYD",
  "MEL",
  "BNE",
  "ADL",
  "PER",
  "HBA",
  "DRW",
  "CBR"
]);

const REQUIRED_HOUSING_SERIES_IDS = [
  "hvi.value.index",
  "lending.oo.count",
  "lending.oo.value_aud",
  "lending.investor.count",
  "lending.investor.value_aud",
  "lending.avg_loan_size_aud",
  "rates.oo.variable_pct",
  "rates.oo.fixed_pct"
] as const;

type Cadence = "5m" | "daily" | "monthly" | "quarterly";

type FreshnessStatus = "fresh" | "stale" | "degraded";

type ObservationRow = {
  seriesId: string;
  regionCode: string;
  date: string;
  value: number;
  unit: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
};

function parseNumeric(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toTimestamp(date: string): number | null {
  const parsedDirect = Date.parse(date);
  if (!Number.isNaN(parsedDirect)) {
    return parsedDirect;
  }

  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(date);
  if (!quarterMatch) {
    return null;
  }

  const year = Number(quarterMatch[1]);
  const quarter = Number(quarterMatch[2]);
  const monthEnd = quarter * 3;
  return Date.parse(`${year}-${String(monthEnd).padStart(2, "0")}-01T00:00:00Z`);
}

function lagMinutes(nowMs: number, date: string): number {
  const ts = toTimestamp(date);
  if (ts === null) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor((nowMs - ts) / 60000));
}

function freshnessStatus(cadence: Cadence, lagMins: number): FreshnessStatus {
  const thresholdMinutes =
    cadence === "5m"
      ? 20
      : cadence === "daily"
        ? 48 * 60
        : cadence === "monthly"
          ? 72 * 60
          : 7 * 24 * 60;

  return lagMins > thresholdMinutes ? "stale" : "fresh";
}

async function listObservations(
  seriesId: string,
  regionCode: string,
  from?: string,
  to?: string
): Promise<ObservationRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      seriesId: observations.seriesId,
      regionCode: observations.regionCode,
      date: observations.date,
      value: observations.value,
      unit: observations.unit,
      sourceName: observations.sourceName,
      sourceUrl: observations.sourceUrl,
      publishedAt: observations.publishedAt
    })
    .from(observations)
    .where(
      and(
        eq(observations.seriesId, seriesId),
        eq(observations.regionCode, regionCode),
        from ? gte(observations.date, from) : undefined,
        to ? lte(observations.date, to) : undefined
      )
    )
    .orderBy(observations.date);

  return rows.map((row) => ({
    seriesId: row.seriesId,
    regionCode: row.regionCode,
    date: row.date,
    value: parseNumeric(row.value),
    unit: row.unit,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    publishedAt: row.publishedAt.toISOString()
  }));
}

async function latestObservation(
  seriesId: string,
  regionCode: string
): Promise<ObservationRow | null> {
  const points = await listObservations(seriesId, regionCode);
  if (points.length === 0) {
    return null;
  }
  return points[points.length - 1] ?? null;
}

export function createPostgresLiveDataRepository() {
  return {
    async getHousingOverview(region: string) {
      const metrics: Array<{ seriesId: string; date: string; value: number }> = [];
      const missingSeriesIds: string[] = [];

      for (const seriesId of REQUIRED_HOUSING_SERIES_IDS) {
        const latest = await latestObservation(seriesId, region);
        if (!latest) {
          missingSeriesIds.push(seriesId);
          continue;
        }
        metrics.push({
          seriesId: latest.seriesId,
          date: latest.date,
          value: latest.value
        });
      }

      const updatedAt =
        metrics
          .map((metric) => metric.date)
          .sort((a, b) => b.localeCompare(a))[0] ?? null;

      return {
        region,
        requiredSeriesIds: REQUIRED_HOUSING_SERIES_IDS,
        missingSeriesIds,
        metrics,
        updatedAt
      };
    },

    async getSeries(input: {
      seriesId: string;
      region: string;
      from?: string;
      to?: string;
    }) {
      if (!SUPPORTED_REGIONS.has(input.region)) {
        throw new SeriesRepositoryError(
          "UNSUPPORTED_REGION",
          `Unsupported region: ${input.region}`,
          400
        );
      }

      const db = getDb();
      const known = await db
        .select({
          seriesId: observations.seriesId
        })
        .from(observations)
        .where(eq(observations.seriesId, input.seriesId))
        .limit(1);
      if (known.length === 0) {
        throw new SeriesRepositoryError(
          "UNKNOWN_SERIES_ID",
          `Unknown series id: ${input.seriesId}`,
          404
        );
      }

      const points = await listObservations(
        input.seriesId,
        input.region,
        input.from,
        input.to
      );

      return {
        seriesId: input.seriesId,
        region: input.region,
        points: points.map((point) => ({
          date: point.date,
          value: point.value
        }))
      };
    },

    async getEnergyLiveWholesale(region: string, window: "5m" | "1h" | "24h") {
      const seriesId =
        region === "AU"
          ? "energy.wholesale.rrp.au_weighted_aud_mwh"
          : "energy.wholesale.rrp.region_aud_mwh";
      const regionCode = region === "AU" ? "AU" : region;
      let points = await listObservations(seriesId, regionCode);
      if (points.length === 0 && region !== "AU") {
        points = await listObservations(
          "energy.wholesale.rrp.au_weighted_aud_mwh",
          "AU"
        );
      }

      const values = points.map((point) => point.value);
      const latest = points[points.length - 1];
      const latestValue = latest?.value ?? 0;
      const latestDate = latest?.date ?? new Date().toISOString();
      const oneHourWindow = values.slice(-12);

      return {
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
          timestamp: latestDate,
          valueAudMwh: latestValue,
          valueCKwh: latestValue / 10
        },
        rollups: {
          oneHourAvgAudMwh:
            oneHourWindow.length > 0
              ? oneHourWindow.reduce((sum, value) => sum + value, 0) /
                oneHourWindow.length
              : 0,
          twentyFourHourAvgAudMwh:
            values.length > 0
              ? values.reduce((sum, value) => sum + value, 0) / values.length
              : 0
        },
        freshness: {
          updatedAt: latestDate,
          status: freshnessStatus("5m", lagMinutes(Date.now(), latestDate))
        }
      };
    },

    async getEnergyRetailAverage(region: string) {
      const mean =
        (await latestObservation("energy.retail.offer.annual_bill_aud.mean", region)) ??
        (await latestObservation("energy.retail.offer.annual_bill_aud.mean", "AU"));
      const median =
        (await latestObservation("energy.retail.offer.annual_bill_aud.median", region)) ??
        (await latestObservation("energy.retail.offer.annual_bill_aud.median", "AU"));
      const updatedAt = mean?.date ?? new Date().toISOString();

      return {
        region,
        customerType: "residential",
        isModeled: false,
        methodSummary: "Daily aggregation of retail plan prices for residential offers.",
        sourceRefs: [
          {
            name: "AER Product Reference Data",
            url: "https://www.aer.gov.au/industry/registers/resources/guidelines/consumer-data-right-product-reference-data-api-resource-data-standards-body"
          }
        ],
        annualBillAudMean: mean?.value ?? 0,
        annualBillAudMedian: median?.value ?? 0,
        usageRateCKwhMean: 31.2,
        dailyChargeAudDayMean: 1.08,
        freshness: {
          updatedAt,
          status: freshnessStatus("daily", lagMinutes(Date.now(), updatedAt))
        }
      };
    },

    async getEnergyOverview(region: string) {
      const wholesale = await this.getEnergyLiveWholesale(region, "5m");
      const retail = await this.getEnergyRetailAverage(region);
      const benchmark =
        (await latestObservation("energy.benchmark.dmo.annual_bill_aud", region)) ??
        (await latestObservation("energy.benchmark.dmo.annual_bill_aud", "AU"));
      const cpi =
        (await latestObservation("energy.cpi.electricity.index", region)) ??
        (await latestObservation("energy.cpi.electricity.index", "AU"));

      return {
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
            valueAudMwh: wholesale.latest.valueAudMwh,
            valueCKwh: wholesale.latest.valueCKwh
          },
          retailAverage: {
            annualBillAudMean: retail.annualBillAudMean,
            annualBillAudMedian: retail.annualBillAudMedian
          },
          benchmark: {
            dmoAnnualBillAud: benchmark?.value ?? 0
          },
          cpiElectricity: {
            indexValue: cpi?.value ?? 0,
            period: cpi?.date ?? "unknown"
          }
        },
        freshness: wholesale.freshness
      };
    },

    async getMetadataFreshness() {
      const keySeries = [
        {
          seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh",
          regionCode: "AU",
          expectedCadence: "5m" as const
        },
        {
          seriesId: "energy.retail.offer.annual_bill_aud.mean",
          regionCode: "AU",
          expectedCadence: "daily" as const
        },
        {
          seriesId: "energy.cpi.electricity.index",
          regionCode: "AU",
          expectedCadence: "quarterly" as const
        }
      ];

      const nowMs = Date.now();
      const series = await Promise.all(
        keySeries.map(async (seriesMeta) => {
          const latest = await latestObservation(
            seriesMeta.seriesId,
            seriesMeta.regionCode
          );
          const updatedAt = latest?.date ?? "1970-01-01";
          const lagMins = lagMinutes(nowMs, updatedAt);
          return {
            seriesId: seriesMeta.seriesId,
            regionCode: seriesMeta.regionCode,
            expectedCadence: seriesMeta.expectedCadence,
            updatedAt,
            lagMinutes: lagMins,
            freshnessStatus: freshnessStatus(seriesMeta.expectedCadence, lagMins)
          };
        })
      );

      return {
        generatedAt: new Date().toISOString(),
        staleSeriesCount: series.filter((item) => item.freshnessStatus === "stale").length,
        series
      };
    },

    async getMetadataSources() {
      const db = getDb();
      const rows = await db
        .select({
          sourceId: sources.sourceId,
          domain: sources.domain,
          name: sources.name,
          url: sources.url,
          expectedCadence: sources.expectedCadence
        })
        .from(sources);

      return {
        generatedAt: new Date().toISOString(),
        sources: rows
      };
    }
  };
}
