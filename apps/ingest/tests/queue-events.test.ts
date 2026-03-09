import { describe, expect, test } from "vitest";
import { attachQueueEventsTelemetry } from "../src/queue/events";

describe("queue events telemetry", () => {
  test("emits structured completed/failed/stalled payloads with required fields", () => {
    const handlers = new Map<string, (payload: Record<string, unknown>) => void>();
    const logs: Array<Record<string, unknown>> = [];

    const queueEvents = {
      on: (event: string, handler: (payload: Record<string, unknown>) => void) => {
        handlers.set(event, handler);
      }
    };

    attachQueueEventsTelemetry(queueEvents as never, {
      queueName: "ingest-jobs",
      logger: {
        info: (payload) => logs.push(payload),
        error: (payload) => logs.push(payload)
      }
    });

    handlers.get("completed")?.({ jobId: "11", name: "sync-energy-wholesale-5m", attemptsMade: 1 });
    handlers.get("failed")?.({
      jobId: "12",
      name: "sync-housing-abs-daily",
      attemptsMade: 2,
      failedReason: "schema mismatch",
      classification: "unrecoverable"
    });
    handlers.get("stalled")?.({ jobId: "13", name: "sync-energy-retail-prd-hourly" });

    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "ingest.queue.completed",
          queueName: "ingest-jobs",
          jobId: "11",
          attempt: 1
        }),
        expect.objectContaining({
          type: "ingest.queue.failed",
          queueName: "ingest-jobs",
          jobId: "12",
          attempt: 2,
          classification: "unrecoverable"
        }),
        expect.objectContaining({
          type: "ingest.queue.stalled",
          queueName: "ingest-jobs",
          jobId: "13"
        })
      ])
    );
  });
});
