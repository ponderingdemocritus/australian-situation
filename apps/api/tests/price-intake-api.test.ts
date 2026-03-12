import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveLiveStorePath } from "@aus-dash/shared";
import { afterEach, describe, expect, test } from "vitest";
import { createApp } from "../src/app";

const BASIC_AUTH_HEADER = `Basic ${Buffer.from("agent:buildaustralia").toString("base64")}`;

describe("price intake API", () => {
  const originalStorePath = process.env.AUS_DASH_STORE_PATH;

  afterEach(() => {
    if (originalStorePath) {
      process.env.AUS_DASH_STORE_PATH = originalStorePath;
      return;
    }

    delete process.env.AUS_DASH_STORE_PATH;
  });

  test("requires basic auth for batch intake", async () => {
    const app = createApp();
    const response = await app.request("/api/prices/intake/batches", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sourceId: "agent_discovery",
        items: []
      })
    });

    expect(response.status).toBe(401);
  });

  test("accepts a batch, exposes unresolved items, and allows reconciliation", async () => {
    const app = createApp();
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aus-dash-price-intake-store-"));
    process.env.AUS_DASH_STORE_PATH = resolveLiveStorePath(
      path.join(tempDir, "live-store.json")
    );

    const batchResponse = await app.request("/api/prices/intake/batches", {
      method: "POST",
      headers: {
        Authorization: BASIC_AUTH_HEADER,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sourceId: "agent_discovery",
        capturedAt: "2026-03-12T00:00:00Z",
        items: [
          {
            observedAt: "2026-03-12T00:00:00Z",
            merchantName: "Coles",
            regionCode: "AU",
            title: "Greek Yogurt 1kg",
            externalOfferId: "coles-yogurt-1kg",
            priceAmount: 6.5
          },
          {
            observedAt: "2026-03-12T00:00:00Z",
            merchantName: "Woolworths",
            regionCode: "NSW",
            title: "Laundry Powder 2kg",
            externalOfferId: "ww-laundry-2kg",
            priceAmount: 12.9
          }
        ]
      })
    });

    expect(batchResponse.status).toBe(200);
    const batchBody = await batchResponse.json();
    expect(batchBody).toMatchObject({
      sourceId: "agent_discovery",
      queuedCount: 2,
      unresolvedItemIds: expect.any(Array)
    });

    const unresolvedResponse = await app.request("/api/prices/unresolved-items", {
      headers: {
        Authorization: BASIC_AUTH_HEADER
      }
    });
    expect(unresolvedResponse.status).toBe(200);

    const unresolvedBody = await unresolvedResponse.json();
    expect(unresolvedBody.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Greek Yogurt 1kg",
          status: "open"
        }),
        expect.objectContaining({
          title: "Laundry Powder 2kg",
          status: "open"
        })
      ])
    );

    const reconcileResponse = await app.request(
      `/api/prices/unresolved-items/${batchBody.unresolvedItemIds[0]}/reconcile`,
      {
        method: "POST",
        headers: {
          Authorization: BASIC_AUTH_HEADER,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          canonicalCategorySlug: "food",
          canonicalCategoryName: "Food",
          canonicalProductSlug: "greek-yogurt-1kg",
          canonicalProductName: "Greek Yogurt 1kg",
          notes: "Canonical mapping confirmed"
        })
      }
    );

    expect(reconcileResponse.status).toBe(200);
    expect(await reconcileResponse.json()).toMatchObject({
      item: expect.objectContaining({
        status: "reconciled",
        canonicalCategorySlug: "food",
        canonicalProductSlug: "greek-yogurt-1kg"
      })
    });

    const classifyResponse = await app.request(
      `/api/prices/unresolved-items/${batchBody.unresolvedItemIds[0]}/classify`,
      {
        method: "POST",
        headers: {
          Authorization: BASIC_AUTH_HEADER,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          productFamilySlug: "dairy-staples",
          countryOfOrigin: "AU",
          isAustralianMade: true,
          manufacturerName: "Domestic Dairy Processor",
          domesticValueShareBand: "high",
          aiExposureLevel: "high",
          aiExposureReason: "AI-assisted planning and packaging",
          comparableUnitBasis: "per_kg",
          isControlCandidate: false
        })
      }
    );
    expect(classifyResponse.status).toBe(200);
    expect(await classifyResponse.json()).toMatchObject({
      item: expect.objectContaining({
        aiExposureLevel: "high",
        cohortReady: true
      })
    });

    const invalidClassifyResponse = await app.request(
      `/api/prices/unresolved-items/${batchBody.unresolvedItemIds[1]}/classify`,
      {
        method: "POST",
        headers: {
          Authorization: BASIC_AUTH_HEADER,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          productFamilySlug: "cleaning-consumables",
          countryOfOrigin: "AU",
          isAustralianMade: true,
          manufacturerName: "Domestic Supplier",
          domesticValueShareBand: "medium",
          aiExposureLevel: "low",
          aiExposureReason: "Control product",
          comparableUnitBasis: "per_kg",
          isControlCandidate: true
        })
      }
    );
    expect(invalidClassifyResponse.status).toBe(409);
    expect(await invalidClassifyResponse.json()).toEqual({
      error: {
        code: "INVALID_ITEM_STATE",
        message:
          `Unresolved item ${batchBody.unresolvedItemIds[1]} must be reconciled before classification`
      }
    });

    const invalidPromoteResponse = await app.request(
      `/api/prices/unresolved-items/${batchBody.unresolvedItemIds[1]}/promote`,
      {
        method: "POST",
        headers: {
          Authorization: BASIC_AUTH_HEADER
        }
      }
    );
    expect(invalidPromoteResponse.status).toBe(409);
    expect(await invalidPromoteResponse.json()).toEqual({
      error: {
        code: "INVALID_ITEM_STATE",
        message:
          `Unresolved item ${batchBody.unresolvedItemIds[1]} must be reconciled before promotion`
      }
    });

    const openOnlyResponse = await app.request("/api/prices/unresolved-items?status=open", {
      headers: {
        Authorization: BASIC_AUTH_HEADER
      }
    });
    expect(openOnlyResponse.status).toBe(200);

    const openOnlyBody = await openOnlyResponse.json();
    expect(openOnlyBody.items).toHaveLength(1);
    expect(openOnlyBody.items[0]).toMatchObject({
      title: "Laundry Powder 2kg",
      status: "open"
    });

    const promoteResponse = await app.request(
      `/api/prices/unresolved-items/${batchBody.unresolvedItemIds[0]}/promote`,
      {
        method: "POST",
        headers: {
          Authorization: BASIC_AUTH_HEADER
        }
      }
    );
    expect(promoteResponse.status).toBe(200);
    expect(await promoteResponse.json()).toMatchObject({
      item: expect.objectContaining({
        status: "promoted"
      })
    });

    const promotedResponse = await app.request(
      "/api/prices/unresolved-items?status=promoted",
      {
        headers: {
          Authorization: BASIC_AUTH_HEADER
        }
      }
    );
    expect(promotedResponse.status).toBe(200);

    const promotedBody = await promotedResponse.json();
    expect(promotedBody.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Greek Yogurt 1kg",
          status: "promoted",
          promotedAt: expect.any(String)
        })
      ])
    );
  });
});
