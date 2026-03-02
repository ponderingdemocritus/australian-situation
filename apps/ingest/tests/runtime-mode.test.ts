import { describe, expect, test } from "vitest";
import {
  assertLegacyRuntimeAllowed,
  resolveIngestRuntimeMode
} from "../src/runtime-mode";

describe("ingest runtime mode", () => {
  test("defaults to bullmq runtime", () => {
    expect(resolveIngestRuntimeMode(undefined)).toBe("bullmq");
    expect(resolveIngestRuntimeMode("")).toBe("bullmq");
  });

  test("accepts legacy fallback mode", () => {
    expect(resolveIngestRuntimeMode("legacy")).toBe("legacy");
  });

  test("rejects unsupported runtime mode", () => {
    expect(() => resolveIngestRuntimeMode("custom")).toThrow(/Unsupported ingest runtime mode/);
  });

  test("legacy runtime is non-production only", () => {
    expect(() => assertLegacyRuntimeAllowed("development")).not.toThrow();
    expect(() => assertLegacyRuntimeAllowed("production")).toThrow(/non-production only/);
  });
});
