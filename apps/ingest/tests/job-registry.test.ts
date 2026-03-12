import { describe, expect, test } from "vitest";
import {
  INGEST_JOB_REGISTRY,
  createValidatedIngestJobRegistry,
  type IngestJobDefinition
} from "../src/jobs/job-registry";

function noop(): Promise<void> {
  return Promise.resolve();
}

describe("ingest job registry", () => {
  test("is the single source of truth for recurring job cadences", () => {
    const recurring = INGEST_JOB_REGISTRY.filter((job) => job.schedule !== undefined);

    expect(recurring).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          jobId: "sync-energy-wholesale-5m",
          schedule: expect.objectContaining({ pattern: "*/5 * * * *" })
        }),
        expect.objectContaining({
          jobId: "sync-energy-retail-prd-hourly",
          schedule: expect.objectContaining({ pattern: "0 * * * *" })
        }),
        expect.objectContaining({
          jobId: "sync-housing-abs-daily",
          schedule: expect.objectContaining({ pattern: "0 2 * * *" })
        }),
        expect.objectContaining({
          jobId: "sync-major-goods-price-index-daily",
          schedule: expect.objectContaining({ pattern: "10 4 * * *" })
        }),
        expect.objectContaining({
          jobId: "sync-price-promotion-hourly",
          schedule: expect.objectContaining({ pattern: "20 * * * *" })
        }),
        expect.objectContaining({
          jobId: "sync-ai-deflation-cohorts-hourly",
          schedule: expect.objectContaining({ pattern: "35 * * * *" })
        })
      ])
    );
  });

  test("throws when registry has duplicate job ids", () => {
    const withDuplicate: IngestJobDefinition[] = [
      { jobId: "sync-energy-wholesale-5m", processor: noop },
      { jobId: "sync-energy-wholesale-5m", processor: noop }
    ];

    expect(() => createValidatedIngestJobRegistry(withDuplicate)).toThrow(/duplicate/i);
  });

  test("throws when registry has invalid job id format", () => {
    const withInvalidId: IngestJobDefinition[] = [{ jobId: "bad id", processor: noop }];

    expect(() => createValidatedIngestJobRegistry(withInvalidId)).toThrow(/jobId/i);
  });

  test("throws when scheduled job is missing cadence", () => {
    const invalidSchedule: IngestJobDefinition[] = [
      {
        jobId: "sync-energy-wholesale-5m",
        processor: noop,
        // @ts-expect-error validating runtime guardrails for malformed data
        schedule: {}
      }
    ];

    expect(() => createValidatedIngestJobRegistry(invalidSchedule)).toThrow(/schedule/i);
  });
});
