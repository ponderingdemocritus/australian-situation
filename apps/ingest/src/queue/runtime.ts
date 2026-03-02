import { Queue, type ConnectionOptions } from "bullmq";

type EnvLike = Record<string, string | undefined>;

export type QueueRuntimeConfig = {
  queueName: string;
  queuePrefix: string;
  workerConcurrency: number;
  defaultJobAttempts: number;
  defaultBackoffMs: number;
  redis: ConnectionOptions & {
    maxRetriesPerRequest: null;
  };
};

function parsePositiveInt(value: string, envName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${envName} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInt(value: string, envName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${envName} must be a non-negative integer`);
  }
  return parsed;
}

function parseRedisConnection(env: EnvLike): QueueRuntimeConfig["redis"] {
  const redisUrl = env.AUS_DASH_REDIS_URL;

  if (redisUrl) {
    let url: URL;
    try {
      url = new URL(redisUrl);
    } catch {
      throw new Error("AUS_DASH_REDIS_URL must be a valid redis URL");
    }

    const protocol = url.protocol.replace(":", "");
    if (protocol !== "redis" && protocol !== "rediss") {
      throw new Error("AUS_DASH_REDIS_URL must use redis:// or rediss:// protocol");
    }

    const dbSegment = url.pathname.replace(/^\//, "");
    const db = dbSegment.length > 0 ? parseNonNegativeInt(dbSegment, "AUS_DASH_REDIS_URL db") : 0;

    const connection: QueueRuntimeConfig["redis"] = {
      host: url.hostname,
      port: url.port.length > 0 ? parsePositiveInt(url.port, "AUS_DASH_REDIS_URL port") : 6379,
      db,
      maxRetriesPerRequest: null
    };

    if (url.username.length > 0) {
      connection.username = decodeURIComponent(url.username);
    }

    if (url.password.length > 0) {
      connection.password = decodeURIComponent(url.password);
    }

    if (protocol === "rediss") {
      connection.tls = {};
    }

    return connection;
  }

  const port = env.AUS_DASH_REDIS_PORT
    ? parsePositiveInt(env.AUS_DASH_REDIS_PORT, "AUS_DASH_REDIS_PORT")
    : 6379;
  const db = env.AUS_DASH_REDIS_DB
    ? parseNonNegativeInt(env.AUS_DASH_REDIS_DB, "AUS_DASH_REDIS_DB")
    : 0;

  const connection: QueueRuntimeConfig["redis"] = {
    host: env.AUS_DASH_REDIS_HOST ?? "127.0.0.1",
    port,
    db,
    maxRetriesPerRequest: null
  };

  if (env.AUS_DASH_REDIS_PASSWORD) {
    connection.password = env.AUS_DASH_REDIS_PASSWORD;
  }

  if (env.AUS_DASH_REDIS_USERNAME) {
    connection.username = env.AUS_DASH_REDIS_USERNAME;
  }

  if (env.AUS_DASH_REDIS_TLS === "true") {
    connection.tls = {};
  }

  return connection;
}

export function resolveQueueRuntimeConfig(env: EnvLike = process.env): QueueRuntimeConfig {
  return {
    queueName: env.AUS_DASH_BULLMQ_QUEUE_NAME ?? "ingest-jobs",
    queuePrefix: env.AUS_DASH_BULLMQ_PREFIX ?? "aus-dash",
    workerConcurrency: env.AUS_DASH_BULLMQ_WORKER_CONCURRENCY
      ? parsePositiveInt(
          env.AUS_DASH_BULLMQ_WORKER_CONCURRENCY,
          "AUS_DASH_BULLMQ_WORKER_CONCURRENCY"
        )
      : 4,
    defaultJobAttempts: env.AUS_DASH_BULLMQ_ATTEMPTS
      ? parsePositiveInt(env.AUS_DASH_BULLMQ_ATTEMPTS, "AUS_DASH_BULLMQ_ATTEMPTS")
      : 3,
    defaultBackoffMs: env.AUS_DASH_BULLMQ_BACKOFF_MS
      ? parsePositiveInt(env.AUS_DASH_BULLMQ_BACKOFF_MS, "AUS_DASH_BULLMQ_BACKOFF_MS")
      : 5000,
    redis: parseRedisConnection(env)
  };
}

export function createIngestQueue(config: QueueRuntimeConfig = resolveQueueRuntimeConfig()): Queue {
  return new Queue(config.queueName, {
    connection: config.redis,
    prefix: config.queuePrefix,
    defaultJobOptions: {
      attempts: config.defaultJobAttempts,
      backoff: {
        type: "exponential",
        delay: config.defaultBackoffMs
      },
      removeOnComplete: 500,
      removeOnFail: 1000
    }
  });
}
