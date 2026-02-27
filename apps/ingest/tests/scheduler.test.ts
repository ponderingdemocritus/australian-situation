import { describe, expect, test, vi } from "vitest";
import { SourceClientError } from "../src/sources/live-source-clients";
import { DEFAULT_JOB_SCHEDULES, runJobWithRetry } from "../src/scheduler";

describe("ingest scheduler", () => {
  test("registers expected PRD cadences", () => {
    expect(DEFAULT_JOB_SCHEDULES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ jobId: "sync-energy-wholesale-5m", cadence: "*/5 * * * *" }),
        expect.objectContaining({ jobId: "sync-energy-retail-prd-hourly", cadence: "0 * * * *" }),
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
});
