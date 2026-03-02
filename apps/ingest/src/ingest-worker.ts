import { UnrecoverableError } from "bullmq";
import { createGracefulShutdownHandler, createIngestWorker } from "./queue/worker";
import { attachQueueEventsTelemetry, createQueueEventsClient } from "./queue/events";
import { resolveQueueRuntimeConfig } from "./queue/runtime";

async function main() {
  const queueConfig = resolveQueueRuntimeConfig();
  const worker = createIngestWorker(queueConfig);
  const queueEvents = createQueueEventsClient(queueConfig);

  attachQueueEventsTelemetry(queueEvents, {
    queueName: queueConfig.queueName
  });

  worker.on("error", (error) => {
    console.error(
      JSON.stringify({
        level: "error",
        type: "ingest.worker.error",
        queueName: queueConfig.queueName,
        error: error.message
      })
    );
  });

  worker.on("completed", (job) => {
    console.log(
      JSON.stringify({
        level: "info",
        type: "ingest.worker.completed.event",
        jobId: job.name,
        bullJobId: String(job.id ?? ""),
        queueName: queueConfig.queueName,
        attempt: job.attemptsMade + 1
      })
    );
  });

  worker.on("failed", (job, error) => {
    console.error(
      JSON.stringify({
        level: "error",
        type: "ingest.worker.failed.event",
        jobId: job?.name,
        bullJobId: String(job?.id ?? ""),
        queueName: queueConfig.queueName,
        attempt: job ? job.attemptsMade + 1 : null,
        classification: error instanceof UnrecoverableError ? "unrecoverable" : "retryable",
        error: error.message
      })
    );
  });

  await Promise.all([worker.waitUntilReady(), queueEvents.waitUntilReady()]);

  console.log(
    JSON.stringify({
      level: "info",
      type: "ingest.worker.started",
      queueName: queueConfig.queueName,
      concurrency: queueConfig.workerConcurrency
    })
  );

  const shutdown = createGracefulShutdownHandler(worker);

  const handleSignal = (signal: "SIGINT" | "SIGTERM") => {
    void shutdown(signal)
      .then(async () => {
        await queueEvents.close();
        process.exit(0);
      })
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
  };

  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
