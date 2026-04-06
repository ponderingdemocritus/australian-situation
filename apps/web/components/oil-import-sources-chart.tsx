"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@aus-dash/ui";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { OilImportSourceItem } from "../lib/queries/oil-dashboard";

type Props = {
  sources: OilImportSourceItem[];
  period: string | null;
  totalUsd: number | null;
};

const chartConfig = {
  sharePct: { label: "Share %", color: "#e11d48" }
} satisfies ChartConfig;

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function OilImportSourcesChart({ sources, period, totalUsd }: Props) {
  if (sources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Import sources by country</CardTitle>
          <CardDescription>Top crude oil suppliers to Australia</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No import source data available. Run the UN Comtrade sync job to populate.
          </p>
        </CardContent>
      </Card>
    );
  }

  const top12 = sources.slice(0, 12);
  const description = [
    period ? `Period: ${period}` : null,
    totalUsd ? `Total: ${formatUsd(totalUsd)}` : null
  ]
    .filter(Boolean)
    .join(" · ") || "Top crude oil suppliers to Australia";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import sources by country</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[350px] w-full">
          <BarChart data={top12} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            />
            <YAxis
              type="category"
              dataKey="countryName"
              tickLine={false}
              axisLine={false}
              width={100}
              tickMargin={4}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                />
              }
            />
            <Bar
              dataKey="sharePct"
              fill="#e11d48"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
