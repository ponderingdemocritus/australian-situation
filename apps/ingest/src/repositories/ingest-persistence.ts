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
import { persistIngestArtifactsInPostgres } from "./postgres-ingest-repository";

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
    return persistIngestArtifactsInPostgres({
      sourceCatalog,
      rawSnapshots,
      observations: input.observations,
      sourceCursors,
      ingestionRun: input.ingestionRun
    });
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
    errorSummary: input.ingestionRun.errorSummary,
    bullJobId: input.ingestionRun.bullJobId,
    queueName: input.ingestionRun.queueName,
    attempt: input.ingestionRun.attempt,
    runMode: input.ingestionRun.runMode
  });
  writeLiveStoreSync(store, input.storePath);

  return upsertResult;
}
