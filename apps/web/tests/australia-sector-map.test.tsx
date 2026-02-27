import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AustraliaSectorMap } from "../features/dashboard/components/australia-sector-map";

describe("AustraliaSectorMap", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all state and territory targets", () => {
    render(<AustraliaSectorMap region="AU" onSelectRegion={() => {}} />);

    expect(screen.getByRole("button", { name: "Select region NSW" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Select region VIC" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Select region QLD" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Select region SA" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Select region WA" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Select region TAS" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Select region ACT" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Select region NT" })).toBeDefined();
  });

  test("applies active state only to selected region", () => {
    const { rerender } = render(<AustraliaSectorMap region="VIC" onSelectRegion={() => {}} />);

    expect(screen.getByRole("button", { name: "Select region VIC" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: "Select region NSW" }).getAttribute("aria-pressed")).toBe(
      "false"
    );

    rerender(<AustraliaSectorMap region="AU" onSelectRegion={() => {}} />);

    expect(screen.getByRole("button", { name: "Select region VIC" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(screen.getByRole("button", { name: "Select region NSW" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
  });

  test("calls onSelectRegion when a region is clicked", () => {
    const onSelectRegion = vi.fn();
    render(<AustraliaSectorMap region="AU" onSelectRegion={onSelectRegion} />);

    fireEvent.click(screen.getByRole("button", { name: "Select region QLD" }));

    expect(onSelectRegion).toHaveBeenCalledWith("QLD");
  });

  test("calls onSelectRegion from keyboard enter and space", () => {
    const onSelectRegion = vi.fn();
    render(<AustraliaSectorMap region="AU" onSelectRegion={onSelectRegion} />);

    const nswTarget = screen.getByRole("button", { name: "Select region NSW" });
    fireEvent.keyDown(nswTarget, { key: "Enter" });
    fireEvent.keyDown(nswTarget, { key: " " });

    expect(onSelectRegion).toHaveBeenCalledWith("NSW");
    expect(onSelectRegion).toHaveBeenCalledTimes(2);
  });
});
