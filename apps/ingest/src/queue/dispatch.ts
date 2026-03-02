import { createHash } from "node:crypto";
import { INGEST_JOB_REGISTRY_BY_ID, type IngestJobPayload } from "../jobs/job-registry";

type DispatchQueue = {
  add: (
    name: string,
    data: IngestJobPayload,
    options?: {
      jobId?: string;
    }
  ) => Promise<{ id?: string | number | null }>;
};

const DEFAULT_BACKFILL_MAX_DAYS = 31;

function assertKnownJobId(jobId: string): void {
  if (!INGEST_JOB_REGISTRY_BY_ID.has(jobId)) {
    throw new Error(`Unknown ingest job: ${jobId}`);
  }
}

function validateDispatchPayload(payload: IngestJobPayload): void {
  if (payload.sourceMode && payload.sourceMode !== "fixture" && payload.sourceMode !== "live") {
    throw new Error(`Invalid sourceMode: ${payload.sourceMode}`);
  }

  if (
    payload.ingestBackend &&
    payload.ingestBackend !== "store" &&
    payload.ingestBackend !== "postgres"
  ) {
    throw new Error(`Invalid ingestBackend: ${payload.ingestBackend}`);
  }
}

function parseDateOnly(value: string, field: "from" | "to"): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be in YYYY-MM-DD format`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid date`);
  }

  return parsed;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function validateBackfillWindow(
  input: {
    from: string;
    to: string;
  },
  maxDays: number = DEFAULT_BACKFILL_MAX_DAYS
): {
  from: string;
  to: string;
  days: number;
} {
  const fromDate = parseDateOnly(input.from, "from");
  const toDate = parseDateOnly(input.to, "to");

  if (fromDate.getTime() > toDate.getTime()) {
    throw new Error("from must be less than or equal to to");
  }

  const diffDays = Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (diffDays > maxDays) {
    throw new Error(`Backfill window of ${diffDays} days exceeds maximum of ${maxDays}`);
  }

  return {
    from: formatDateOnly(fromDate),
    to: formatDateOnly(toDate),
    days: diffDays
  };
}

function makeDedupeSuffix(input: object): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 16);
}

function isDuplicateAddError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("already") || message.includes("exists") || message.includes("duplicate");
}

export async function dispatchManualJob(
  queue: DispatchQueue,
  options: {
    jobId: string;
    payload?: IngestJobPayload;
    dedupeKey?: string;
  }
): Promise<{
  enqueued: boolean;
  duplicate: boolean;
  queueJobId: string;
  runMode: "manual";
}> {
  assertKnownJobId(options.jobId);
  const payload: IngestJobPayload = {
    ...(options.payload ?? {}),
    runMode: "manual"
  };
  validateDispatchPayload(payload);

  const queueJobId = `manual:${options.jobId}:${
    options.dedupeKey ?? makeDedupeSuffix({ jobId: options.jobId, payload })
  }`;

  try {
    const enqueued = await queue.add(options.jobId, payload, {
      jobId: queueJobId
    });

    return {
      enqueued: true,
      duplicate: false,
      queueJobId: String(enqueued.id ?? queueJobId),
      runMode: "manual"
    };
  } catch (error) {
    if (!isDuplicateAddError(error)) {
      throw error;
    }

    return {
      enqueued: false,
      duplicate: true,
      queueJobId,
      runMode: "manual"
    };
  }
}

export async function dispatchBackfillJob(
  queue: DispatchQueue,
  options: {
    jobId: string;
    from: string;
    to: string;
    dryRun?: boolean;
    payload?: IngestJobPayload;
    maxWindowDays?: number;
  }
): Promise<{
  enqueued: boolean;
  duplicate: boolean;
  queueJobId: string;
  runMode: "backfill";
  from: string;
  to: string;
  dryRun: boolean;
}> {
  assertKnownJobId(options.jobId);

  const window = validateBackfillWindow(
    {
      from: options.from,
      to: options.to
    },
    options.maxWindowDays
  );

  const payload: IngestJobPayload = {
    ...(options.payload ?? {}),
    from: window.from,
    to: window.to,
    dryRun: options.dryRun ?? false,
    runMode: "backfill"
  };
  validateDispatchPayload(payload);

  const queueJobId = `backfill:${options.jobId}:${makeDedupeSuffix({
    jobId: options.jobId,
    from: window.from,
    to: window.to,
    payload
  })}`;

  if (payload.dryRun) {
    return {
      enqueued: false,
      duplicate: false,
      queueJobId,
      runMode: "backfill",
      from: window.from,
      to: window.to,
      dryRun: true
    };
  }

  try {
    const enqueued = await queue.add(options.jobId, payload, {
      jobId: queueJobId
    });

    return {
      enqueued: true,
      duplicate: false,
      queueJobId: String(enqueued.id ?? queueJobId),
      runMode: "backfill",
      from: window.from,
      to: window.to,
      dryRun: false
    };
  } catch (error) {
    if (!isDuplicateAddError(error)) {
      throw error;
    }

    return {
      enqueued: false,
      duplicate: true,
      queueJobId,
      runMode: "backfill",
      from: window.from,
      to: window.to,
      dryRun: false
    };
  }
}
