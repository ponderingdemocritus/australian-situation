export type IngestRuntimeMode = "bullmq" | "legacy";

export function resolveIngestRuntimeMode(value: string | undefined): IngestRuntimeMode {
  if (!value || value.length === 0 || value === "bullmq") {
    return "bullmq";
  }

  if (value === "legacy") {
    return "legacy";
  }

  throw new Error(`Unsupported ingest runtime mode: ${value}`);
}

export function assertLegacyRuntimeAllowed(nodeEnv: string | undefined): void {
  if (nodeEnv === "production") {
    throw new Error(
      "AUS_DASH_INGEST_RUNTIME=legacy is non-production only during BullMQ burn-in"
    );
  }
}
