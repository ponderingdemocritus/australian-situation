export type IngestBackend = "store" | "postgres";

export function resolveIngestBackend(value: string | undefined): IngestBackend {
  if (!value || value.length === 0 || value === "store") {
    return "store";
  }
  if (value === "postgres") {
    return "postgres";
  }
  throw new Error(`Unsupported ingest backend: ${value}`);
}
