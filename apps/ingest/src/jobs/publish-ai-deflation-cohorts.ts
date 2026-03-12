import {
  appendIngestionRun,
  getSourceCatalogItems,
  readLiveStoreSync,
  upsertObservations,
  writeLiveStoreSync,
  type LiveObservation,
  type UnresolvedPriceItem
} from "@aus-dash/shared";
import {
  buildIngestRunAuditFields,
  type IngestRunAuditOptions
} from "./ingest-run-audit";

type PublishAiDeflationCohortsOptions = IngestRunAuditOptions & {
  storePath?: string;
  sourceId?: string;
  asOf?: string;
};

export type PublishAiDeflationCohortsResult = {
  job: "publish-ai-deflation-cohorts";
  status: "ok";
  rowsInserted: number;
  rowsUpdated: number;
  publishedSeriesIds: string[];
  syncedAt: string;
};

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) {
    return 0;
  }

  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }

  return sorted[middle] ?? 0;
}

export async function publishAiDeflationCohorts(
  options: PublishAiDeflationCohortsOptions = {}
): Promise<PublishAiDeflationCohortsResult> {
  const syncedAt = options.asOf ?? new Date().toISOString();
  const store = readLiveStoreSync(options.storePath);
  const sourceItem = getSourceCatalogItems(["major_goods_prices"])[0]!;

  const promotedItems = store.unresolvedPriceItems.filter(
    (item): item is UnresolvedPriceItem =>
      item.status === "promoted" &&
      item.cohortReady === true &&
      Boolean(item.canonicalProductSlug) &&
      (!options.sourceId || item.sourceId === options.sourceId)
  );

  const grouped = new Map<string, number[]>();
  for (const item of promotedItems) {
    const date = item.observedAt.slice(0, 10);
    const key = `${date}:${item.regionCode}:${item.canonicalProductSlug}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(item.priceAmount);
    } else {
      grouped.set(key, [item.priceAmount]);
    }
  }

  const productSeries = [...grouped.entries()].map(([key, prices]) => {
    const [date, regionCode, canonicalProductSlug] = key.split(":");
    const exemplar = promotedItems.find(
      (item) =>
        item.regionCode === regionCode &&
        item.canonicalProductSlug === canonicalProductSlug &&
        item.observedAt.startsWith(date)
    )!;

    return {
      date,
      regionCode,
      canonicalProductSlug,
      medianPrice: round(median(prices), 2),
      isAustralianMade: exemplar.isAustralianMade ?? false,
      aiExposureLevel: exemplar.aiExposureLevel ?? "low",
      isControlCandidate: exemplar.isControlCandidate ?? false
    };
  });

  const regions = [...new Set(productSeries.map((item) => item.regionCode))];
  const dates = [...new Set(productSeries.map((item) => item.date))].sort();
  const productBase = new Map<string, number>();
  for (const regionCode of regions) {
    const productSlugs = new Set(
      productSeries
        .filter((item) => item.regionCode === regionCode)
        .map((item) => item.canonicalProductSlug)
    );
    for (const slug of productSlugs) {
      const base = productSeries
        .filter((item) => item.regionCode === regionCode && item.canonicalProductSlug === slug)
        .sort((left, right) => left.date.localeCompare(right.date))[0];
      if (base) {
        productBase.set(`${regionCode}:${slug}`, base.medianPrice);
      }
    }
  }

  const observations: LiveObservation[] = [];
  const cohortDefinitions = [
    {
      seriesId: "prices.au_made.all.index",
      select: (row: (typeof productSeries)[number]) => row.isAustralianMade
    },
    {
      seriesId: "prices.au_made.ai_exposed.index",
      select: (row: (typeof productSeries)[number]) =>
        row.isAustralianMade && row.aiExposureLevel === "high"
    },
    {
      seriesId: "prices.au_made.control.index",
      select: (row: (typeof productSeries)[number]) =>
        row.isAustralianMade && row.isControlCandidate
    },
    {
      seriesId: "prices.imported.matched_control.index",
      select: (row: (typeof productSeries)[number]) =>
        !row.isAustralianMade && row.isControlCandidate
    }
  ] as const;

  for (const definition of cohortDefinitions) {
    for (const regionCode of regions) {
      for (const date of dates) {
        const cohortRows = productSeries.filter(
          (row) => row.regionCode === regionCode && row.date === date && definition.select(row)
        );
        if (cohortRows.length === 0) {
          continue;
        }

        const values = cohortRows
          .map((row) => {
            const base = productBase.get(`${regionCode}:${row.canonicalProductSlug}`);
            if (!base || base === 0) {
              return null;
            }
            return round((row.medianPrice / base) * 100, 2);
          })
          .filter((value): value is number => value !== null);

        if (values.length === 0) {
          continue;
        }

        observations.push({
          seriesId: definition.seriesId,
          regionCode,
          market: "ai_deflation",
          metricFamily: "prices",
          date,
          value: round(values.reduce((sum, value) => sum + value, 0) / values.length, 2),
          unit: "index",
          sourceName: sourceItem.name,
          sourceUrl: sourceItem.url,
          publishedAt: syncedAt,
          ingestedAt: syncedAt,
          vintage: syncedAt.slice(0, 10),
          isModeled: false,
          confidence: "derived",
          methodologyVersion: "prices-major-goods-v1"
        });
      }
    }
  }

  for (const regionCode of regions) {
    for (const date of dates) {
      const aiExposed = observations.find(
        (item) =>
          item.seriesId === "prices.au_made.ai_exposed.index" &&
          item.regionCode === regionCode &&
          item.date === date
      );
      const control = observations.find(
        (item) =>
          item.seriesId === "prices.au_made.control.index" &&
          item.regionCode === regionCode &&
          item.date === date
      );
      if (!aiExposed || !control) {
        continue;
      }

      observations.push({
        seriesId: "prices.ai_deflation.spread.au_made_vs_control.index",
        regionCode,
        market: "ai_deflation",
        metricFamily: "prices",
        date,
        value: round(aiExposed.value - control.value, 2),
        unit: "index_points",
        sourceName: sourceItem.name,
        sourceUrl: sourceItem.url,
        publishedAt: syncedAt,
        ingestedAt: syncedAt,
        vintage: syncedAt.slice(0, 10),
        isModeled: false,
        confidence: "derived",
        methodologyVersion: "prices-major-goods-v1"
      });
    }
  }

  const upsertResult = upsertObservations(store, observations);
  appendIngestionRun(store, {
    job: "publish-ai-deflation-cohorts",
    status: "ok",
    startedAt: syncedAt,
    finishedAt: syncedAt,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    ...buildIngestRunAuditFields(options)
  });
  writeLiveStoreSync(store, options.storePath);

  return {
    job: "publish-ai-deflation-cohorts",
    status: "ok",
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    publishedSeriesIds: [...new Set(observations.map((item) => item.seriesId))],
    syncedAt
  };
}
