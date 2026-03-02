import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import RegionPage from "../app/[[...region]]/page";

const fetchMock = vi.fn();

describe("HomePage server prefetch flag", () => {
  const originalFlag = process.env.AUS_DASH_DISABLE_SERVER_PREFETCH;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    process.env.AUS_DASH_DISABLE_SERVER_PREFETCH = "true";
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    if (originalFlag === undefined) {
      delete process.env.AUS_DASH_DISABLE_SERVER_PREFETCH;
    } else {
      process.env.AUS_DASH_DISABLE_SERVER_PREFETCH = originalFlag;
    }
  });

  test("skips server-side API fetches when disabled", async () => {
    await RegionPage({ params: Promise.resolve({ region: undefined }) });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
