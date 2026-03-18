import { describe, expect, test } from "vitest";
import {
  Badge,
  Card,
  Checkbox,
  DashboardPanel,
  DashboardPanelHeader,
  Input,
  Label,
  Select,
  Separator,
  Sidebar,
  SidebarInset,
  SidebarProvider,
  StatusIndicator,
  Table,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "../src";

describe("@aus-dash/ui shadcn exports", () => {
  test("exports card component", () => {
    expect(typeof Card).toBe("function");
  });

  test("exports core shadcn form and layout primitives", () => {
    expect(typeof Badge).toBe("function");
    expect(typeof Checkbox).toBe("function");
    expect(typeof Input).toBe("function");
    expect(typeof Label).toBe("function");
    expect(typeof Select).toBe("function");
    expect(typeof Separator).toBe("function");
    expect(typeof Sidebar).toBe("function");
    expect(typeof SidebarInset).toBe("function");
    expect(typeof SidebarProvider).toBe("function");
    expect(typeof Table).toBe("function");
  });

  test("exports dashboard panel components", () => {
    expect(typeof DashboardPanel).toBe("function");
    expect(typeof DashboardPanelHeader).toBe("function");
  });

  test("exports status indicator component", () => {
    expect(typeof StatusIndicator).toBe("function");
  });

  test("exports tabs components", () => {
    expect(typeof Tabs).toBe("function");
    expect(typeof TabsList).toBe("function");
    expect(typeof TabsTrigger).toBe("function");
    expect(typeof TabsContent).toBe("function");
  });
});
