import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import MethodologyPage from "../app/dashboard/methodology/page";
import { renderRoute } from "./render-route";

vi.mock("../lib/queries/methodology-dashboard", () => ({
  getMethodologyDashboardData: vi.fn().mockResolvedValue({
    hero: {
      title: "Methodology",
      summary: "Definitions and dimensional requirements for public dashboard metrics."
    },
    metric: {
      metric: "energy.compare.retail",
      version: "energy-comparison-v1",
      description:
        "Cross-country household retail electricity price comparison with tax and consumption-band filters.",
      dimensions: ["country", "peers", "basis", "tax_status", "consumption_band"]
    }
  })
}));

describe("MethodologyPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders methodology metadata", async () => {
    await renderRoute(await MethodologyPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { name: "Methodology" })).toBeDefined();
    expect(screen.getByText("energy-comparison-v1")).toBeDefined();
    expect(screen.getByText("tax_status")).toBeDefined();
  });
});
