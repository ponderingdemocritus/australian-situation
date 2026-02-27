import { describe, expect, test } from "vitest";
import { Card, DashboardPanel, DashboardPanelHeader, StatusIndicator } from "../src";

describe("@aus-dash/ui shadcn exports", () => {
  test("exports card component", () => {
    expect(typeof Card).toBe("function");
  });

  test("exports dashboard panel components", () => {
    expect(typeof DashboardPanel).toBe("function");
    expect(typeof DashboardPanelHeader).toBe("function");
  });

  test("exports status indicator component", () => {
    expect(typeof StatusIndicator).toBe("function");
  });
});
