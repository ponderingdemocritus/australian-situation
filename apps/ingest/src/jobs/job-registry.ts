import { syncEnergyBenchmarkDmo } from "./sync-energy-benchmark-dmo";
import { syncEnergyNormalization } from "./sync-energy-normalization";
import { syncEnergyRetailGlobal } from "./sync-energy-retail-global";
import { syncEnergyRetailPlans } from "./sync-energy-retail-plans";
import { syncEnergyWholesale } from "./sync-energy-wholesale";
import { syncEnergyWholesaleGlobal } from "./sync-energy-wholesale-global";
import { syncHousingRba } from "./sync-housing-rba";
import { syncHousingSeries } from "./sync-housing-series";
import { syncMacroAbsCpi } from "./sync-macro-abs-cpi";

export type IngestJobPayload = {
  sourceMode?: "fixture" | "live";
  from?: string;
  to?: string;
  dryRun?: boolean;
  storePath?: string;
  ingestBackend?: "store" | "postgres";
  runMode?: "scheduled" | "manual" | "backfill";
};

export type IngestJobProcessor = (payload: IngestJobPayload) => Promise<unknown>;

export type IngestJobSchedule =
  | {
      pattern: string;
      everyMs?: never;
    }
  | {
      pattern?: never;
      everyMs: number;
    };

export type IngestJobDefinition = {
  jobId: string;
  processor: IngestJobProcessor;
  schedule?: IngestJobSchedule;
};

function hasValidJobId(jobId: string): boolean {
  return /^sync-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(jobId);
}

function assertScheduleValid(job: IngestJobDefinition): void {
  if (!job.schedule) {
    return;
  }

  if ("pattern" in job.schedule) {
    if (job.schedule.pattern.trim().length === 0) {
      throw new Error(`job ${job.jobId} has an empty pattern schedule`);
    }
    return;
  }

  if (!Number.isFinite(job.schedule.everyMs) || job.schedule.everyMs <= 0) {
    throw new Error(`job ${job.jobId} has invalid schedule.everyMs`);
  }
}

export function createValidatedIngestJobRegistry(
  input: IngestJobDefinition[]
): ReadonlyArray<IngestJobDefinition> {
  const seen = new Set<string>();

  for (const job of input) {
    if (!hasValidJobId(job.jobId)) {
      throw new Error(
        `jobId ${job.jobId} is invalid; expected stable kebab-case ids prefixed with sync-`
      );
    }

    if (seen.has(job.jobId)) {
      throw new Error(`duplicate jobId in ingest registry: ${job.jobId}`);
    }

    if (typeof job.processor !== "function") {
      throw new Error(`job ${job.jobId} is missing a processor function`);
    }

    assertScheduleValid(job);
    seen.add(job.jobId);
  }

  return Object.freeze([...input]);
}

export const INGEST_JOB_REGISTRY = createValidatedIngestJobRegistry([
  {
    jobId: "sync-housing-abs-daily",
    schedule: { pattern: "0 2 * * *" },
    processor: async (payload) =>
      syncHousingSeries({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend
      })
  },
  {
    jobId: "sync-energy-wholesale-5m",
    schedule: { pattern: "*/5 * * * *" },
    processor: async (payload) =>
      syncEnergyWholesale({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend
      })
  },
  {
    jobId: "sync-energy-wholesale-global-hourly",
    schedule: { pattern: "5 * * * *" },
    processor: async (payload) =>
      syncEnergyWholesaleGlobal({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend
      })
  },
  {
    jobId: "sync-energy-retail-prd-hourly",
    schedule: { pattern: "0 * * * *" },
    processor: async (payload) =>
      syncEnergyRetailPlans({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend
      })
  },
  {
    jobId: "sync-energy-retail-global-daily",
    schedule: { pattern: "30 3 * * *" },
    processor: async (payload) =>
      syncEnergyRetailGlobal({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend
      })
  },
  {
    jobId: "sync-energy-normalization-daily",
    schedule: { pattern: "45 3 * * *" },
    processor: async (payload) =>
      syncEnergyNormalization({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend
      })
  },
  {
    jobId: "sync-energy-benchmark-dmo-daily",
    schedule: { pattern: "15 1 * * *" },
    processor: async (payload) =>
      syncEnergyBenchmarkDmo({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend
      })
  },
  {
    jobId: "sync-housing-rba-daily",
    schedule: { pattern: "30 2 * * *" },
    processor: async (payload) =>
      syncHousingRba({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend
      })
  },
  {
    jobId: "sync-macro-abs-cpi-daily",
    schedule: { pattern: "0 3 * * *" },
    processor: async (payload) =>
      syncMacroAbsCpi({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend
      })
  }
]);

export const INGEST_JOB_REGISTRY_BY_ID = new Map(
  INGEST_JOB_REGISTRY.map((job) => [job.jobId, job])
);

export const RECURRING_INGEST_JOBS = INGEST_JOB_REGISTRY.filter(
  (job): job is IngestJobDefinition & { schedule: IngestJobSchedule } =>
    job.schedule !== undefined
);
