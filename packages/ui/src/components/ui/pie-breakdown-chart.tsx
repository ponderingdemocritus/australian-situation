"use client"

import { Cell, Label, Pie, PieChart as RechartsPieChart } from "recharts"

import { cn } from "../../lib/utils"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./chart"

export type PieBreakdownDatum = {
  key: string
  label: string
  value: number
  color: string
}

type PieBreakdownChartProps = {
  ariaLabel: string
  data: PieBreakdownDatum[]
  centerLabel?: string
  className?: string
  chartClassName?: string
  hideLegend?: boolean
  legendClassName?: string
  legendItemClassName?: string
  legendLabelClassName?: string
  legendValueClassName?: string
}

export function PieBreakdownChart({
  ariaLabel,
  data,
  centerLabel = "share",
  className,
  chartClassName,
  hideLegend = false,
  legendClassName,
  legendItemClassName,
  legendLabelClassName,
  legendValueClassName,
}: PieBreakdownChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const chartConfig = data.reduce<ChartConfig>((config, item) => {
    config[item.key] = {
      label: item.label,
      color: item.color,
    }
    return config
  }, {})

  return (
    <div
      className={cn(
        "grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-center",
        className
      )}
    >
      <ChartContainer
        aria-label={ariaLabel}
        config={chartConfig}
        className={cn("mx-auto aspect-square h-[220px] w-full max-w-[220px]", chartClassName)}
      >
        <RechartsPieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie data={data} dataKey="value" nameKey="key" innerRadius={56} outerRadius={82} strokeWidth={2}>
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                  return null
                }

                const cx = typeof viewBox.cx === "number" ? viewBox.cx : 0
                const cy = typeof viewBox.cy === "number" ? viewBox.cy : 0

                return (
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan
                      x={cx}
                      y={cy}
                      className="fill-foreground text-[18px] font-semibold"
                    >
                      {Math.round(total)}%
                    </tspan>
                    <tspan
                      x={cx}
                      y={cy + 18}
                      className="fill-muted-foreground text-[10px] uppercase tracking-[0.24em]"
                    >
                      {centerLabel}
                    </tspan>
                  </text>
                )
              }}
            />
            {data.map((item) => (
              <Cell key={item.key} fill={item.color} />
            ))}
          </Pie>
        </RechartsPieChart>
      </ChartContainer>

      {hideLegend ? null : (
        <div className={cn("grid gap-2", legendClassName)}>
          {data.map((item) => (
            <div
              key={item.key}
              className={cn(
                "flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2",
                legendItemClassName
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className={cn("text-sm text-foreground", legendLabelClassName)}>{item.label}</span>
              </div>
              <span className={cn("font-mono text-sm text-muted-foreground", legendValueClassName)}>
                {Math.round(item.value)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
