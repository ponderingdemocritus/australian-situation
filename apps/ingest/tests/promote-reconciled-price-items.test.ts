import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendPriceIntakeBatch,
  readLiveStoreSync,
  reconcileUnresolvedPriceItem,
  resolveLiveStorePath,
  writeLiveStoreSync
} from "@aus-dash/shared";
import { afterEach, describe, expect, test } from "vitest";
import { promoteReconciledPriceItems } from "../src/jobs/promote-reconciled-price-items";

const TEMP_DIRS: string[] = [];

function createTempStorePath(name: string): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), `aus-dash-${name}-`));
  TEMP_DIRS.push(tempDir);
  return resolveLiveStorePath(path.join(tempDir, "live-store.json"));
}

afterEach(() => {
  while (TEMP_DIRS.length > 0) {
    const tempDir = TEMP_DIRS.pop();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

describe("promote reconciled price items", () => {
  test("marks reconciled queue items as promoted and records an ingestion run", async () => {
    const storePath = createTempStorePath("promote-reconciled");
    const store = readLiveStoreSync(storePath);

    const batch = appendPriceIntakeBatch(store, {
      sourceId: "agent_test",
      capturedAt: "2026-03-12T00:00:00Z",
      items: [
        {
          observedAt: "2026-03-12T00:00:00Z",
          merchantName: "Bunnings",
          regionCode: "AU",
          title: "Test Item",
          externalOfferId: "test-item-1",
          priceAmount: 12.5
        }
      ]
    });
    reconcileUnresolvedPriceItem(store, batch.unresolvedItems[0]!.unresolvedItemId, {
      canonicalCategorySlug: "garden",
      canonicalCategoryName: "Garden",
      canonicalProductSlug: "test-item",
      canonicalProductName: "Test Item"
    });
    writeLiveStoreSync(store, storePath);

    await expect(
      promoteReconciledPriceItems({
        storePath,
        sourceId: "agent_test",
        asOf: "2026-03-12T01:00:00Z"
      })
    ).resolves.toMatchObject({
      job: "promote-reconciled-price-items",
      status: "ok",
      promotedCount: 1
    });

    const reread = readLiveStoreSync(storePath);
    const promoted = reread.unresolvedPriceItems.find(
      (item) => item.sourceId === "agent_test"
    );
    expect(promoted).toMatchObject({
      status: "promoted",
      promotedAt: "2026-03-12T01:00:00Z",
      canonicalProductSlug: "test-item"
    });
    expect(reread.ingestionRuns.at(-1)).toMatchObject({
      job: "promote-reconciled-price-items",
      status: "ok",
      rowsInserted: 1
    });
  });
});
