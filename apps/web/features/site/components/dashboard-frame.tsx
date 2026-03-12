import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import type { ReactNode } from "react";

type DashboardFrameProps = {
  children: ReactNode;
  eyebrow: string;
  summary: string;
  title: string;
};

export function DashboardFrame({ children, eyebrow, summary, title }: DashboardFrameProps) {
  return (
    <section className="grid gap-6 px-4 lg:px-6">
      <header className="grid gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{summary}</p>
      </header>

      {children}

      <Card>
        <CardHeader>
          <CardTitle>Freshness and provenance</CardTitle>
          <CardDescription>
            Every dashboard page should end in source and methodology context, not unexplained metrics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            The new frontend is organized around SDK-backed domains so data ownership stays explicit.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
