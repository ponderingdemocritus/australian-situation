"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@aus-dash/ui/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@aus-dash/ui/components/ui/chart";

const chartConfig = {
  lag: {
    label: "Lag minutes",
    color: "var(--primary)"
  }
} satisfies ChartConfig;

export function ChartAreaInteractive({
  data
}: {
  data: Array<{
    label: string;
    lag: number;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Freshness drift</CardTitle>
        <CardDescription>Most lagging tracked series from metadata freshness.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              dataKey="lag"
              type="natural"
              fill="var(--color-lag)"
              fillOpacity={0.15}
              stroke="var(--color-lag)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
