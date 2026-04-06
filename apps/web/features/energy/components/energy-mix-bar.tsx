"use client";

const SEGMENT_COLORS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-indigo-500",
];

type Segment = {
  label: string;
  pct: number;
};

function parseRow(row: string): Segment | null {
  // Expected format: "Source 12.3%"
  const match = row.match(/^(.+?)\s+([\d.]+)%$/);
  if (!match) return null;
  return { label: match[1], pct: parseFloat(match[2]) };
}

type EnergyMixBarProps = {
  rows: string[];
};

export function EnergyMixBar({ rows }: EnergyMixBarProps) {
  const segments = rows.map(parseRow).filter((s): s is Segment => s !== null);

  if (segments.length === 0) {
    // Fallback: render raw badges
    return (
      <div className="flex flex-wrap gap-2">
        {rows.map((row) => (
          <span
            key={row}
            className="rounded-md border px-2 py-0.5 text-sm text-muted-foreground"
          >
            {row}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-6 w-full overflow-hidden rounded-md">
        {segments.map((segment, i) => (
          <div
            key={segment.label}
            className={`${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} transition-all`}
            style={{ width: `${segment.pct}%` }}
            title={`${segment.label}: ${segment.pct}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {segments.map((segment, i) => (
          <div key={segment.label} className="flex items-center gap-1.5">
            <div
              className={`size-2.5 rounded-sm ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}`}
            />
            <span className="text-muted-foreground">
              {segment.label}{" "}
              <span className="font-medium text-foreground">{segment.pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
