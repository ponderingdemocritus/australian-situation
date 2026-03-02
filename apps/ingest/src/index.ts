import { runLegacyIngestOrchestration } from "./legacy-orchestrator";
import { upsertRecurringJobSchedulers } from "./queue/scheduler";
import { createGracefulShutdownHandler, createIngestWorker } from "./queue/worker";
import { attachQueueEventsTelemetry, createQueueEventsClient } from "./queue/events";
import { createIngestQueue, resolveQueueRuntimeConfig } from "./queue/runtime";
import {
  assertLegacyRuntimeAllowed,
  resolveIngestRuntimeMode
} from "./runtime-mode";

async function runBullMqRuntime() {
  const queueConfig = resolveQueueRuntimeConfig();
  const queue = createIngestQueue(queueConfig);
  const worker = createIngestWorker(queueConfig);
  const queueEvents = createQueueEventsClient(queueConfig);

  attachQueueEventsTelemetry(queueEvents, {
    queueName: queueConfig.queueName
  });

  await upsertRecurringJobSchedulers(queue);
  await Promise.all([worker.waitUntilReady(), queueEvents.waitUntilReady()]);

  console.log(
    JSON.stringify({
      level: "info",
      type: "ingest.runtime.started",
      runtime: "bullmq",
      queueName: queueConfig.queueName,
      concurrency: queueConfig.workerConcurrency
    })
  );

  const shutdownWorker = createGracefulShutdownHandler(worker);

  const shutdown = async (signal: "SIGINT" | "SIGTERM") => {
    await shutdownWorker(signal);
    await Promise.all([queueEvents.close(), queue.close()]);
  };

  const handleSignal = (signal: "SIGINT" | "SIGTERM") => {
    void shutdown(signal)
      .then(() => {
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

async function main() {
  const runtimeMode = resolveIngestRuntimeMode(process.env.AUS_DASH_INGEST_RUNTIME);

  if (runtimeMode === "legacy") {
    assertLegacyRuntimeAllowed(process.env.NODE_ENV);
    const legacyResult = await runLegacyIngestOrchestration();
    console.log(JSON.stringify(legacyResult, null, 2));
    return;
  }

  await runBullMqRuntime();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
