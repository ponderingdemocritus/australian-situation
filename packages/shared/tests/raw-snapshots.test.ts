import { describe, expect, test } from "vitest";
import { createSeedLiveStore, payloadChecksumSha256, stageRawPayload } from "../src/live-store";

describe("raw snapshot staging", () => {
  test("returns stable sha256 checksums for payload content", () => {
    const first = payloadChecksumSha256('{"hello":"world"}');
    const second = payloadChecksumSha256('{"hello":"world"}');
    const third = payloadChecksumSha256('{"hello":"world!"}');

    expect(first).toEqual(second);
    expect(third).not.toEqual(first);
  });

  test("stages raw payload once per source+checksum and dedupes replay", () => {
    const store = createSeedLiveStore();
    const beforeCount = store.rawSnapshots.length;

    const first = stageRawPayload(store, {
      sourceId: "aemo_wholesale",
      payload: "csv-payload-1",
      contentType: "text/csv",
      capturedAt: "2026-02-27T02:05:00Z"
    });
    const second = stageRawPayload(store, {
      sourceId: "aemo_wholesale",
      payload: "csv-payload-1",
      contentType: "text/csv",
      capturedAt: "2026-02-27T02:06:00Z"
    });

    expect(first.staged).toBe(true);
    expect(second.staged).toBe(false);
    expect(second.snapshot.checksumSha256).toBe(first.snapshot.checksumSha256);
    expect(store.rawSnapshots.length).toBe(beforeCount + 1);
  });
});
