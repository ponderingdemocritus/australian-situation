import { closeDb } from "@aus-dash/db";
import { readLiveStoreSync } from "@aus-dash/shared";
import {
  ensureSourceCatalogInPostgres,
  setSourceCursorInPostgres,
  stageRawPayloadInPostgres,
  upsertIngestionRunInPostgres,
  upsertObservationsInPostgres
} from "../repositories/postgres-ingest-repository";

async function main() {
  const explicitStorePath = process.argv[2];
  const store = readLiveStoreSync(explicitStorePath);

  await ensureSourceCatalogInPostgres(store.sources);

  for (const snapshot of store.rawSnapshots) {
    await stageRawPayloadInPostgres({
      sourceId: snapshot.sourceId,
      payload: snapshot.payload,
      contentType: snapshot.contentType,
      capturedAt: snapshot.capturedAt
    });
  }

  const observationUpsert = await upsertObservationsInPostgres(store.observations);

  for (const cursor of store.sourceCursors) {
    await setSourceCursorInPostgres(cursor.sourceId, cursor.cursor);
  }

  for (const run of store.ingestionRuns) {
    await upsertIngestionRunInPostgres(run);
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        storePath: explicitStorePath ?? process.env.AUS_DASH_STORE_PATH ?? "data/live-store.json",
        summary: {
          sources: store.sources.length,
          rawSnapshots: store.rawSnapshots.length,
          observationsInserted: observationUpsert.inserted,
          observationsUpdated: observationUpsert.updated,
          sourceCursors: store.sourceCursors.length,
          ingestionRuns: store.ingestionRuns.length
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
