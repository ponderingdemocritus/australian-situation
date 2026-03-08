import { describe, expect, test, vi } from "vitest";
import { RECURRING_INGEST_JOBS } from "../src/jobs/job-registry";
import {
  createSchedulerJobTemplate,
  upsertRecurringJobSchedulers
} from "../src/queue/scheduler";

describe("bullmq scheduler bootstrap", () => {
  test("upserts one scheduler per recurring registry job", async () => {
    const queue = {
      upsertJobScheduler: vi.fn().mockResolvedValue(undefined)
    };

    await upsertRecurringJobSchedulers(queue);

    expect(queue.upsertJobScheduler).toHaveBeenCalledTimes(RECURRING_INGEST_JOBS.length);
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      "sync-energy-wholesale-5m",
      { pattern: "*/5 * * * *" },
      expect.objectContaining({
        name: "sync-energy-wholesale-5m",
        data: expect.objectContaining({ jobId: "sync-energy-wholesale-5m" })
      })
    );
  });

  test("uses stable scheduler IDs and templates across reruns", async () => {
    const queue = {
      upsertJobScheduler: vi.fn().mockResolvedValue(undefined)
    };

    await upsertRecurringJobSchedulers(queue);
    await upsertRecurringJobSchedulers(queue);

    const firstPass = queue.upsertJobScheduler.mock.calls.slice(0, RECURRING_INGEST_JOBS.length);
    const secondPass = queue.upsertJobScheduler.mock.calls.slice(RECURRING_INGEST_JOBS.length);

    expect(firstPass).toEqual(secondPass);
  });

  test("builds manual template data with job id context", () => {
    const template = createSchedulerJobTemplate("sync-housing-abs-daily");

    expect(template.name).toBe("sync-housing-abs-daily");
    expect(template.data).toEqual(
      expect.objectContaining({
        jobId: "sync-housing-abs-daily",
        runMode: "scheduled"
      })
    );
  });
});
