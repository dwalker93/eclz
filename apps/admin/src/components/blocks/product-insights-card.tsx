"use client"

import { Bar, BarChart } from "recharts"

import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import {
  type ChartConfig,
  ChartContainer,
} from "@workspace/ui/components/chart"
import { Separator } from "@workspace/ui/components/separator"

// Product reached data
const productReachChartData = [
  { month: "January", reached: 168 },
  { month: "February", reached: 305 },
  { month: "March", reached: 213 },
  { month: "April", reached: 330 },
  { month: "May", reached: 305 },
]

const productReachChartConfig = {
  reached: {
    label: "Reached",
    color: "var(--primary)",
  },
} satisfies ChartConfig

// Order placed data
const orderPlacedChartData = [
  { month: "January", orders: 168 },
  { month: "February", orders: 305 },
  { month: "March", orders: 213 },
  { month: "April", orders: 330 },
  { month: "May", orders: 305 },
]

const orderPlacedChartConfig = {
  orders: {
    label: "Orders",
    color: "color-mix(in oklab, var(--primary) 10%, transparent)",
  },
} satisfies ChartConfig

type InsightStatProps = {
  label: string
  value: string
  data: Record<string, string | number>[]
  config: ChartConfig
  dataKey: string
  fill: string
}

const InsightStat = ({
  label,
  value,
  data,
  config,
  dataKey,
  fill,
}: InsightStatProps) => {
  return (
    <div className="flex items-center justify-between gap-1">
      <div className="flex flex-col gap-1">
        <span className="text-xs">{label}</span>
        <span className="text-2xl font-semibold">{value}</span>
      </div>
      <ChartContainer config={config} className="min-h-13 max-w-18">
        <BarChart accessibilityLayer data={data} barSize={8}>
          <Bar dataKey={dataKey} fill={fill} radius={2} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

const ProductInsightsCard = ({ className }: { className?: string }) => {
  return (
    <Card className={className}>
      <CardHeader className="flex justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold">Product insight</span>
          <span className="text-sm text-muted-foreground">
            Published on 12 MAY 2025 - 6:10 PM
          </span>
        </div>
        <img
          src="https://cdn.shadcnstudio.com/ss-assets/blocks/dashboard-application/widgets/image-7.png"
          alt="Product"
          className="w-20.5 rounded-md"
        />
      </CardHeader>
      <CardContent>
        <Separator />
      </CardContent>
      <CardContent className="space-y-4">
        <InsightStat
          label="Product reached"
          value="21,153"
          data={productReachChartData}
          config={productReachChartConfig}
          dataKey="reached"
          fill="var(--color-reached)"
        />

        <InsightStat
          label="Order placed "
          value="2,123"
          data={orderPlacedChartData}
          config={orderPlacedChartConfig}
          dataKey="orders"
          fill="var(--color-orders)"
        />
      </CardContent>
    </Card>
  )
}

export default ProductInsightsCard
