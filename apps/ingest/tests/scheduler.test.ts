import { describe, expect, test, vi } from "vitest";
import { SourceClientError } from "../src/sources/live-source-clients";
import {
  DEFAULT_JOB_SCHEDULES,
  runJobWithRetry,
  runScheduledJobs
} from "../src/scheduler";

describe("ingest scheduler", () => {
  test("registers expected PRD cadences", () => {
    expect(DEFAULT_JOB_SCHEDULES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jobId: "sync-energy-wholesale-5m", cadence: "*/5 * * * *" }),
        expect.objectContaining({
          jobId: "sync-energy-wholesale-global-hourly",
          cadence: "5 * * * *"
        }),
        expect.objectContaining({ jobId: "sync-energy-retail-prd-hourly", cadence: "0 * * * *" }),
        expect.objectContaining({
          jobId: "sync-energy-retail-global-daily",
          cadence: "30 3 * * *"
        }),
        expect.objectContaining({
          jobId: "sync-energy-normalization-daily",
          cadence: "45 3 * * *"
        }),
        expect.objectContaining({ jobId: "sync-energy-benchmark-dmo-daily", cadence: "15 1 * * *" }),
        expect.objectContaining({ jobId: "sync-housing-abs-daily", cadence: "0 2 * * *" }),
        expect.objectContaining({ jobId: "sync-housing-rba-daily", cadence: "30 2 * * *" }),
        expect.objectContaining({ jobId: "sync-macro-abs-cpi-daily", cadence: "0 3 * * *" })
      ])
    );
  });

  test("retries transient failures up to max and then succeeds", async () => {
    let attempts = 0;
    const onAlert = vi.fn();

    const result = await runJobWithRetry({
      jobId: "sync-energy-wholesale-5m",
      maxRetries: 3,
      onAlert,
      run: async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new SourceClientError("aemo_wholesale", "upstream unavailable", {
            transient: true,
            status: 503
          });
        }
        return { status: "ok" as const };
      }
    });

    expect(result.status).toBe("ok");
    expect(attempts).toBe(3);
    expect(onAlert).not.toHaveBeenCalled();
  });

  test("fails fast for permanent parser errors and emits alert", async () => {
    const onAlert = vi.fn();
    let attempts = 0;

    await expect(
      runJobWithRetry({
        jobId: "sync-housing-abs-daily",
        maxRetries: 3,
        onAlert,
        run: async () => {
          attempts += 1;
          throw new SourceClientError("abs_housing", "schema mismatch", {
            transient: false
          });
        }
      })
    ).rejects.toMatchObject({
      name: "SourceClientError",
      sourceId: "abs_housing",
      transient: false
    });

    expect(attempts).toBe(1);
    expect(onAlert).toHaveBeenCalledTimes(1);
  });

  test("runs jobs in phase order and keeps derived work after base jobs", async () => {
    const execution: string[] = [];
    let completedBaseJobs = 0;

    const results = await runScheduledJobs([
      {
        jobId: "base-a",
        phase: 1,
        run: async () => {
          execution.push("base-a");
          completedBaseJobs += 1;
          return "base-a";
        }
      },
      {
        jobId: "base-b",
        phase: 1,
        run: async () => {
          expect(completedBaseJobs).toBe(1);
          execution.push("base-b");
          completedBaseJobs += 1;
          return "base-b";
        }
      },
      {
        jobId: "derived",
        phase: 2,
        run: async () => {
          expect(completedBaseJobs).toBe(2);
          execution.push("derived");
          return "derived";
        }
      }
    ]);

    expect(execution).toEqual(["base-a", "base-b", "derived"]);
    expect(results).toEqual(["base-a", "base-b", "derived"]);
  });
});
