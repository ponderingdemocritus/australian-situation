import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import DashboardPage from "../app/dashboard/page";
import { renderRoute } from "./render-route";

describe("Dashboard shell", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders a structured dashboard home with domain navigation", async () => {
    await renderRoute(await DashboardPage());

    expect(screen.getByRole("heading", { name: "National dashboard" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Overview" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("link", { name: "Energy" }).getAttribute("href")).toBe(
      "/dashboard/energy"
    );
    expect(screen.getByRole("link", { name: "Housing" }).getAttribute("href")).toBe(
      "/dashboard/housing"
    );
    expect(screen.getByRole("link", { name: "Sources" }).getAttribute("href")).toBe(
      "/dashboard/sources"
    );
    expect(screen.getByRole("link", { name: "Prices" }).getAttribute("href")).toBe(
      "/dashboard/prices"
    );
  });

  test("explains what the dashboard is organized around", async () => {
    await renderRoute(await DashboardPage());

    expect(
      screen.getByText("Structured around the generated SDK, with each section tied to a real data domain.")
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeDefined();
    expect(screen.getAllByText("Freshness and provenance").length).toBeGreaterThan(0);
  });
});
