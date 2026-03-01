import { expect, test, type Page } from "@playwright/test";

function mockEnergyOverview() {
  return {
    region: "AU",
    panels: {
      liveWholesale: {
        valueAudMwh: 118,
        valueCKwh: 11.8
      },
      retailAverage: {
        annualBillAudMean: 1940,
        annualBillAudMedian: 1885
      },
      benchmark: {
        dmoAnnualBillAud: 1985
      },
      cpiElectricity: {
        indexValue: 151.2,
        period: "2025-Q4"
      }
    },
    freshness: {
      updatedAt: "2026-02-27T02:00:00Z",
      status: "fresh"
    }
  };
}

function mockHousingOverview() {
  return {
    region: "AU",
    requiredSeriesIds: [],
    missingSeriesIds: [],
    metrics: [],
    updatedAt: "2026-02-27"
  };
}

function mockRetailComparison(basis: "nominal" | "ppp") {
  return {
    country: "AU",
    peers: ["US", "DE"],
    basis,
    taxStatus: "incl_tax",
    consumptionBand: "household_mid",
    auRank: 1,
    methodologyVersion: "energy-comparison-v1",
    rows: [
      {
        countryCode: "AU",
        value: basis === "nominal" ? 0.32 : 0.29,
        rank: 1
      },
      {
        countryCode: "DE",
        value: basis === "nominal" ? 0.3 : 0.27,
        rank: 2
      },
      {
        countryCode: "US",
        value: basis === "nominal" ? 0.18 : 0.21,
        rank: 3
      }
    ],
    comparisons: [
      { peerCountryCode: "US", gapPct: 77.78 },
      { peerCountryCode: "DE", gapPct: 6.67 }
    ]
  };
}

function mockWholesaleComparison() {
  return {
    country: "AU",
    peers: ["US", "DE"],
    auRank: 1,
    auPercentile: 100,
    methodologyVersion: "energy-comparison-v1",
    rows: [
      { countryCode: "AU", value: 120, rank: 1 },
      { countryCode: "DE", value: 95, rank: 2 },
      { countryCode: "US", value: 70, rank: 3 }
    ],
    comparisons: [
      { peerCountryCode: "US", gapPct: 71.43 },
      { peerCountryCode: "DE", gapPct: 26.32 }
    ]
  };
}

function mockMethodology() {
  return {
    metric: "energy.compare.retail",
    methodologyVersion: "energy-comparison-v1",
    description: "Retail comparison methodology.",
    requiredDimensions: ["country", "peers", "tax_status", "consumption_band"]
  };
}

async function installComparisonApiMocks(page: Page) {
  await page.route("**/api/energy/overview?region=AU", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockEnergyOverview())
    });
  });

  await page.route("**/api/housing/overview?region=AU", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockHousingOverview())
    });
  });

  await page.route("**/api/v1/energy/compare/retail**", async (route) => {
    const url = route.request().url();
    const basis = url.includes("basis=ppp") ? "ppp" : "nominal";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockRetailComparison(basis))
    });
  });

  await page.route("**/api/v1/energy/compare/wholesale**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockWholesaleComparison())
    });
  });

  await page.route(
    "**/api/v1/metadata/methodology?metric=energy.compare.retail",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockMethodology())
      });
    }
  );
}

test("user can load AU vs global view and switch basis", async ({ page }) => {
  await installComparisonApiMocks(page);
  await page.goto("/");

  await expect(page.getByText("AU_VS_GLOBAL_COMPARISON")).toBeVisible();
  await expect(page.getByText("0.320 USD/kWh")).toBeVisible();

  await page.getByRole("button", { name: "PPP" }).click();
  await expect(page.getByText("0.290 USD/kWh PPP")).toBeVisible();
});

test("user sees API-backed rank, spread, and freshness", async ({ page }) => {
  await installComparisonApiMocks(page);
  await page.goto("/");

  await expect(page.getByText("AU_WHOLESALE_PERCENTILE")).toBeVisible();
  await expect(page.getByText("100")).toBeVisible();
  await expect(page.getByText("rank #1")).toBeVisible();
  await expect(page.getByText("energy-comparison-v1")).toBeVisible();
  await expect(page.getByText("FRESH")).toBeVisible();
});
