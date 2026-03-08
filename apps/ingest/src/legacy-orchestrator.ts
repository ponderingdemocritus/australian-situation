import { RECURRING_INGEST_JOBS } from "./jobs/job-registry";
import { DEFAULT_JOB_SCHEDULES, runScheduledJobs } from "./scheduler";

export async function runLegacyIngestOrchestration() {
  const runs = await runScheduledJobs(
    RECURRING_INGEST_JOBS.map((job) => ({
      jobId: job.jobId,
      phase: job.phase ?? 1,
      maxRetries: 3,
      onAlert: (alert) => {
        console.error(
          JSON.stringify({
            level: "error",
            type: "ingest.alert",
            jobId: alert.jobId,
            attempt: alert.attempt,
            maxRetries: alert.maxRetries,
            error: alert.error instanceof Error ? alert.error.message : String(alert.error)
          })
        );
      },
      run: async () =>
        job.processor({
          runMode: "scheduled"
        })
    }))
  );

  return {
    status: "ok" as const,
    runtime: "legacy" as const,
    schedules: DEFAULT_JOB_SCHEDULES,
    jobs: runs
  };
}
