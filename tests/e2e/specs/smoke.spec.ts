import { expect, test } from "@playwright/test";

test("overview loads", async ({ request }) => {
  const response = await request.get("/");
  const html = await response.text();

  expect(response.ok()).toBeTruthy();
  expect(html).toContain("Housing Control Center");
});
