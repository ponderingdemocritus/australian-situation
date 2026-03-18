import { Card, CardContent } from "@aus-dash/ui";
import type { ReactNode } from "react";

type ValueCardProps = {
  detail?: ReactNode;
  label: ReactNode;
  value: ReactNode;
};

export function ValueCard({ detail, label, value }: ValueCardProps) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        {detail ? <div className="text-sm text-muted-foreground">{detail}</div> : null}
      </CardContent>
    </Card>
  );
}
