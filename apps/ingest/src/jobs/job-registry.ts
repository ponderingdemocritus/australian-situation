import { syncEnergyBenchmarkDmo } from "./sync-energy-benchmark-dmo";
import { syncEnergyNormalization } from "./sync-energy-normalization";
import {
  syncEnergySourceMixOfficial,
  syncEnergySourceMixOperational
} from "./sync-energy-source-mix";
import { syncEnergyRetailGlobal } from "./sync-energy-retail-global";
import { syncEnergyRetailPlans } from "./sync-energy-retail-plans";
import { syncEnergyWholesale } from "./sync-energy-wholesale";
import { syncEnergyWholesaleGlobal } from "./sync-energy-wholesale-global";
import { syncHousingRba } from "./sync-housing-rba";
import { syncHousingSeries } from "./sync-housing-series";
import { syncMajorGoodsPriceIndex } from "./sync-major-goods-price-index";
import { syncMacroAbsCpi } from "./sync-macro-abs-cpi";
import { promoteReconciledPriceItems } from "./promote-reconciled-price-items";
import { publishAiDeflationCohorts } from "./publish-ai-deflation-cohorts";

export type IngestJobPayload = {
  sourceMode?: "fixture" | "live";
  from?: string;
  to?: string;
  dryRun?: boolean;
  storePath?: string;
  ingestBackend?: "store" | "postgres";
  runMode?: "scheduled" | "manual" | "backfill";
};

export type IngestJobExecutionContext = {
  bullJobId?: string;
  queueName?: string;
  attempt?: number;
};

export type IngestJobProcessor = (
  payload: IngestJobPayload,
  context?: IngestJobExecutionContext
) => Promise<unknown>;

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
  phase?: number;
};

function hasValidJobId(jobId: string): boolean {
  return /^sync-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(jobId);
}

function assertScheduleValid(job: IngestJobDefinition): void {
  if (!job.schedule) {
    return;
  }

  if ("pattern" in job.schedule) {
    const { pattern } = job.schedule;
    if (!pattern || pattern.trim().length === 0) {
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
    phase: 1,
    schedule: { pattern: "0 2 * * *" },
    processor: async (payload, context) =>
      syncHousingSeries({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-energy-wholesale-5m",
    phase: 1,
    schedule: { pattern: "*/5 * * * *" },
    processor: async (payload, context) =>
      syncEnergyWholesale({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-energy-source-mix-operational-5m",
    phase: 1,
    schedule: { pattern: "2-57/5 * * * *" },
    processor: async (payload, context) =>
      syncEnergySourceMixOperational({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-energy-wholesale-global-hourly",
    phase: 1,
    schedule: { pattern: "5 * * * *" },
    processor: async (payload, context) =>
      syncEnergyWholesaleGlobal({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-energy-source-mix-official-daily",
    phase: 1,
    schedule: { pattern: "20 4 * * *" },
    processor: async (payload, context) =>
      syncEnergySourceMixOfficial({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-energy-retail-prd-hourly",
    phase: 1,
    schedule: { pattern: "0 * * * *" },
    processor: async (payload, context) =>
      syncEnergyRetailPlans({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-energy-retail-global-daily",
    phase: 1,
    schedule: { pattern: "30 3 * * *" },
    processor: async (payload, context) =>
      syncEnergyRetailGlobal({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-energy-normalization-daily",
    phase: 2,
    schedule: { pattern: "45 3 * * *" },
    processor: async (payload, context) =>
      syncEnergyNormalization({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-energy-benchmark-dmo-daily",
    phase: 1,
    schedule: { pattern: "15 1 * * *" },
    processor: async (payload, context) =>
      syncEnergyBenchmarkDmo({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-housing-rba-daily",
    phase: 1,
    schedule: { pattern: "30 2 * * *" },
    processor: async (payload, context) =>
      syncHousingRba({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-major-goods-price-index-daily",
    phase: 1,
    schedule: { pattern: "10 4 * * *" },
    processor: async (payload, context) =>
      syncMajorGoodsPriceIndex({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-price-promotion-hourly",
    phase: 1,
    schedule: { pattern: "20 * * * *" },
    processor: async (payload, context) =>
      promoteReconciledPriceItems({
        storePath: payload.storePath,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-ai-deflation-cohorts-hourly",
    phase: 2,
    schedule: { pattern: "35 * * * *" },
    processor: async (payload, context) =>
      publishAiDeflationCohorts({
        storePath: payload.storePath,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
      })
  },
  {
    jobId: "sync-macro-abs-cpi-daily",
    phase: 1,
    schedule: { pattern: "0 3 * * *" },
    processor: async (payload, context) =>
      syncMacroAbsCpi({
        storePath: payload.storePath,
        sourceMode: payload.sourceMode,
        ingestBackend: payload.ingestBackend,
        bullJobId: context?.bullJobId,
        queueName: context?.queueName,
        attempt: context?.attempt,
        runMode: payload.runMode
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
