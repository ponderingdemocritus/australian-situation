import {
  getDb,
  ingestionRuns,
  observations,
  rawSnapshots,
  sourceCursors,
  sources
} from "@aus-dash/db";
import {
  dedupeSourceCatalogItems,
  payloadChecksumSha256,
  type IngestionRun,
  type LiveObservation,
  type SourceCatalogItem
} from "@aus-dash/shared";
import { and, eq, inArray, or, sql } from "drizzle-orm";

function parseDate(value: string, fieldName: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
  return parsed;
}

function parseOptionalDate(value: string | undefined, fieldName: string): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
  return parsed;
}

function observationConflictKey(
  observation: Pick<LiveObservation, "seriesId" | "regionCode" | "date" | "vintage">
): string {
  return [
    observation.seriesId,
    observation.regionCode,
    observation.date,
    observation.vintage
  ].join("|");
}

function parseNumeric(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapObservationForPostgres(observation: LiveObservation) {
  return {
    seriesId: observation.seriesId,
    regionCode: observation.regionCode,
    countryCode: observation.countryCode ?? null,
    market: observation.market ?? null,
    metricFamily: observation.metricFamily ?? null,
    date: observation.date,
    intervalStartUtc: parseOptionalDate(
      observation.intervalStartUtc,
      `${observation.seriesId} intervalStartUtc`
    ),
    intervalEndUtc: parseOptionalDate(
      observation.intervalEndUtc,
      `${observation.seriesId} intervalEndUtc`
    ),
    value: String(observation.value),
    unit: observation.unit,
    currency: observation.currency ?? null,
    taxStatus: observation.taxStatus ?? null,
    consumptionBand: observation.consumptionBand ?? null,
    sourceName: observation.sourceName,
    sourceUrl: observation.sourceUrl,
    publishedAt: parseDate(observation.publishedAt, `${observation.seriesId} publishedAt`),
    ingestedAt: parseDate(observation.ingestedAt, `${observation.seriesId} ingestedAt`),
    vintage: observation.vintage,
    isModeled: observation.isModeled,
    confidence: observation.confidence,
    methodologyVersion: observation.methodologyVersion ?? null
  };
}

export function mapIngestionRunForPostgres(run: IngestionRun) {
  return {
    runId: run.runId,
    job: run.job,
    status: run.status,
    startedAt: parseDate(run.startedAt, `${run.job} startedAt`),
    finishedAt: parseDate(run.finishedAt, `${run.job} finishedAt`),
    rowsInserted: run.rowsInserted,
    rowsUpdated: run.rowsUpdated,
    errorSummary: run.errorSummary ?? null,
    bullJobId: run.bullJobId ?? null,
    queueName: run.queueName ?? null,
    attempt: run.attempt ?? null,
    runMode: run.runMode ?? null
  };
}

export async function ensureSourceCatalogInPostgres(
  sourceCatalog: SourceCatalogItem[]
): Promise<void> {
  const dedupedSourceCatalog = dedupeSourceCatalogItems(sourceCatalog);

  if (dedupedSourceCatalog.length === 0) {
    return;
  }

  const db = getDb();
  for (const sourceItem of dedupedSourceCatalog) {
    await db
      .insert(sources)
      .values({
        sourceId: sourceItem.sourceId,
        domain: sourceItem.domain,
        name: sourceItem.name,
        url: sourceItem.url,
        expectedCadence: sourceItem.expectedCadence
      })
      .onConflictDoUpdate({
        target: sources.sourceId,
        set: {
          domain: sourceItem.domain,
          name: sourceItem.name,
          url: sourceItem.url,
          expectedCadence: sourceItem.expectedCadence
        }
      });
  }
}

export async function stageRawPayloadInPostgres(input: {
  sourceId: string;
  payload: string;
  contentType: string;
  capturedAt: string;
}) {
  const db = getDb();
  const checksumSha256 = payloadChecksumSha256(input.payload);

  const existing = await db
    .select({
      snapshotId: rawSnapshots.snapshotId,
      sourceId: rawSnapshots.sourceId,
      checksumSha256: rawSnapshots.checksumSha256,
      capturedAt: rawSnapshots.capturedAt,
      contentType: rawSnapshots.contentType,
      payload: rawSnapshots.payload
    })
    .from(rawSnapshots)
    .where(
      and(
        eq(rawSnapshots.sourceId, input.sourceId),
        eq(rawSnapshots.checksumSha256, checksumSha256)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      staged: false,
      snapshot: {
        ...existing[0]!,
        capturedAt: existing[0]!.capturedAt.toISOString()
      }
    };
  }

  const snapshotId = `${input.sourceId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  await db.insert(rawSnapshots).values({
    snapshotId,
    sourceId: input.sourceId,
    checksumSha256,
    capturedAt: parseDate(input.capturedAt, `${input.sourceId} capturedAt`),
    contentType: input.contentType,
    payload: input.payload
  });

  return {
    staged: true,
    snapshot: {
      snapshotId,
      sourceId: input.sourceId,
      checksumSha256,
      capturedAt: input.capturedAt,
      contentType: input.contentType,
      payload: input.payload
    }
  };
}

export async function upsertObservationsInPostgres(
  incoming: LiveObservation[]
): Promise<{ inserted: number; updated: number }> {
  if (incoming.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  const db = getDb();
  const mappedIncoming = incoming.map((observation) => ({
    original: observation,
    mapped: mapObservationForPostgres(observation)
  }));
  const existingRows = await db
    .select({
      seriesId: observations.seriesId,
      regionCode: observations.regionCode,
      date: observations.date,
      vintage: observations.vintage
    })
    .from(observations)
    .where(
      incoming.length === 1
        ? and(
            eq(observations.seriesId, incoming[0]!.seriesId),
            eq(observations.regionCode, incoming[0]!.regionCode),
            eq(observations.date, incoming[0]!.date),
            eq(observations.vintage, incoming[0]!.vintage)
          )
        : or(
            ...incoming.map((observation) =>
              and(
                eq(observations.seriesId, observation.seriesId),
                eq(observations.regionCode, observation.regionCode),
                eq(observations.date, observation.date),
                eq(observations.vintage, observation.vintage)
              )
            )
          )
    );

  const existingKeys = new Set(existingRows.map((row) => observationConflictKey(row)));
  const inserted = mappedIncoming.filter(
    ({ original }) => !existingKeys.has(observationConflictKey(original))
  ).length;
  const updated = mappedIncoming.length - inserted;

  await db
    .insert(observations)
    .values(mappedIncoming.map(({ mapped }) => mapped))
    .onConflictDoUpdate({
      target: [
        observations.seriesId,
        observations.regionCode,
        observations.date,
        observations.vintage
      ],
      set: {
        countryCode: sql.raw("excluded.country_code"),
        market: sql.raw("excluded.market"),
        metricFamily: sql.raw("excluded.metric_family"),
        intervalStartUtc: sql.raw("excluded.interval_start_utc"),
        intervalEndUtc: sql.raw("excluded.interval_end_utc"),
        value: sql.raw("excluded.value"),
        unit: sql.raw("excluded.unit"),
        currency: sql.raw("excluded.currency"),
        taxStatus: sql.raw("excluded.tax_status"),
        consumptionBand: sql.raw("excluded.consumption_band"),
        sourceName: sql.raw("excluded.source_name"),
        sourceUrl: sql.raw("excluded.source_url"),
        publishedAt: sql.raw("excluded.published_at"),
        ingestedAt: sql.raw("excluded.ingested_at"),
        isModeled: sql.raw("excluded.is_modeled"),
        confidence: sql.raw("excluded.confidence"),
        methodologyVersion: sql.raw("excluded.methodology_version")
      }
    });

  return { inserted, updated };
}

export async function listObservationsInPostgres(
  seriesIds: string[]
): Promise<LiveObservation[]> {
  if (seriesIds.length === 0) {
    return [];
  }

  const db = getDb();
  const rows = await db
    .select({
      seriesId: observations.seriesId,
      regionCode: observations.regionCode,
      countryCode: observations.countryCode,
      market: observations.market,
      metricFamily: observations.metricFamily,
      date: observations.date,
      intervalStartUtc: observations.intervalStartUtc,
      intervalEndUtc: observations.intervalEndUtc,
      value: observations.value,
      unit: observations.unit,
      currency: observations.currency,
      taxStatus: observations.taxStatus,
      consumptionBand: observations.consumptionBand,
      sourceName: observations.sourceName,
      sourceUrl: observations.sourceUrl,
      publishedAt: observations.publishedAt,
      ingestedAt: observations.ingestedAt,
      vintage: observations.vintage,
      isModeled: observations.isModeled,
      confidence: observations.confidence,
      methodologyVersion: observations.methodologyVersion
    })
    .from(observations)
    .where(inArray(observations.seriesId, seriesIds));

  return rows.map((row) => ({
    seriesId: row.seriesId,
    regionCode: row.regionCode,
    countryCode: row.countryCode ?? undefined,
    market: row.market ?? undefined,
    metricFamily: row.metricFamily ?? undefined,
    date: row.date,
    intervalStartUtc: row.intervalStartUtc?.toISOString(),
    intervalEndUtc: row.intervalEndUtc?.toISOString(),
    value: parseNumeric(row.value),
    unit: row.unit,
    currency: row.currency ?? undefined,
    taxStatus: row.taxStatus ?? undefined,
    consumptionBand: row.consumptionBand ?? undefined,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    publishedAt: row.publishedAt.toISOString(),
    ingestedAt: row.ingestedAt.toISOString(),
    vintage: row.vintage,
    isModeled: row.isModeled,
    confidence: row.confidence as LiveObservation["confidence"],
    methodologyVersion: row.methodologyVersion ?? undefined
  }));
}

export async function setSourceCursorInPostgres(
  sourceId: string,
  cursor: string
): Promise<void> {
  const db = getDb();
  const updatedAt = new Date();
  await db
    .insert(sourceCursors)
    .values({
      sourceId,
      cursor,
      updatedAt
    })
    .onConflictDoUpdate({
      target: sourceCursors.sourceId,
      set: {
        cursor,
        updatedAt
      }
    });
}

export async function appendIngestionRunInPostgres(
  run: Omit<IngestionRun, "runId">
): Promise<IngestionRun> {
  const db = getDb();
  const ingestionRun: IngestionRun = {
    runId: `${run.job}-${Date.now()}`,
    ...run
  };
  const mapped = mapIngestionRunForPostgres(ingestionRun);

  await db.insert(ingestionRuns).values(mapped);

  return ingestionRun;
}

export async function persistIngestArtifactsInPostgres(input: {
  sourceCatalog: SourceCatalogItem[];
  rawSnapshots: Array<{
    sourceId: string;
    payload: string;
    contentType: string;
    capturedAt: string;
  }>;
  observations: LiveObservation[];
  sourceCursors: Array<{
    sourceId: string;
    cursor: string;
  }>;
  ingestionRun: Omit<IngestionRun, "runId" | "rowsInserted" | "rowsUpdated">;
}): Promise<{ inserted: number; updated: number }> {
  const db = getDb();
  const dedupedSourceCatalog = dedupeSourceCatalogItems(input.sourceCatalog);

  return db.transaction(async (tx) => {
    if (dedupedSourceCatalog.length > 0) {
      await tx
        .insert(sources)
        .values(
          dedupedSourceCatalog.map((sourceItem) => ({
            sourceId: sourceItem.sourceId,
            domain: sourceItem.domain,
            name: sourceItem.name,
            url: sourceItem.url,
            expectedCadence: sourceItem.expectedCadence
          }))
        )
        .onConflictDoUpdate({
          target: sources.sourceId,
          set: {
            domain: sql.raw("excluded.domain"),
            name: sql.raw("excluded.name"),
            url: sql.raw("excluded.url"),
            expectedCadence: sql.raw("excluded.expected_cadence")
          }
        });
    }

    for (const snapshot of input.rawSnapshots) {
      const checksumSha256 = payloadChecksumSha256(snapshot.payload);
      const existingSnapshot = await tx
        .select({ snapshotId: rawSnapshots.snapshotId })
        .from(rawSnapshots)
        .where(
          and(
            eq(rawSnapshots.sourceId, snapshot.sourceId),
            eq(rawSnapshots.checksumSha256, checksumSha256)
          )
        )
        .limit(1);

      if (existingSnapshot.length === 0) {
        await tx.insert(rawSnapshots).values({
          snapshotId: `${snapshot.sourceId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          sourceId: snapshot.sourceId,
          checksumSha256,
          capturedAt: parseDate(snapshot.capturedAt, `${snapshot.sourceId} capturedAt`),
          contentType: snapshot.contentType,
          payload: snapshot.payload
        });
      }
    }

    const mappedObservations = input.observations.map((observation) => ({
      original: observation,
      mapped: mapObservationForPostgres(observation)
    }));
    let inserted = 0;
    let updated = 0;

    if (mappedObservations.length > 0) {
      const existingObservationRows = await tx
        .select({
          seriesId: observations.seriesId,
          regionCode: observations.regionCode,
          date: observations.date,
          vintage: observations.vintage
        })
        .from(observations)
        .where(
          mappedObservations.length === 1
            ? and(
                eq(observations.seriesId, mappedObservations[0]!.original.seriesId),
                eq(observations.regionCode, mappedObservations[0]!.original.regionCode),
                eq(observations.date, mappedObservations[0]!.original.date),
                eq(observations.vintage, mappedObservations[0]!.original.vintage)
              )
            : or(
                ...mappedObservations.map(({ original }) =>
                  and(
                    eq(observations.seriesId, original.seriesId),
                    eq(observations.regionCode, original.regionCode),
                    eq(observations.date, original.date),
                    eq(observations.vintage, original.vintage)
                  )
                )
              )
        );

      const existingKeys = new Set(
        existingObservationRows.map((row) => observationConflictKey(row))
      );
      inserted = mappedObservations.filter(
        ({ original }) => !existingKeys.has(observationConflictKey(original))
      ).length;
      updated = mappedObservations.length - inserted;

      await tx
        .insert(observations)
        .values(mappedObservations.map(({ mapped }) => mapped))
        .onConflictDoUpdate({
          target: [
            observations.seriesId,
            observations.regionCode,
            observations.date,
            observations.vintage
          ],
          set: {
            countryCode: sql.raw("excluded.country_code"),
            market: sql.raw("excluded.market"),
            metricFamily: sql.raw("excluded.metric_family"),
            intervalStartUtc: sql.raw("excluded.interval_start_utc"),
            intervalEndUtc: sql.raw("excluded.interval_end_utc"),
            value: sql.raw("excluded.value"),
            unit: sql.raw("excluded.unit"),
            currency: sql.raw("excluded.currency"),
            taxStatus: sql.raw("excluded.tax_status"),
            consumptionBand: sql.raw("excluded.consumption_band"),
            sourceName: sql.raw("excluded.source_name"),
            sourceUrl: sql.raw("excluded.source_url"),
            publishedAt: sql.raw("excluded.published_at"),
            ingestedAt: sql.raw("excluded.ingested_at"),
            isModeled: sql.raw("excluded.is_modeled"),
            confidence: sql.raw("excluded.confidence"),
            methodologyVersion: sql.raw("excluded.methodology_version")
          }
        });
    }

    for (const cursor of input.sourceCursors) {
      const updatedAt = new Date();
      await tx
        .insert(sourceCursors)
        .values({
          sourceId: cursor.sourceId,
          cursor: cursor.cursor,
          updatedAt
        })
        .onConflictDoUpdate({
          target: sourceCursors.sourceId,
          set: {
            cursor: cursor.cursor,
            updatedAt
          }
        });
    }

    const mappedRun = mapIngestionRunForPostgres({
      runId: `${input.ingestionRun.job}-${Date.now()}`,
      ...input.ingestionRun,
      rowsInserted: inserted,
      rowsUpdated: updated
    });
    await tx.insert(ingestionRuns).values(mappedRun);

    return { inserted, updated };
  });
}

export async function upsertIngestionRunInPostgres(run: IngestionRun): Promise<void> {
  const db = getDb();
  const mapped = mapIngestionRunForPostgres(run);
  await db
    .insert(ingestionRuns)
    .values(mapped)
    .onConflictDoUpdate({
      target: ingestionRuns.runId,
      set: {
        job: mapped.job,
        status: mapped.status,
        startedAt: mapped.startedAt,
        finishedAt: mapped.finishedAt,
        rowsInserted: mapped.rowsInserted,
        rowsUpdated: mapped.rowsUpdated,
        errorSummary: mapped.errorSummary,
        bullJobId: mapped.bullJobId,
        queueName: mapped.queueName,
        attempt: mapped.attempt,
        runMode: mapped.runMode
      }
    });
}
