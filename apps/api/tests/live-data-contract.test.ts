import { describe, expectTypeOf, test } from "vitest";
import type { LiveDataRepository } from "../src/repositories/live-data-repository";
import { createPostgresLiveDataRepository } from "../src/repositories/postgres-live-repository";

describe("live data repository contract", () => {
  test("postgres repository matches the API repository interface", () => {
    const repository = createPostgresLiveDataRepository();
    expectTypeOf(repository).toMatchTypeOf<LiveDataRepository>();
  });
});
