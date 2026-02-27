import { describe, expect, test } from "vitest";
import { resolveIngestBackend } from "../src/repositories/ingest-backend";

describe("ingest backend selector", () => {
  test("defaults to store backend", () => {
    expect(resolveIngestBackend(undefined)).toBe("store");
    expect(resolveIngestBackend("")).toBe("store");
  });

  test("accepts postgres backend", () => {
    expect(resolveIngestBackend("postgres")).toBe("postgres");
  });

  test("rejects unknown backend values", () => {
    expect(() => resolveIngestBackend("mongodb")).toThrow(
      "Unsupported ingest backend: mongodb"
    );
  });
});
