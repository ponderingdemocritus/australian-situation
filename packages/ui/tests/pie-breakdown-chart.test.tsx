import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PieBreakdownChart } from "../src";

const sampleData = [
  { key: "coal", label: "Coal", value: 47, color: "#111827" },
  { key: "gas", label: "Gas", value: 18, color: "#f97316" }
];

describe("PieBreakdownChart", () => {
  test("can hide the legend when a compact chart-only layout is needed", () => {
    const markup = renderToStaticMarkup(
      <PieBreakdownChart ariaLabel="Fuel mix" data={sampleData} hideLegend />
    );

    expect(markup).not.toContain("Coal");
    expect(markup).not.toContain("Gas");
  });
});
