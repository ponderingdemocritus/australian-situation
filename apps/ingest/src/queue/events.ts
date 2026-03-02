import { QueueEvents } from "bullmq";
import {
  resolveQueueRuntimeConfig,
  type QueueRuntimeConfig
} from "./runtime";

type EventPayload = Record<string, unknown>;

type QueueEventsLogger = {
  info: (payload: Record<string, unknown>) => void;
  error: (payload: Record<string, unknown>) => void;
};

type QueueEventsLike = {
  on: (event: string, handler: (payload: EventPayload) => void) => void;
};

function defaultLogger(): QueueEventsLogger {
  return {
    info: (payload) => {
      console.log(JSON.stringify(payload));
    },
    error: (payload) => {
      console.error(JSON.stringify(payload));
    }
  };
}

function parseAttempt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function createQueueEventsClient(
  config: QueueRuntimeConfig = resolveQueueRuntimeConfig()
): QueueEvents {
  return new QueueEvents(config.queueName, {
    connection: config.redis,
    prefix: config.queuePrefix
  });
}

export function attachQueueEventsTelemetry(
  queueEvents: QueueEventsLike,
  options: {
    queueName: string;
    logger?: QueueEventsLogger;
  }
): void {
  const logger = options.logger ?? defaultLogger();

  queueEvents.on("completed", (payload) => {
    logger.info({
      level: "info",
      type: "ingest.queue.completed",
      queueName: options.queueName,
      jobId: readString(payload.jobId),
      jobName: readString(payload.name) ?? readString(payload.jobName),
      attempt: parseAttempt(payload.attemptsMade)
    });
  });

  queueEvents.on("failed", (payload) => {
    logger.error({
      level: "error",
      type: "ingest.queue.failed",
      queueName: options.queueName,
      jobId: readString(payload.jobId),
      jobName: readString(payload.name) ?? readString(payload.jobName),
      attempt: parseAttempt(payload.attemptsMade),
      classification: readString(payload.classification) ?? "retryable",
      error:
        readString(payload.failedReason) ?? readString(payload.reason) ?? "unknown queue failure"
    });
  });

  queueEvents.on("stalled", (payload) => {
    logger.error({
      level: "error",
      type: "ingest.queue.stalled",
      queueName: options.queueName,
      jobId: readString(payload.jobId),
      jobName: readString(payload.name) ?? readString(payload.jobName),
      attempt: parseAttempt(payload.attemptsMade)
    });
  });
}
