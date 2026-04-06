import { Card, CardContent } from "@aus-dash/ui";
import { IconMinus, IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import type { ReactNode } from "react";

type ValueCardProps = {
  detail?: ReactNode;
  label: ReactNode;
  trend?: "up" | "down" | "stable";
  value: ReactNode;
};

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  switch (trend) {
    case "up":
      return <IconTrendingUp className="inline size-4 text-emerald-500" />;
    case "down":
      return <IconTrendingDown className="inline size-4 text-red-500" />;
    case "stable":
      return <IconMinus className="inline size-4 text-muted-foreground" />;
  }
}

export function ValueCard({ detail, label, trend, value }: ValueCardProps) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold text-foreground">
          {value}
          {trend ? (
            <span className="ml-1.5 align-middle">
              <TrendIcon trend={trend} />
            </span>
          ) : null}
        </div>
        {detail ? <div className="text-sm text-muted-foreground">{detail}</div> : null}
      </CardContent>
    </Card>
  );
}
