const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const MONTH = 2592000; // 30 days
const YEAR = 31536000; // 365 days

/**
 * Convert an ISO date string (or short date like "2025-03-20") to a
 * human-readable relative time string such as "3 hours ago" or "2 days ago".
 *
 * Returns the original value when parsing fails.
 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) {
    return "Unknown";
  }

  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (seconds < 0) {
    return "just now";
  }

  if (seconds < MINUTE) {
    return "just now";
  }

  if (seconds < HOUR) {
    const minutes = Math.floor(seconds / MINUTE);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  if (seconds < DAY) {
    const hours = Math.floor(seconds / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (seconds < WEEK) {
    const days = Math.floor(seconds / DAY);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  if (seconds < MONTH) {
    const weeks = Math.floor(seconds / WEEK);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  if (seconds < YEAR) {
    const months = Math.floor(seconds / MONTH);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }

  const years = Math.floor(seconds / YEAR);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
