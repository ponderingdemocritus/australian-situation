import { syncEnergyRetailPlans } from "./jobs/sync-energy-retail-plans";
import { syncEnergyRetailGlobal } from "./jobs/sync-energy-retail-global";
import { syncEnergyWholesale } from "./jobs/sync-energy-wholesale";
import { syncEnergyWholesaleGlobal } from "./jobs/sync-energy-wholesale-global";
import { syncEnergyNormalization } from "./jobs/sync-energy-normalization";
import { syncEnergyBenchmarkDmo } from "./jobs/sync-energy-benchmark-dmo";
import { syncHousingSeries } from "./jobs/sync-housing-series";
import { syncHousingRba } from "./jobs/sync-housing-rba";
import { syncMacroAbsCpi } from "./jobs/sync-macro-abs-cpi";
import { DEFAULT_JOB_SCHEDULES, runScheduledJobs } from "./scheduler";

function logIngestAlert(alert: {
  jobId: string;
  attempt: number;
  maxRetries: number;
  error: unknown;
}) {
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
}

async function main() {
  const jobs = [
    {
      jobId: "sync-housing-abs-daily",
      phase: 1,
      maxRetries: 3,
      onAlert: logIngestAlert,
      run: () => syncHousingSeries()
    },
    {
      jobId: "sync-energy-wholesale-5m",
      phase: 1,
      maxRetries: 3,
      onAlert: logIngestAlert,
      run: () => syncEnergyWholesale()
    },
    {
      jobId: "sync-energy-wholesale-global-hourly",
      phase: 1,
      maxRetries: 3,
      onAlert: logIngestAlert,
      run: () => syncEnergyWholesaleGlobal()
    },
    {
      jobId: "sync-energy-retail-prd-hourly",
      phase: 1,
      maxRetries: 3,
      onAlert: logIngestAlert,
      run: () => syncEnergyRetailPlans()
    },
    {
      jobId: "sync-energy-retail-global-daily",
      phase: 1,
      maxRetries: 3,
      onAlert: logIngestAlert,
      run: () => syncEnergyRetailGlobal()
    },
    {
      jobId: "sync-energy-benchmark-dmo-daily",
      phase: 1,
      maxRetries: 3,
      onAlert: logIngestAlert,
      run: () => syncEnergyBenchmarkDmo()
    },
    {
      jobId: "sync-housing-rba-daily",
      phase: 1,
      maxRetries: 3,
      onAlert: logIngestAlert,
      run: () => syncHousingRba()
    },
    {
      jobId: "sync-macro-abs-cpi-daily",
      phase: 1,
      maxRetries: 3,
      onAlert: logIngestAlert,
      run: () => syncMacroAbsCpi()
    },
    {
      jobId: "sync-energy-normalization-daily",
      phase: 2,
      maxRetries: 3,
      onAlert: logIngestAlert,
      run: () => syncEnergyNormalization()
    }
  ] as const;

  const runs = await runScheduledJobs(jobs);

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
