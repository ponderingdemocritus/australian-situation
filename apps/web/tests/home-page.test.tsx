import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import HomePage from "../app/page";

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders situational dashboard heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "SITUATIONAL DASHBOARD" })).toBeDefined();
  });

  test("renders australia sector map callout", () => {
    render(<HomePage />);
    expect(screen.getByText("SECTOR: AUSTRALIA")).toBeDefined();
  });

  test("renders priority alert rail", () => {
    render(<HomePage />);
    expect(screen.getByText("PRIORITY_ALERTS")).toBeDefined();
  });
});
