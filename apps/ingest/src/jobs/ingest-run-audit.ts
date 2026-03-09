import type { IngestionRun } from "@aus-dash/shared";

export type IngestRunAuditOptions = Pick<
  IngestionRun,
  "bullJobId" | "queueName" | "attempt" | "runMode"
>;

export function buildIngestRunAuditFields(
  options: IngestRunAuditOptions
): IngestRunAuditOptions {
  return {
    bullJobId: options.bullJobId,
    queueName: options.queueName,
    attempt: options.attempt,
    runMode: options.runMode
  };
}
