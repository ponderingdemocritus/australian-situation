import {
  appendIngestionRun,
  promoteReconciledPriceItemsInStore,
  readLiveStoreSync,
  writeLiveStoreSync
} from "@aus-dash/shared";
import {
  buildIngestRunAuditFields,
  type IngestRunAuditOptions
} from "./ingest-run-audit";

type PromoteReconciledPriceItemsOptions = IngestRunAuditOptions & {
  storePath?: string;
  sourceId?: string;
  asOf?: string;
};

export type PromoteReconciledPriceItemsResult = {
  job: "promote-reconciled-price-items";
  status: "ok";
  promotedCount: number;
  promotedItemIds: string[];
  syncedAt: string;
};

export async function promoteReconciledPriceItems(
  options: PromoteReconciledPriceItemsOptions = {}
): Promise<PromoteReconciledPriceItemsResult> {
  const startedAt = options.asOf ?? new Date().toISOString();
  const syncedAt = startedAt;
  const store = readLiveStoreSync(options.storePath);
  const promoted = promoteReconciledPriceItemsInStore(store, {
    sourceId: options.sourceId,
    promotedAt: syncedAt
  });

  appendIngestionRun(store, {
    job: "promote-reconciled-price-items",
    status: "ok",
    startedAt,
    finishedAt: syncedAt,
    rowsInserted: promoted.length,
    rowsUpdated: 0,
    ...buildIngestRunAuditFields(options)
  });
  writeLiveStoreSync(store, options.storePath);

  return {
    job: "promote-reconciled-price-items",
    status: "ok",
    promotedCount: promoted.length,
    promotedItemIds: promoted.map((item) => item.unresolvedItemId),
    syncedAt
  };
}
