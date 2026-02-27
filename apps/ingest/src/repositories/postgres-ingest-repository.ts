import {
  getDb,
  ingestionRuns,
  observations,
  rawSnapshots,
  sourceCursors,
  sources
} from "@aus-dash/db";
import {
  payloadChecksumSha256,
  type IngestionRun,
  type LiveObservation,
  type SourceCatalogItem
} from "@aus-dash/shared";
import { and, eq } from "drizzle-orm";

function parseDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

export async function ensureSourceCatalogInPostgres(
  sourceCatalog: SourceCatalogItem[]
): Promise<void> {
  if (sourceCatalog.length === 0) {
    return;
  }

  const db = getDb();
  for (const sourceItem of sourceCatalog) {
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
    capturedAt: parseDate(input.capturedAt),
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
  const db = getDb();
  let inserted = 0;
  let updated = 0;

  for (const observation of incoming) {
    const existing = await db
      .select({
        id: observations.id
      })
      .from(observations)
      .where(
        and(
          eq(observations.seriesId, observation.seriesId),
          eq(observations.regionCode, observation.regionCode),
          eq(observations.date, observation.date),
          eq(observations.vintage, observation.vintage)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(observations).values({
        seriesId: observation.seriesId,
        regionCode: observation.regionCode,
        date: observation.date,
        value: String(observation.value),
        unit: observation.unit,
        sourceName: observation.sourceName,
        sourceUrl: observation.sourceUrl,
        publishedAt: parseDate(observation.publishedAt),
        ingestedAt: parseDate(observation.ingestedAt),
        vintage: observation.vintage,
        isModeled: observation.isModeled,
        confidence: observation.confidence
      });
      inserted += 1;
      continue;
    }

    await db
      .update(observations)
      .set({
        value: String(observation.value),
        unit: observation.unit,
        sourceName: observation.sourceName,
        sourceUrl: observation.sourceUrl,
        publishedAt: parseDate(observation.publishedAt),
        ingestedAt: parseDate(observation.ingestedAt),
        isModeled: observation.isModeled,
        confidence: observation.confidence
      })
      .where(eq(observations.id, existing[0]!.id));
    updated += 1;
  }

  return { inserted, updated };
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

  await db.insert(ingestionRuns).values({
    runId: ingestionRun.runId,
    job: ingestionRun.job,
    status: ingestionRun.status,
    startedAt: parseDate(ingestionRun.startedAt),
    finishedAt: parseDate(ingestionRun.finishedAt),
    rowsInserted: ingestionRun.rowsInserted,
    rowsUpdated: ingestionRun.rowsUpdated,
    errorSummary: ingestionRun.errorSummary ?? null
  });

  return ingestionRun;
}

export async function upsertIngestionRunInPostgres(run: IngestionRun): Promise<void> {
  const db = getDb();
  await db
    .insert(ingestionRuns)
    .values({
      runId: run.runId,
      job: run.job,
      status: run.status,
      startedAt: parseDate(run.startedAt),
      finishedAt: parseDate(run.finishedAt),
      rowsInserted: run.rowsInserted,
      rowsUpdated: run.rowsUpdated,
      errorSummary: run.errorSummary ?? null
    })
    .onConflictDoUpdate({
      target: ingestionRuns.runId,
      set: {
        job: run.job,
        status: run.status,
        startedAt: parseDate(run.startedAt),
        finishedAt: parseDate(run.finishedAt),
        rowsInserted: run.rowsInserted,
        rowsUpdated: run.rowsUpdated,
        errorSummary: run.errorSummary ?? null
      }
    });
}
