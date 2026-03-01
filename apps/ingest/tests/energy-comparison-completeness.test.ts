import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLiveStoreSync, resolveLiveStorePath } from "@aus-dash/shared";
import { describe, expect, test } from "vitest";
import { syncEnergyNormalization } from "../src/jobs/sync-energy-normalization";
import { syncEnergyRetailGlobal } from "../src/jobs/sync-energy-retail-global";
import { syncEnergyRetailPlans } from "../src/jobs/sync-energy-retail-plans";
import { syncEnergyWholesale } from "../src/jobs/sync-energy-wholesale";
import { syncEnergyWholesaleGlobal } from "../src/jobs/sync-energy-wholesale-global";

function listCountriesForSeries(
  storePath: string,
  seriesId: string,
  filter?: { taxStatus?: string; consumptionBand?: string }
): string[] {
  const store = readLiveStoreSync(storePath);
  return [
    ...new Set(
      store.observations
        .filter((observation) => observation.seriesId === seriesId)
        .filter((observation) =>
          filter?.taxStatus ? observation.taxStatus === filter.taxStatus : true
        )
        .filter((observation) =>
          filter?.consumptionBand
            ? observation.consumptionBand === filter.consumptionBand
            : true
        )
        .map((observation) => observation.countryCode)
        .filter((countryCode): countryCode is string => Boolean(countryCode))
    )
  ].sort((a, b) => a.localeCompare(b));
}

describe("energy comparison completeness gate", () => {
  test("produces AU, US, and DE comparable rows for dashboard comparison endpoints", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-energy-compare-gate-"));
    const storePath = resolveLiveStorePath(path.join(tempDir, "live-store.json"));

    await syncEnergyWholesale({ storePath });
    await syncEnergyWholesaleGlobal({ storePath });
    await syncEnergyRetailPlans({ storePath });
    await syncEnergyRetailGlobal({ storePath });
    await syncEnergyNormalization({ storePath });

    const nominalRetailCountries = listCountriesForSeries(
      storePath,
      "energy.retail.price.country.usd_kwh_nominal",
      {
        taxStatus: "incl_tax",
        consumptionBand: "household_mid"
      }
    );
    expect(nominalRetailCountries).toEqual(["AU", "DE", "US"]);

    const pppRetailCountries = listCountriesForSeries(
      storePath,
      "energy.retail.price.country.usd_kwh_ppp",
      {
        taxStatus: "incl_tax",
        consumptionBand: "household_mid"
      }
    );
    expect(pppRetailCountries).toEqual(["AU", "DE", "US"]);

    const wholesaleCountries = listCountriesForSeries(
      storePath,
      "energy.wholesale.spot.country.usd_mwh"
    );
    expect(wholesaleCountries).toEqual(["AU", "DE", "US"]);
  });
});
