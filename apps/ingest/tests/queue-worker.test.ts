import { SourceClientError } from "../src/sources/live-source-clients";
import { describe, expect, test, vi } from "vitest";
import { UnrecoverableError } from "bullmq";
import {
  buildRegistryBackedProcessor,
  classifyWorkerFailure,
  createGracefulShutdownHandler
} from "../src/queue/worker";

describe("bullmq worker runtime", () => {
  test("dispatches job by name through registry processor", async () => {
    const processor = buildRegistryBackedProcessor([
      {
        jobId: "sync-energy-wholesale-5m",
        processor: vi.fn().mockResolvedValue({ status: "ok" })
      }
    ]);

    const result = await processor({
      id: "job-1",
      name: "sync-energy-wholesale-5m",
      attemptsMade: 0,
      data: { sourceMode: "fixture" },
      queueName: "ingest-jobs"
    });

    expect(result).toEqual({ status: "ok" });
  });

  test("marks transient source errors as retryable", () => {
    const failure = classifyWorkerFailure(
      new SourceClientError("aemo_wholesale", "upstream timeout", {
        transient: true,
        status: 503
      })
    );

    expect(failure.classification).toBe("retryable");
  });

  test("marks non-transient source errors as unrecoverable", () => {
    const failure = classifyWorkerFailure(
      new SourceClientError("abs_housing", "schema mismatch", {
        transient: false
      })
    );

    expect(failure.classification).toBe("unrecoverable");
    expect(failure.error.name).toBe("UnrecoverableError");
  });

  test("processor rethrows non-transient source errors as UnrecoverableError", async () => {
    const processor = buildRegistryBackedProcessor([
      {
        jobId: "sync-energy-wholesale-5m",
        processor: vi.fn().mockRejectedValue(
          new SourceClientError("abs_housing", "schema mismatch", {
            transient: false
          })
        )
      }
    ]);

    await expect(
      processor({
        id: "job-2",
        name: "sync-energy-wholesale-5m",
        attemptsMade: 0,
        data: {},
        queueName: "ingest-jobs"
      })
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  test("graceful shutdown handler closes worker on SIGTERM", async () => {
    const worker = {
      close: vi.fn().mockResolvedValue(undefined)
    };

    const shutdown = createGracefulShutdownHandler(worker);
    await shutdown("SIGTERM");

    expect(worker.close).toHaveBeenCalledTimes(1);
  });
});
