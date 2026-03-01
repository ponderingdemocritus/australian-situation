import { describe, expect, test } from "vitest";
import {
  CONSUMPTION_BAND_VALUES,
  ENERGY_RETAIL_SERIES_IDS,
  ENERGY_WHOLESALE_SERIES_IDS,
  TAX_STATUS_VALUES,
  isConsumptionBand,
  isTaxStatus
} from "../src/series";

describe("energy comparison series contract", () => {
  test("defines required wholesale comparison series ids", () => {
    expect(ENERGY_WHOLESALE_SERIES_IDS).toEqual(
      expect.arrayContaining([
        "energy.wholesale.spot.au.aud_mwh",
        "energy.wholesale.spot.country.usd_mwh",
        "energy.wholesale.spread.au_vs_peer.pct",
        "energy.wholesale.rank.au.percentile"
      ])
    );
  });

  test("defines required retail comparison series ids", () => {
    expect(ENERGY_RETAIL_SERIES_IDS).toEqual(
      expect.arrayContaining([
        "energy.retail.price.country.local_kwh",
        "energy.retail.price.country.usd_kwh_nominal",
        "energy.retail.price.country.usd_kwh_ppp",
        "energy.retail.spread.au_vs_peer.nominal_pct",
        "energy.retail.spread.au_vs_peer.ppp_pct",
        "energy.retail.rank.au.nominal",
        "energy.retail.rank.au.ppp"
      ])
    );
  });

  test("rejects unknown tax status values", () => {
    expect(TAX_STATUS_VALUES).toEqual(["incl_tax", "excl_tax", "mixed"]);
    expect(isTaxStatus("incl_tax")).toBe(true);
    expect(isTaxStatus("excl_tax")).toBe(true);
    expect(isTaxStatus("mixed")).toBe(true);
    expect(isTaxStatus("unknown")).toBe(false);
  });

  test("rejects unknown consumption band values", () => {
    expect(CONSUMPTION_BAND_VALUES).toEqual([
      "household_low",
      "household_mid",
      "household_high",
      "non_household_small"
    ]);
    expect(isConsumptionBand("household_low")).toBe(true);
    expect(isConsumptionBand("household_mid")).toBe(true);
    expect(isConsumptionBand("household_high")).toBe(true);
    expect(isConsumptionBand("non_household_small")).toBe(true);
    expect(isConsumptionBand("unknown_band")).toBe(false);
  });
});
