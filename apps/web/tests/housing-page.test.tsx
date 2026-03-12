import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import HousingPage from "../app/dashboard/housing/page";
import { renderRoute } from "./render-route";

vi.mock("../lib/queries/housing-dashboard", () => ({
  getHousingDashboardData: vi.fn().mockResolvedValue({
    hero: {
      title: "Housing pressure",
      summary: "Property values, lending, and mortgage pressure for the national market."
    },
    metrics: [
      { label: "Home value index", value: "169.4", detail: "2025-12-31" },
      { label: "Average loan size", value: "736,000 AUD", detail: "2025-12-31" },
      { label: "Owner-occupier variable rate", value: "6.08%", detail: "2025-12-31" },
      { label: "Investor lending", value: "16,950", detail: "2025-12-31" }
    ],
    coverageNote: "1 series currently missing from the housing overview."
  })
}));

describe("HousingPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the housing dashboard sections", async () => {
    await renderRoute(await HousingPage());

    expect(screen.getByRole("heading", { name: "Housing pressure" })).toBeDefined();
    expect(screen.getByText("736,000 AUD")).toBeDefined();
    expect(screen.getByText("1 series currently missing from the housing overview.")).toBeDefined();
  });
});
