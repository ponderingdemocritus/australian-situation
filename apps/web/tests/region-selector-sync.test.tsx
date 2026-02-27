import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import HomePage from "../app/page";

describe("Region selector sync", () => {
  afterEach(() => {
    cleanup();
  });

  test("one region selector updates housing and energy panels", () => {
    render(<HomePage />);

    const selector = screen.getByLabelText("Region");
    expect(screen.getByText("Housing region: AU")).toBeDefined();
    expect(screen.getByText("Energy region: AU")).toBeDefined();

    fireEvent.change(selector, { target: { value: "VIC" } });

    expect(screen.getByText("Housing region: VIC")).toBeDefined();
    expect(screen.getByText("Energy region: VIC")).toBeDefined();
  });
});
