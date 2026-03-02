import { describe, expect, test } from "vitest";
import { mapIngestionRunForPostgres } from "../src/repositories/postgres-ingest-repository";

describe("postgres ingestion run mapping", () => {
  test("maps queue execution context fields when present", () => {
    const mapped = mapIngestionRunForPostgres({
      runId: "sync-energy-wholesale-5m-1",
      job: "sync-energy-wholesale-5m",
      status: "ok",
      startedAt: "2026-03-02T00:00:00Z",
      finishedAt: "2026-03-02T00:01:00Z",
      rowsInserted: 5,
      rowsUpdated: 1,
      bullJobId: "12345",
      queueName: "ingest-jobs",
      attempt: 2,
      runMode: "scheduled"
    });

    expect(mapped.bullJobId).toBe("12345");
    expect(mapped.queueName).toBe("ingest-jobs");
    expect(mapped.attempt).toBe(2);
    expect(mapped.runMode).toBe("scheduled");
  });

  test("maps missing queue execution context fields to null", () => {
    const mapped = mapIngestionRunForPostgres({
      runId: "sync-energy-wholesale-5m-2",
      job: "sync-energy-wholesale-5m",
      status: "ok",
      startedAt: "2026-03-02T00:00:00Z",
      finishedAt: "2026-03-02T00:01:00Z",
      rowsInserted: 5,
      rowsUpdated: 1
    });

    expect(mapped.bullJobId).toBeNull();
    expect(mapped.queueName).toBeNull();
    expect(mapped.attempt).toBeNull();
    expect(mapped.runMode).toBeNull();
  });
});
