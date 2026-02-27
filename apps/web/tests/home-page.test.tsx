import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { renderHomePage } from "./render-home-page";

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders situational dashboard heading", async () => {
    await renderHomePage();
    expect(screen.getByRole("heading", { name: "SITUATIONAL DASHBOARD" })).toBeDefined();
  });

  test("renders australia sector map callout", async () => {
    await renderHomePage();
    expect(screen.getByText("SECTOR: AUSTRALIA")).toBeDefined();
  });

  test("renders priority alert rail", async () => {
    await renderHomePage();
    expect(screen.getByText("PRIORITY_ALERTS")).toBeDefined();
  });
});
