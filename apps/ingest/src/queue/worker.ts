import { SourceClientError } from "../sources/live-source-clients";
import {
  INGEST_JOB_REGISTRY,
  type IngestJobDefinition,
  type IngestJobPayload
} from "../jobs/job-registry";
import { UnrecoverableError, Worker, type Job } from "bullmq";
import {
  resolveQueueRuntimeConfig,
  type QueueRuntimeConfig
} from "./runtime";
import { resolveIngestBackend } from "../repositories/ingest-backend";

type WorkerLogger = {
  info: (payload: Record<string, unknown>) => void;
  error: (payload: Record<string, unknown>) => void;
};

type WorkerJobLike = Pick<
  Job,
  "name" | "id" | "attemptsMade" | "data" | "queueName"
>;

function defaultLogger(): WorkerLogger {
  return {
    info: (payload) => {
      console.log(JSON.stringify(payload));
    },
    error: (payload) => {
      console.error(JSON.stringify(payload));
    }
  };
}

function shouldSerializeStoreJob(payload: IngestJobPayload): boolean {
  return resolveIngestBackend(payload.ingestBackend ?? process.env.AUS_DASH_INGEST_BACKEND) === "store";
}

function createStoreExecutionGate() {
  let chain = Promise.resolve();

  return async <T>(run: () => Promise<T>): Promise<T> => {
    const result = chain.then(run, run);
    chain = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function classifyWorkerFailure(error: unknown): {
  classification: "retryable" | "unrecoverable";
  error: Error;
} {
  if (error instanceof UnrecoverableError) {
    return {
      classification: "unrecoverable",
      error
    };
  }

  if (error instanceof SourceClientError) {
    if (error.transient) {
      return {
        classification: "retryable",
        error
      };
    }

    return {
      classification: "unrecoverable",
      error: new UnrecoverableError(error.message)
    };
  }

  if (error instanceof Error) {
    return {
      classification: "retryable",
      error
    };
  }

  return {
    classification: "retryable",
    error: new Error(String(error))
  };
}

function indexRegistryById(
  registry: ReadonlyArray<IngestJobDefinition>
): Map<string, IngestJobDefinition> {
  return new Map(registry.map((job) => [job.jobId, job]));
}

export function buildRegistryBackedProcessor(
  registry: ReadonlyArray<IngestJobDefinition> = INGEST_JOB_REGISTRY,
  logger: WorkerLogger = defaultLogger()
) {
  const jobsById = indexRegistryById(registry);
  const runStoreSerially = createStoreExecutionGate();

  return async (job: WorkerJobLike): Promise<unknown> => {
    const jobDefinition = jobsById.get(job.name);

    if (!jobDefinition) {
      throw new UnrecoverableError(`No ingest processor registered for ${job.name}`);
    }

    try {
      const payload = (job.data ?? {}) as IngestJobPayload;
      const execute = () => jobDefinition.processor(payload);
      const result = shouldSerializeStoreJob(payload)
        ? await runStoreSerially(execute)
        : await execute();

      logger.info({
        level: "info",
        type: "ingest.worker.completed",
        jobId: job.name,
        bullJobId: String(job.id ?? ""),
        queueName: job.queueName,
        attempt: job.attemptsMade + 1
      });

      return result;
    } catch (error) {
      const failure = classifyWorkerFailure(error);

      logger.error({
        level: "error",
        type: "ingest.worker.failed",
        jobId: job.name,
        bullJobId: String(job.id ?? ""),
        queueName: job.queueName,
        attempt: job.attemptsMade + 1,
        classification: failure.classification,
        error: toErrorMessage(failure.error)
      });

      throw failure.error;
    }
  };
}

export function createIngestWorker(
  config: QueueRuntimeConfig = resolveQueueRuntimeConfig(),
  registry: ReadonlyArray<IngestJobDefinition> = INGEST_JOB_REGISTRY,
  logger: WorkerLogger = defaultLogger()
): Worker {
  return new Worker(config.queueName, buildRegistryBackedProcessor(registry, logger), {
    connection: config.redis,
    concurrency: config.workerConcurrency,
    prefix: config.queuePrefix
  });
}

export function createGracefulShutdownHandler(
  worker: Pick<Worker, "close">,
  logger: WorkerLogger = defaultLogger()
) {
  let closing = false;

  return async (signal: "SIGINT" | "SIGTERM") => {
    if (closing) {
      return;
    }

    closing = true;

    logger.info({
      level: "info",
      type: "ingest.worker.shutdown.start",
      signal
    });

    await worker.close();

    logger.info({
      level: "info",
      type: "ingest.worker.shutdown.complete",
      signal
    });
  };
}
