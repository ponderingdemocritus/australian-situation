import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { renderHomePage } from "./render-home-page";

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders top breadcrumb path", async () => {
    await renderHomePage();
    expect(screen.getByText("australia_live / econ")).toBeDefined();
  });

  test("renders geospatial map callout", async () => {
    await renderHomePage();
    expect(screen.getByText("Australia / Geospatial")).toBeDefined();
  });

  test("renders live feed panel and command input", async () => {
    await renderHomePage();
    expect(screen.getByText("Live Feed")).toBeDefined();
    expect(screen.getByPlaceholderText("Filter logs or execute command...")).toBeDefined();
  });
});
