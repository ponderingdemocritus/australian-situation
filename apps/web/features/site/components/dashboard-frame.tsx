import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@aus-dash/ui";
import type { ReactNode } from "react";
import { dashboardNavItems } from "../content";

type DashboardFrameProps = {
  children: ReactNode;
  eyebrow: string;
  summary: string;
  title: string;
};

export function DashboardFrame({ children, eyebrow, summary, title }: DashboardFrameProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 md:px-10">
      <header className="grid gap-6 rounded-[2rem] border border-black/10 bg-white/90 p-8 shadow-[0_24px_80px_rgba(9,23,14,0.08)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              {eyebrow}
            </span>
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 md:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">{summary}</p>
            </div>
          </div>
          <nav aria-label="Dashboard sections" className="flex flex-wrap gap-2">
            {dashboardNavItems.map((item) => (
              <a
                key={item.href}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                href={item.href}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {children}

      <Card className="border-black/10 bg-[linear-gradient(135deg,rgba(248,250,252,0.96),rgba(236,253,245,0.96))]">
        <CardHeader>
          <CardTitle>Freshness and provenance</CardTitle>
          <CardDescription>
            Every dashboard page should end in source and methodology context, not unexplained metrics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-slate-600">
            The new frontend is organized around SDK-backed domains so data ownership stays explicit.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
