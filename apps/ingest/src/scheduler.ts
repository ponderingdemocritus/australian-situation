import { SourceClientError } from "./sources/live-source-clients";

export type IngestionSchedule = {
  jobId: string;
  cadence: string;
};

export const DEFAULT_JOB_SCHEDULES: IngestionSchedule[] = [
  { jobId: "sync-energy-wholesale-5m", cadence: "*/5 * * * *" },
  { jobId: "sync-energy-wholesale-global-hourly", cadence: "5 * * * *" },
  { jobId: "sync-energy-retail-prd-hourly", cadence: "0 * * * *" },
  { jobId: "sync-energy-retail-global-daily", cadence: "30 3 * * *" },
  { jobId: "sync-energy-normalization-daily", cadence: "45 3 * * *" },
  { jobId: "sync-energy-benchmark-dmo-daily", cadence: "15 1 * * *" },
  { jobId: "sync-housing-abs-daily", cadence: "0 2 * * *" },
  { jobId: "sync-housing-rba-daily", cadence: "30 2 * * *" },
  { jobId: "sync-macro-abs-cpi-daily", cadence: "0 3 * * *" }
];

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
