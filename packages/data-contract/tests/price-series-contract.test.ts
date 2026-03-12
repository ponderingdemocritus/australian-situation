import { describe, expect, test } from "vitest";
import {
  AI_DEFLATION_OVERVIEW_SERIES_IDS,
  AI_DEFLATION_SERIES_IDS,
  PRICE_INDEX_OVERVIEW_SERIES_IDS,
  PRICE_INDEX_SERIES_IDS
} from "../src/series";

describe("price series contract", () => {
  test("defines required major goods price index series ids", () => {
    expect(PRICE_INDEX_SERIES_IDS).toEqual(
      expect.arrayContaining([
        "prices.major_goods.overall.index",
        "prices.major_goods.food.index",
        "prices.major_goods.household_supplies.index"
      ])
    );
  });

  test("defines the overview series in public display order", () => {
    expect(PRICE_INDEX_OVERVIEW_SERIES_IDS).toEqual([
      "prices.major_goods.overall.index",
      "prices.major_goods.food.index",
      "prices.major_goods.household_supplies.index"
    ]);
  });

  test("defines AI-deflation cohort series ids", () => {
    expect(AI_DEFLATION_SERIES_IDS).toEqual(
      expect.arrayContaining([
        "prices.au_made.all.index",
        "prices.au_made.ai_exposed.index",
        "prices.au_made.control.index",
        "prices.imported.matched_control.index",
        "prices.ai_deflation.spread.au_made_vs_control.index"
      ])
    );
  });

  test("defines AI-deflation overview order", () => {
    expect(AI_DEFLATION_OVERVIEW_SERIES_IDS).toEqual([
      "prices.au_made.all.index",
      "prices.au_made.ai_exposed.index",
      "prices.au_made.control.index",
      "prices.imported.matched_control.index",
      "prices.ai_deflation.spread.au_made_vs_control.index"
    ]);
  });
});
