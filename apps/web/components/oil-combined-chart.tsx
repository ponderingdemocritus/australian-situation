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
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { OilTimePoint } from "../lib/queries/oil-dashboard";

type Props = {
  consumption: OilTimePoint[];
  exports: OilTimePoint[];
  imports: OilTimePoint[];
  production: OilTimePoint[];
};

const COLORS = {
  production: "#2563eb",
  imports: "#e11d48",
  exports: "#f59e0b",
  consumption: "#8b5cf6"
} as const;

const chartConfig = {
  production: { label: "Production", color: COLORS.production },
  imports: { label: "Imports", color: COLORS.imports },
  exports: { label: "Exports", color: COLORS.exports },
  consumption: { label: "Consumption", color: COLORS.consumption }
} satisfies ChartConfig;

type CombinedPoint = {
  period: string;
  production?: number;
  imports?: number;
  exports?: number;
  consumption?: number;
};

function mergeTimeSeries(props: Props): CombinedPoint[] {
  const map = new Map<string, CombinedPoint>();

  const addSeries = (points: OilTimePoint[], key: keyof Omit<CombinedPoint, "period">) => {
    for (const p of points) {
      const existing = map.get(p.period) ?? { period: p.period };
      existing[key] = p.valueKbd;
      map.set(p.period, existing);
    }
  };

  addSeries(props.production, "production");
  addSeries(props.imports, "imports");
  addSeries(props.exports, "exports");
  addSeries(props.consumption, "consumption");

  return [...map.values()].sort(
    (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime()
  );
}

export function OilCombinedChart(props: Props) {
  const data = mergeTimeSeries(props);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Oil balance overview</CardTitle>
          <CardDescription>All series over time (kbd)</CardDescription>
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
        <CardTitle>Oil balance overview</CardTitle>
        <CardDescription>
          Production, imports, exports, and consumption over time (thousand barrels/day)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
          <LineChart data={data}>
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
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="production"
              type="monotone"
              stroke={COLORS.production}
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="imports"
              type="monotone"
              stroke={COLORS.imports}
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="exports"
              type="monotone"
              stroke={COLORS.exports}
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="consumption"
              type="monotone"
              stroke={COLORS.consumption}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
