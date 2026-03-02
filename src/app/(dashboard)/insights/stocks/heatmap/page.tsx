"use client"

import { StockHeatmap } from "@/modules/insights/components/stock-heatmap"
import { PageHeader } from "@/components/shared/page-header"

export default function StockHeatmapPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Heatmap" description="Visual snapshot of market performance" />
      <StockHeatmap />
    </div>
  )
}
