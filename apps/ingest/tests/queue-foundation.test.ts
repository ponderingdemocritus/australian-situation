import { describe, expect, test } from "vitest";
import {
  createIngestQueue,
  resolveQueueRuntimeConfig
} from "../src/queue/runtime";

describe("bullmq queue foundation", () => {
  test("uses local defaults when redis env vars are absent", () => {
    const config = resolveQueueRuntimeConfig({});

    expect(config.queueName).toBe("ingest-jobs");
    expect(config.redis.host).toBe("127.0.0.1");
    expect(config.redis.port).toBe(6379);
    expect(config.redis.db).toBe(0);
    expect(config.redis.maxRetriesPerRequest).toBeNull();
  });

  test("supports redis url and custom queue name", () => {
    const config = resolveQueueRuntimeConfig({
      AUS_DASH_REDIS_URL: "redis://localhost:6380/2",
      AUS_DASH_BULLMQ_QUEUE_NAME: "custom-ingest"
    });

    expect(config.queueName).toBe("custom-ingest");
    expect(config.redis.host).toBe("localhost");
    expect(config.redis.port).toBe(6380);
    expect(config.redis.db).toBe(2);
  });

  test("throws when port is invalid", () => {
    expect(() =>
      resolveQueueRuntimeConfig({
        AUS_DASH_REDIS_PORT: "bad"
      })
    ).toThrow(/AUS_DASH_REDIS_PORT/);
  });

  test("can initialize queue object from env config", async () => {
    const queue = createIngestQueue(
      resolveQueueRuntimeConfig({
        AUS_DASH_BULLMQ_QUEUE_NAME: "test-ingest"
      })
    );

    expect(queue.name).toBe("test-ingest");
    await queue.close();
  });
});
