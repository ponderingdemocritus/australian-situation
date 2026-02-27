import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";

export function MetricCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
