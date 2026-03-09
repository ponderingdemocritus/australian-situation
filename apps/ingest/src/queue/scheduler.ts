import { RECURRING_INGEST_JOBS } from "../jobs/job-registry";

export type SchedulerQueueClient = {
  upsertJobScheduler: (
    schedulerId: string,
    repeat: { pattern: string } | { every: number },
    template: {
      name: string;
      data: {
        jobId: string;
        runMode: "scheduled";
      };
      opts?: Record<string, unknown>;
    }
  ) => Promise<unknown>;
};

export function createSchedulerJobTemplate(jobId: string) {
  return {
    name: jobId,
    data: {
      jobId,
      runMode: "scheduled" as const
    }
  };
}

function toRepeatSchedule(schedule: { pattern: string } | { everyMs: number }) {
  return "pattern" in schedule
    ? { pattern: schedule.pattern }
    : { every: schedule.everyMs };
}

export async function upsertRecurringJobSchedulers(
  queue: SchedulerQueueClient
): Promise<Array<{ schedulerId: string }>> {
  const upserted: Array<{ schedulerId: string }> = [];

  for (const job of RECURRING_INGEST_JOBS) {
    const repeatSchedule = toRepeatSchedule(job.schedule);
    await queue.upsertJobScheduler(
      job.jobId,
      repeatSchedule,
      createSchedulerJobTemplate(job.jobId)
    );
    upserted.push({ schedulerId: job.jobId });
  }

  return upserted;
}
