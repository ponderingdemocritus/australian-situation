import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DashboardShell } from "../features/dashboard/components/dashboard-shell";

describe("Region URL navigation", () => {
  afterEach(() => {
    cleanup();
  });

  test("map click pushes region URL to history", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    render(<DashboardShell initialRegion="AU" />);

    fireEvent.click(screen.getByRole("button", { name: "Select region NSW" }));

    expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/NSW?subject=energy");
    pushStateSpy.mockRestore();
  });

  test("dropdown change pushes region URL to history", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    render(<DashboardShell initialRegion="AU" />);

    fireEvent.change(screen.getByLabelText("Region"), { target: { value: "QLD" } });

    expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/QLD?subject=energy");
    pushStateSpy.mockRestore();
  });

  test("subject tab preserved in URL on region change", async () => {
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");
    render(<DashboardShell initialRegion="AU" />);

    replaceStateSpy.mockClear();

    screen.getByRole("tab", { name: "Housing" }).click();

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(
        {},
        "",
        expect.stringContaining("subject=housing")
      );
    });

    replaceStateSpy.mockRestore();
  });

  test("popstate event updates region state", () => {
    render(<DashboardShell initialRegion="AU" />);

    expect(screen.getByText("Housing region: AU")).toBeDefined();

    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, pathname: "/VIC", search: "?subject=energy" }
    });

    fireEvent(window, new PopStateEvent("popstate"));

    expect(screen.getByText("Housing region: VIC")).toBeDefined();
    expect(screen.getByText("Energy region: VIC")).toBeDefined();
  });

  test("renders with specific initial region", () => {
    render(<DashboardShell initialRegion="SA" />);

    expect(screen.getByText("Housing region: SA")).toBeDefined();
    expect(screen.getByText("Energy region: SA")).toBeDefined();
  });

  test("AU region pushes root URL", () => {
    const pushStateSpy = vi.spyOn(window.history, "pushState");
    render(<DashboardShell initialRegion="NSW" />);

    fireEvent.change(screen.getByLabelText("Region"), { target: { value: "AU" } });

    expect(pushStateSpy).toHaveBeenCalledWith({}, "", "/?subject=energy");
    pushStateSpy.mockRestore();
  });
});
