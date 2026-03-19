import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { StartedServer } from "./helpers";
import { runCli, startServer } from "./helpers";

describe("@aus-dash/cli read commands", () => {
  let server: StartedServer;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(() => {
    server.stop();
  });

  test("prints health as JSON", async () => {
    const result = await runCli(server.url, ["health"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      service: "aus-dash-api",
      status: "ok"
    });
  });

  test("prints metadata freshness as JSON", async () => {
    const result = await runCli(server.url, ["metadata", "freshness"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      generatedAt: expect.any(String),
      series: expect.any(Array),
      staleSeriesCount: expect.any(Number)
    });
  });

  test("prints metadata sources as JSON", async () => {
    const result = await runCli(server.url, ["metadata", "sources"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      generatedAt: expect.any(String),
      sources: expect.any(Array)
    });
  });

  test("prints energy overview as JSON", async () => {
    const result = await runCli(server.url, ["energy", "overview", "--region", "AU"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      region: "AU"
    });
  });

  test("prints energy retail average as JSON", async () => {
    const result = await runCli(server.url, ["energy", "retail-average", "--region", "AU"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      region: "AU"
    });
  });

  test("prints energy live wholesale as JSON", async () => {
    const result = await runCli(server.url, ["energy", "live-wholesale", "--region", "AU"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      region: "AU"
    });
  });

  test("prints series get as JSON", async () => {
    const result = await runCli(server.url, [
      "series",
      "get",
      "energy.wholesale.rrp.au_weighted_aud_mwh",
      "--region",
      "AU"
    ]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      points: expect.any(Array),
      region: "AU",
      seriesId: "energy.wholesale.rrp.au_weighted_aud_mwh"
    });
  });
});
