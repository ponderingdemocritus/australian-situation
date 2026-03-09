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

type QueueEventsLike = Pick<QueueEvents, "on">;

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
    const eventPayload = payload as EventPayload;
    logger.info({
      level: "info",
      type: "ingest.queue.completed",
      queueName: options.queueName,
      jobId: readString(eventPayload.jobId),
      jobName: readString(eventPayload.name) ?? readString(eventPayload.jobName),
      attempt: parseAttempt(eventPayload.attemptsMade)
    });
  });

  queueEvents.on("failed", (payload) => {
    const eventPayload = payload as EventPayload;
    logger.error({
      level: "error",
      type: "ingest.queue.failed",
      queueName: options.queueName,
      jobId: readString(eventPayload.jobId),
      jobName: readString(eventPayload.name) ?? readString(eventPayload.jobName),
      attempt: parseAttempt(eventPayload.attemptsMade),
      classification: readString(eventPayload.classification) ?? "retryable",
      error:
        readString(eventPayload.failedReason) ??
        readString(eventPayload.reason) ??
        "unknown queue failure"
    });
  });

  queueEvents.on("stalled", (payload) => {
    const eventPayload = payload as EventPayload;
    logger.error({
      level: "error",
      type: "ingest.queue.stalled",
      queueName: options.queueName,
      jobId: readString(eventPayload.jobId),
      jobName: readString(eventPayload.name) ?? readString(eventPayload.jobName),
      attempt: parseAttempt(eventPayload.attemptsMade)
    });
  });
}
