export type SyncResult = {
  job: "sync-housing-series";
  status: "ok";
  syncedAt: string;
};

export async function syncHousingSeries(): Promise<SyncResult> {
  return {
    job: "sync-housing-series",
    status: "ok",
    syncedAt: new Date().toISOString()
  };
}
