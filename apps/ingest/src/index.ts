import { syncEnergyRetailPlans } from "./jobs/sync-energy-retail-plans";
import { syncEnergyRetailGlobal } from "./jobs/sync-energy-retail-global";
import { syncEnergyWholesale } from "./jobs/sync-energy-wholesale";
import { syncEnergyWholesaleGlobal } from "./jobs/sync-energy-wholesale-global";
import { syncEnergyNormalization } from "./jobs/sync-energy-normalization";
import { syncHousingSeries } from "./jobs/sync-housing-series";
import { DEFAULT_JOB_SCHEDULES, runJobWithRetry } from "./scheduler";

async function main() {
  const jobs = [
    {
      jobId: "sync-housing-abs-daily",
      run: () => syncHousingSeries()
    },
    {
      jobId: "sync-energy-wholesale-5m",
      run: () => syncEnergyWholesale()
    },
    {
      jobId: "sync-energy-wholesale-global-hourly",
      run: () => syncEnergyWholesaleGlobal()
    },
    {
      jobId: "sync-energy-retail-prd-hourly",
      run: () => syncEnergyRetailPlans()
    },
    {
      jobId: "sync-energy-retail-global-daily",
      run: () => syncEnergyRetailGlobal()
    },
    {
      jobId: "sync-energy-normalization-daily",
      run: () => syncEnergyNormalization()
    }
  ] as const;

  const runs = await Promise.all(
    jobs.map((job) =>
      runJobWithRetry({
        jobId: job.jobId,
        maxRetries: 3,
        onAlert: (alert) => {
          console.error(
            JSON.stringify(
              {
                level: "error",
                type: "ingest.alert",
                jobId: alert.jobId,
                attempt: alert.attempt,
                maxRetries: alert.maxRetries,
                error: alert.error instanceof Error ? alert.error.message : String(alert.error)
              },
              null,
              2
            )
          );
        },
        run: job.run
      })
    )
  );

  console.log(
    JSON.stringify(
      {
        status: "ok",
        schedules: DEFAULT_JOB_SCHEDULES,
        jobs: runs
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
