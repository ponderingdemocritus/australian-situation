import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { StartedServer } from "./helpers";
import { runCli, startServer } from "./helpers";

describe("@aus-dash/cli authenticated commands", () => {
  let server: StartedServer;

  beforeAll(async () => {
    server = await startServer();
  });

  afterAll(() => {
    server.stop();
  });

  test("returns non-zero with a clear auth error for invalid credentials", async () => {
    const result = await runCli(server.url, [
      "prices",
      "major-goods",
      "--region",
      "AU",
      "--username",
      "agent",
      "--password",
      "wrong-password"
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("UNAUTHORIZED");
    expect(result.stdout).toBe("");
  });

  test("uses environment credentials for authenticated read routes", async () => {
    const result = await runCli(
      server.url,
      ["prices", "major-goods", "--region", "AU"],
      {
        ...process.env,
        AUS_DASH_PASSWORD: "buildaustralia",
        AUS_DASH_USERNAME: "agent"
      }
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      freshness: expect.any(Object),
      indexes: expect.any(Array),
      region: "AU"
    });
  });
});
