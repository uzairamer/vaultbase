"use client"

import { useInsightsData } from "@/modules/insights/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { EmptyState } from "@/components/shared/empty-state"
import { Gem } from "lucide-react"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

const COLORS = ["#f59e0b", "#8b5cf6", "#06b6d4", "#10b981", "#ef4444", "#ec4899"]

export default function CommodityInsightsPage() {
  const { data, isLoading } = useInsightsData()

  if (isLoading) return <div className="p-6">Loading...</div>

  const commodities = ((data as Record<string, unknown[]>)?.commodities || []) as Record<string, unknown>[]

  if (commodities.length === 0) {
    return (
      <div>
        <PageHeader title="Commodity Trends" description="Analyze your commodity holdings" />
        <EmptyState icon={Gem} title="No commodities" description="Add commodity holdings to see trend analytics." />
      </div>
    )
  }

  const chartData = commodities.map((c) => {
    const qty = Number(c.quantity)
    const avg = Number(c.avgBuyPrice)
    const cur = Number(c.currentPrice ?? avg)
    const value = qty * cur
    return {
      name: `${(c.type as string).charAt(0).toUpperCase() + (c.type as string).slice(1)} (${c.unit})`,
      value,
      cost: qty * avg,
      pnl: value - qty * avg,
    }
  })

  return (
    <div>
      <PageHeader title="Commodity Trends" description="Portfolio breakdown and performance" />

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="cost" fill="#6b7280" name="Cost" radius={[4, 4, 0, 0]} />
                <Bar dataKey="value" fill="hsl(var(--primary))" name="Value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
