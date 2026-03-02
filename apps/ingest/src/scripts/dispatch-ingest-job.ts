import { dispatchManualJob } from "../queue/dispatch";
import { createIngestQueue, resolveQueueRuntimeConfig } from "../queue/runtime";

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function main() {
  const jobId = process.argv[2];
  if (!jobId || jobId.startsWith("--")) {
    throw new Error("Usage: bun src/scripts/dispatch-ingest-job.ts <jobId> [--source-mode fixture|live] [--ingest-backend store|postgres] [--store-path /path] [--dedupe-key key]");
  }

  const sourceMode = readArg("--source-mode") as "fixture" | "live" | undefined;
  const ingestBackend = readArg("--ingest-backend") as "store" | "postgres" | undefined;
  const storePath = readArg("--store-path");
  const dedupeKey = readArg("--dedupe-key");

  const queue = createIngestQueue(resolveQueueRuntimeConfig());
  try {
    const result = await dispatchManualJob(queue, {
      jobId,
      dedupeKey,
      payload: {
        sourceMode,
        ingestBackend,
        storePath
      }
    });

    console.log(
      JSON.stringify(
        {
          status: "ok",
          ...result
        },
        null,
        2
      )
    );
  } finally {
    await queue.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
