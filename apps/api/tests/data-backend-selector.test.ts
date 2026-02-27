import { describe, expect, test } from "vitest";
import { resolveApiDataBackend } from "../src/repositories/live-data-repository";

describe("api data backend selector", () => {
  test("defaults to store backend", () => {
    expect(resolveApiDataBackend(undefined)).toBe("store");
    expect(resolveApiDataBackend("")).toBe("store");
  });

  test("accepts postgres backend", () => {
    expect(resolveApiDataBackend("postgres")).toBe("postgres");
  });

  test("rejects unknown backend values", () => {
    expect(() => resolveApiDataBackend("sqlite")).toThrow(
      "Unsupported API data backend: sqlite"
    );
  });
});
