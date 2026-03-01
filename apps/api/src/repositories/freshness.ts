import type { Cadence, FreshnessStatus } from "./live-data-contract";

export function toTimestamp(date: string): number | null {
  const parsedDirect = Date.parse(date);
  if (!Number.isNaN(parsedDirect)) {
    return parsedDirect;
  }

  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(date);
  if (!quarterMatch) {
    return null;
  }

  const year = Number(quarterMatch[1]);
  const quarter = Number(quarterMatch[2]);
  const monthEnd = quarter * 3;
  return Date.parse(`${year}-${String(monthEnd).padStart(2, "0")}-01T00:00:00Z`);
}

export function lagMinutes(nowMs: number, date: string): number {
  const ts = toTimestamp(date);
  if (ts === null) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.floor((nowMs - ts) / 60000));
}

export function freshnessStatus(cadence: Cadence, lagMins: number): FreshnessStatus {
  const thresholdMinutes =
    cadence === "5m"
      ? 20
      : cadence === "daily"
        ? 48 * 60
        : cadence === "monthly"
          ? 72 * 60
          : 7 * 24 * 60;

  return lagMins > thresholdMinutes ? "stale" : "fresh";
}
