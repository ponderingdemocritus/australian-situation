import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3001";

test("dashboard renders live API overview and comparison data without mocks", async ({
  page,
  request
}) => {
  const [energyResponse, retailResponse] = await Promise.all([
    request.get(`${apiBaseUrl}/api/energy/overview?region=AU`),
    request.get(
      `${apiBaseUrl}/api/v1/energy/compare/retail?country=AU&peers=US,DE&basis=nominal&tax_status=incl_tax&consumption_band=household_mid`
    )
  ]);

  expect(energyResponse.ok()).toBeTruthy();
  expect(retailResponse.ok()).toBeTruthy();

  const energyOverview = await energyResponse.json();
  const retailComparison = await retailResponse.json();
  const auRow = retailComparison.rows.find(
    (row: { countryCode: string; value: number }) => row.countryCode === "AU"
  );

  expect(auRow).toBeTruthy();

  await page.goto("/");
  const economicPanel = page
    .locator("section")
    .filter({ has: page.getByText("Economic Feed") })
    .first();

  await expect(
    economicPanel.getByText(
      `${energyOverview.panels.liveWholesale.valueAudMwh.toFixed(1)} AUD/MWh`
    ).first()
  ).toBeVisible();
  await expect(economicPanel.getByText("AU_VS_GLOBAL_COMPARISON")).toBeVisible();
  await expect(economicPanel.getByText(`${auRow.value.toFixed(3)} USD/kWh`).first()).toBeVisible();
});
