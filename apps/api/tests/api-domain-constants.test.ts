import {
  CONSUMPTION_BAND_VALUES,
  CORE_REGION_CODES,
  ENERGY_WINDOW_VALUES,
  NATIONAL_AND_STATE_REGION_CODES,
  TAX_STATUS_VALUES
} from "@aus-dash/data-contract";
import { describe, expect, test } from "vitest";
import {
  API_SUPPORTED_REGIONS,
  ENERGY_RETAIL_CONSUMPTION_BANDS,
  ENERGY_RETAIL_SUPPORTED_REGIONS,
  ENERGY_RETAIL_TAX_STATUS,
  ENERGY_SUPPORTED_WINDOWS,
  ENERGY_WHOLESALE_SUPPORTED_REGIONS,
  REQUIRED_HOUSING_OVERVIEW_SERIES_IDS
} from "../src/routes/api-domain-constants";

describe("api domain constants", () => {
  test("reuses canonical region/filter constants from data-contract", () => {
    expect([...API_SUPPORTED_REGIONS]).toEqual(CORE_REGION_CODES);
    expect([...ENERGY_RETAIL_SUPPORTED_REGIONS]).toEqual(
      NATIONAL_AND_STATE_REGION_CODES
    );
    expect([...ENERGY_WHOLESALE_SUPPORTED_REGIONS]).toEqual(
      NATIONAL_AND_STATE_REGION_CODES.filter((code) => code !== "WA" && code !== "NT" && code !== "ACT")
    );
    expect([...ENERGY_SUPPORTED_WINDOWS]).toEqual(ENERGY_WINDOW_VALUES);
    expect([...ENERGY_RETAIL_TAX_STATUS]).toEqual(TAX_STATUS_VALUES);
    expect([...ENERGY_RETAIL_CONSUMPTION_BANDS]).toEqual(CONSUMPTION_BAND_VALUES);
  });

  test("publishes a centralized housing overview series list", () => {
    expect(REQUIRED_HOUSING_OVERVIEW_SERIES_IDS).toEqual([
      "hvi.value.index",
      "lending.oo.count",
      "lending.oo.value_aud",
      "lending.investor.count",
      "lending.investor.value_aud",
      "lending.avg_loan_size_aud",
      "rates.oo.variable_pct",
      "rates.oo.fixed_pct"
    ]);
  });
});
