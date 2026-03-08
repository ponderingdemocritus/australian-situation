import { describe, expect, test } from "vitest";
import {
  dispatchBackfillJob,
  dispatchManualJob,
  validateBackfillWindow
} from "../src/queue/dispatch";

class InMemoryQueue {
  private readonly seen = new Set<string>();

  async add(_name: string, _data: unknown, options: { jobId?: string } = {}) {
    const jobId = options.jobId ?? `job-${this.seen.size + 1}`;
    if (this.seen.has(jobId)) {
      throw new Error(`Job is already waiting: ${jobId}`);
    }
    this.seen.add(jobId);
    return { id: jobId };
  }
}

describe("queue dispatch", () => {
  test("enqueues a manual job for a registered job id", async () => {
    const queue = new InMemoryQueue();

    const result = await dispatchManualJob(queue as never, {
      jobId: "sync-energy-wholesale-5m",
      payload: {
        sourceMode: "fixture",
        ingestBackend: "store"
      }
    });

    expect(result.enqueued).toBe(true);
    expect(result.runMode).toBe("manual");
    expect(result.queueJobId).toContain("manual");
  });

  test("rejects unknown job ids", async () => {
    const queue = new InMemoryQueue();

    await expect(
      dispatchManualJob(queue as never, {
        jobId: "unknown-job"
      })
    ).rejects.toThrow(/Unknown ingest job/);
  });

  test("rejects invalid manual payload fields", async () => {
    const queue = new InMemoryQueue();

    await expect(
      dispatchManualJob(queue as never, {
        jobId: "sync-energy-wholesale-5m",
        // @ts-expect-error validating runtime payload guardrails
        payload: { sourceMode: "invalid" }
      })
    ).rejects.toThrow(/Invalid sourceMode/);
  });

  test("rejects invalid backfill windows", () => {
    expect(() => validateBackfillWindow({ from: "2026-03-05", to: "2026-03-01" })).toThrow(
      /from must be less than or equal to to/
    );
  });

  test("rejects oversized backfill windows", () => {
    expect(() =>
      validateBackfillWindow(
        {
          from: "2026-01-01",
          to: "2026-03-31"
        },
        31
      )
    ).toThrow(/exceeds maximum/);
  });

  test("supports dry-run backfill without enqueue", async () => {
    const queue = new InMemoryQueue();

    const result = await dispatchBackfillJob(queue as never, {
      jobId: "sync-energy-wholesale-5m",
      from: "2026-03-01",
      to: "2026-03-05",
      dryRun: true
    });

    expect(result.enqueued).toBe(false);
    expect(result.dryRun).toBe(true);
  });

  test("marks duplicate enqueue attempts without throwing", async () => {
    const queue = new InMemoryQueue();

    const first = await dispatchManualJob(queue as never, {
      jobId: "sync-energy-wholesale-5m"
    });
    const second = await dispatchManualJob(queue as never, {
      jobId: "sync-energy-wholesale-5m"
    });

    expect(first.enqueued).toBe(true);
    expect(second.enqueued).toBe(false);
    expect(second.duplicate).toBe(true);
  });
});
