import {
  appendIngestionRun,
  readLiveStoreSync,
  setSourceCursor,
  stageRawPayload,
  upsertObservations,
  upsertSourceCatalog,
  writeLiveStoreSync,
  type IngestionRun,
  type LiveObservation,
  type SourceCatalogItem,
  type StageRawPayloadInput
} from "@aus-dash/shared";
import type { IngestBackend } from "./ingest-backend";
import {
  appendIngestionRunInPostgres,
  ensureSourceCatalogInPostgres,
  setSourceCursorInPostgres,
  stageRawPayloadInPostgres,
  upsertObservationsInPostgres
} from "./postgres-ingest-repository";

export type SourceCursorUpdate = {
  sourceId: string;
  cursor: string;
};

type IngestionRunInput = Omit<
  IngestionRun,
  "runId" | "rowsInserted" | "rowsUpdated"
>;

export type PersistIngestArtifactsInput = {
  backend: IngestBackend;
  storePath?: string;
  sourceCatalog?: SourceCatalogItem[];
  rawSnapshots?: StageRawPayloadInput[];
  observations: LiveObservation[];
  sourceCursors?: SourceCursorUpdate[];
  ingestionRun: IngestionRunInput;
};

export async function persistIngestArtifacts(
  input: PersistIngestArtifactsInput
): Promise<{ inserted: number; updated: number }> {
  const sourceCatalog = input.sourceCatalog ?? [];
  const rawSnapshots = input.rawSnapshots ?? [];
  const sourceCursors = input.sourceCursors ?? [];

  if (input.backend === "postgres") {
    await ensureSourceCatalogInPostgres(sourceCatalog);
    for (const snapshot of rawSnapshots) {
      await stageRawPayloadInPostgres(snapshot);
    }

    const upsertResult = await upsertObservationsInPostgres(input.observations);

    for (const cursor of sourceCursors) {
      await setSourceCursorInPostgres(cursor.sourceId, cursor.cursor);
    }

    await appendIngestionRunInPostgres({
      job: input.ingestionRun.job,
      status: input.ingestionRun.status,
      startedAt: input.ingestionRun.startedAt,
      finishedAt: input.ingestionRun.finishedAt,
      rowsInserted: upsertResult.inserted,
      rowsUpdated: upsertResult.updated,
      errorSummary: input.ingestionRun.errorSummary
    });

    return upsertResult;
  }

  const store = readLiveStoreSync(input.storePath);
  upsertSourceCatalog(store, sourceCatalog);

  for (const snapshot of rawSnapshots) {
    stageRawPayload(store, snapshot);
  }

  const upsertResult = upsertObservations(store, input.observations);

  for (const cursor of sourceCursors) {
    setSourceCursor(store, cursor.sourceId, cursor.cursor);
  }

  appendIngestionRun(store, {
    job: input.ingestionRun.job,
    status: input.ingestionRun.status,
    startedAt: input.ingestionRun.startedAt,
    finishedAt: input.ingestionRun.finishedAt,
    rowsInserted: upsertResult.inserted,
    rowsUpdated: upsertResult.updated,
    errorSummary: input.ingestionRun.errorSummary
  });
  writeLiveStoreSync(store, input.storePath);

  return upsertResult;
}
