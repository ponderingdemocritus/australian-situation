import { SourceClientError } from "./sources/live-source-clients";
import { RECURRING_INGEST_JOBS } from "./jobs/job-registry";

export type IngestionSchedule = {
  jobId: string;
  cadence: string;
};

export const DEFAULT_JOB_SCHEDULES: IngestionSchedule[] = RECURRING_INGEST_JOBS.map(
  (job) => ({
    jobId: job.jobId,
    cadence: "pattern" in job.schedule ? job.schedule.pattern : `every:${job.schedule.everyMs}`
  })
);

type RunJobWithRetryOptions<T> = {
  jobId: string;
  maxRetries: number;
  run: () => Promise<T>;
  onAlert?: (payload: {
    jobId: string;
    attempt: number;
    maxRetries: number;
    error: unknown;
  }) => void;
};

export type ScheduledJob<T> = RunJobWithRetryOptions<T> & {
  phase: number;
};

function isTransientSourceError(error: unknown): boolean {
  return error instanceof SourceClientError && error.transient;
}

export async function runJobWithRetry<T>(
  options: RunJobWithRetryOptions<T>
): Promise<T> {
  const maxRetries = Math.max(1, options.maxRetries);

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await options.run();
    } catch (error) {
      const retryable = isTransientSourceError(error) && attempt < maxRetries;
      if (retryable) {
        continue;
      }

      options.onAlert?.({
        jobId: options.jobId,
        attempt,
        maxRetries,
        error
      });
      throw error;
    }
  }

  throw new Error(`unreachable retry state for job ${options.jobId}`);
}

export async function runScheduledJobs<T>(jobs: ScheduledJob<T>[]): Promise<T[]> {
  const phases = [...new Set(jobs.map((job) => job.phase))].sort((a, b) => a - b);
  const results: T[] = [];

  for (const phase of phases) {
    const jobsInPhase = jobs.filter((job) => job.phase === phase);
    for (const job of jobsInPhase) {
      results.push(
        await runJobWithRetry({
          jobId: job.jobId,
          maxRetries: job.maxRetries ?? 3,
          onAlert: job.onAlert,
          run: job.run
        })
      );
    }
  }

  return results;
}
