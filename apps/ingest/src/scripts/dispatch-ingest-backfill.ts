import { dispatchBackfillJob } from "../queue/dispatch";
import { createIngestQueue, resolveQueueRuntimeConfig } from "../queue/runtime";

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const jobId = process.argv[2];
  if (!jobId || jobId.startsWith("--")) {
    throw new Error(
      "Usage: bun src/scripts/dispatch-ingest-backfill.ts <jobId> --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run] [--source-mode fixture|live] [--ingest-backend store|postgres] [--store-path /path]"
    );
  }

  const from = readArg("--from");
  const to = readArg("--to");
  if (!from || !to) {
    throw new Error("Both --from and --to are required");
  }

  const sourceMode = readArg("--source-mode") as "fixture" | "live" | undefined;
  const ingestBackend = readArg("--ingest-backend") as "store" | "postgres" | undefined;
  const storePath = readArg("--store-path");
  const dryRun = hasFlag("--dry-run");

  const queue = createIngestQueue(resolveQueueRuntimeConfig());
  try {
    const result = await dispatchBackfillJob(queue, {
      jobId,
      from,
      to,
      dryRun,
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
