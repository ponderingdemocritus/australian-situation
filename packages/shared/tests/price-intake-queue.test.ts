import { describe, expect, test } from "vitest";
import {
  appendPriceIntakeBatch,
  classifyUnresolvedPriceItem,
  createSeedLiveStore,
  listUnresolvedPriceItems,
  promoteUnresolvedPriceItem,
  reconcileUnresolvedPriceItem
} from "../src/live-store";

describe("price intake queue", () => {
  test("appends a batch and creates unresolved queue items", () => {
    const store = createSeedLiveStore();

    const result = appendPriceIntakeBatch(store, {
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
          priceAmount: 12.9,
          listingUrl: "https://example.test/laundry"
        }
      ]
    });

    expect(result.batch.sourceId).toBe("agent_discovery");
    expect(result.batch.itemCount).toBe(2);
    expect(result.unresolvedItems).toHaveLength(2);
    expect(store.rawSnapshots).toHaveLength(1);
    expect(listUnresolvedPriceItems(store)).toEqual(
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
  });

  test("moves an unresolved queue item through reconcile, classify, and promote stages", () => {
    const store = createSeedLiveStore();
    const { unresolvedItems } = appendPriceIntakeBatch(store, {
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
        }
      ]
    });

    const reconciled = reconcileUnresolvedPriceItem(
      store,
      unresolvedItems[0]!.unresolvedItemId,
      {
        canonicalCategorySlug: "food",
        canonicalCategoryName: "Food",
        canonicalProductSlug: "greek-yogurt-1kg",
        canonicalProductName: "Greek Yogurt 1kg",
        notes: "Canonical mapping confirmed"
      }
    );
    const classified = classifyUnresolvedPriceItem(
      store,
      unresolvedItems[0]!.unresolvedItemId,
      {
        productFamilySlug: "dairy-staples",
        countryOfOrigin: "AU",
        isAustralianMade: true,
        manufacturerName: "Domestic Dairy Processor",
        domesticValueShareBand: "high",
        aiExposureLevel: "high",
        aiExposureReason: "AI-assisted planning and packaging",
        comparableUnitBasis: "per_kg",
        isControlCandidate: false
      }
    );
    const promoted = promoteUnresolvedPriceItem(
      store,
      unresolvedItems[0]!.unresolvedItemId,
      "2026-03-12T01:00:00Z"
    );

    expect(reconciled).toEqual({
      kind: "ok",
      item: expect.objectContaining({
        canonicalCategorySlug: "food",
        canonicalProductSlug: "greek-yogurt-1kg",
        notes: "Canonical mapping confirmed"
      })
    });
    expect(classified).toEqual({
      kind: "ok",
      item: expect.objectContaining({
        aiExposureLevel: "high",
        cohortReady: true
      })
    });
    expect(promoted).toEqual({
      kind: "ok",
      item: expect.objectContaining({
        status: "promoted",
        promotedAt: "2026-03-12T01:00:00Z"
      })
    });
    expect(listUnresolvedPriceItems(store)).toHaveLength(0);
    expect(listUnresolvedPriceItems(store, "reconciled")).toHaveLength(0);
    expect(listUnresolvedPriceItems(store, "promoted")).toHaveLength(1);
  });

  test("rejects classify when an item has not been reconciled", () => {
    const store = createSeedLiveStore();
    const { unresolvedItems } = appendPriceIntakeBatch(store, {
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
        }
      ]
    });

    expect(
      classifyUnresolvedPriceItem(store, unresolvedItems[0]!.unresolvedItemId, {
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
    ).toEqual({
      kind: "invalid_state",
      currentStatus: "open"
    });
  });

  test("rejects promote when an item has not been reconciled", () => {
    const store = createSeedLiveStore();
    const { unresolvedItems } = appendPriceIntakeBatch(store, {
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
        }
      ]
    });

    expect(
      promoteUnresolvedPriceItem(
        store,
        unresolvedItems[0]!.unresolvedItemId,
        "2026-03-12T01:00:00Z"
      )
    ).toEqual({
      kind: "invalid_state",
      currentStatus: "open"
    });
  });
});
