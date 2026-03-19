import { beforeEach, describe, expect, test, vi } from "vitest";
import { getMethodologyDashboardData } from "../lib/queries/methodology-dashboard";

const sdkMocks = vi.hoisted(() => ({
  getApiV1MetadataMethodology: vi.fn()
}));

vi.mock("@aus-dash/sdk", () => sdkMocks);

describe("getMethodologyDashboardData", () => {
  beforeEach(() => {
    sdkMocks.getApiV1MetadataMethodology.mockReset();
    sdkMocks.getApiV1MetadataMethodology.mockResolvedValue({
      metric: "energy.compare.retail",
      methodologyVersion: "energy-comparison-v1",
      description:
        "Cross-country household retail electricity price comparison with tax and consumption-band filters.",
      requiredDimensions: ["country", "peers", "basis", "tax_status", "consumption_band"]
    });
  });

  test("maps methodology metadata into a dashboard view", async () => {
    const result = await getMethodologyDashboardData("energy.compare.retail");

    expect(result.hero.title).toBe("Methodology");
    expect(result.metric.metric).toBe("energy.compare.retail");
    expect(result.metric.version).toBe("energy-comparison-v1");
    expect(result.metric.dimensions).toEqual([
      "country",
      "peers",
      "basis",
      "tax_status",
      "consumption_band"
    ]);
  });
});
