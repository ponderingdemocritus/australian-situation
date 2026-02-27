import { SourceClientError } from "./sources/live-source-clients";

export type IngestionSchedule = {
  jobId: string;
  cadence: string;
};

export const DEFAULT_JOB_SCHEDULES: IngestionSchedule[] = [
  { jobId: "sync-energy-wholesale-5m", cadence: "*/5 * * * *" },
  { jobId: "sync-energy-retail-prd-hourly", cadence: "0 * * * *" },
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
