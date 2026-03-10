import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { renderHomePage } from "./render-home-page";

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders a readable page title and summary", async () => {
    await renderHomePage();
    expect(screen.getByText("Australia situation dashboard")).toBeDefined();
    expect(
      screen.getByText("Track energy prices and housing pressure in plain language.")
    ).toBeDefined();
  });

  test("renders a plain-language region section", async () => {
    await renderHomePage();
    expect(screen.getByText("Choose a region")).toBeDefined();
  });

  test("renders a scalable area directory with search", async () => {
    await renderHomePage();
    expect(screen.getByText("Browse areas")).toBeDefined();
    expect(screen.getByPlaceholderText("Search areas")).toBeDefined();
  });

  test("removes console-only UI affordances", async () => {
    await renderHomePage();
    expect(screen.queryByText("australia_live / econ")).toBeNull();
    expect(screen.queryByText("Live Feed")).toBeNull();
    expect(screen.queryByPlaceholderText("Filter logs or execute command...")).toBeNull();
  });
});
