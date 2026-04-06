"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type StaleSeriesListProps = {
  children: ReactNode[];
  threshold?: number;
};

export function StaleSeriesList({
  children,
  threshold = 3,
}: StaleSeriesListProps) {
  const [expanded, setExpanded] = useState(false);

  if (children.length <= threshold + 1) {
    return <>{children}</>;
  }

  const visible = expanded ? children : children.slice(0, threshold);

  return (
    <>
      {visible}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-md border border-dashed py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          Show all ({children.length - threshold} more)
        </button>
      )}
    </>
  );
}
