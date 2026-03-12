import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import LandingPage from "../app/page";
import { renderRoute } from "./render-route";

describe("LandingPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("introduces the Australia-focused dashboard and primary call to action", async () => {
    await renderRoute(<LandingPage />);

    expect(screen.getByRole("heading", { name: "Australia, read clearly." })).toBeDefined();
    expect(
      screen.getByText("A clean national dashboard for energy, housing, prices, freshness, and provenance.")
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Open dashboard" }).getAttribute("href")).toBe(
      "/dashboard"
    );
  });

  test("shows the product domains exposed in the application", async () => {
    await renderRoute(<LandingPage />);

    expect(screen.getByText("Energy")).toBeDefined();
    expect(screen.getByText("Housing")).toBeDefined();
    expect(screen.getByText("Sources")).toBeDefined();
    expect(screen.getByText("Prices")).toBeDefined();
  });
});
