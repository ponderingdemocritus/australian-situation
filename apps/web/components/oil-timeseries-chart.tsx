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
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { OilTimePoint } from "../lib/queries/oil-dashboard";

type Props = {
  data: OilTimePoint[];
  description: string;
  color: string;
  title: string;
};

export function OilTimeSeriesChart({ data, description, color, title }: Props) {
  const config = {
    valueKbd: {
      label: "kbd",
      color
    }
  } satisfies ChartConfig;

  const sorted = [...data].sort(
    (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()
  );

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-auto h-[250px] w-full">
          <AreaChart data={sorted}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="period"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value: string) => {
                const d = new Date(value);
                return d.toLocaleDateString("en-AU", { month: "short", year: "2-digit" });
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              width={50}
              tickFormatter={(v: number) => `${v}`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="valueKbd"
              type="monotone"
              fill={color}
              fillOpacity={0.15}
              stroke={color}
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
