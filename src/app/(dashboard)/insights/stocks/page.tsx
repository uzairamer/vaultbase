"use client"

import { useEffect, useState } from "react"
import { useInsightsData, useLivePrices } from "@/modules/insights/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatPercent } from "@/lib/utils"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts"

function BarChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Record<string, number> }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const isUp = d.pnl >= 0
  return (
    <div className="rounded-xl border bg-background shadow-xl p-4 text-sm min-w-[200px] space-y-3">
      <p className="font-bold text-base">{d.name}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "#6366f1" }} />
            <span className="text-muted-foreground">Invested</span>
          </div>
          <span className="font-semibold tabular-nums">{d.cost?.toLocaleString("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: isUp ? "#22c55e" : "#ef4444" }} />
            <span className="text-muted-foreground">P&L</span>
          </div>
          <span className={`font-semibold tabular-nums ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "+" : ""}{d.pnl?.toLocaleString("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="border-t pt-2 flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Return</span>
          <span className={`font-semibold tabular-nums ${isUp ? "text-green-500" : "text-red-500"}`}>
            {isUp ? "+" : ""}{d.pnlPct?.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  )
}

export default function StockOverviewPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { data, isLoading } = useInsightsData()
  const stocks = ((data as Record<string, unknown[]>)?.stocks || []) as Record<string, unknown>[]

  const aggregatedStocks = Object.values(
    stocks.reduce<Record<string, { symbol: string; quantity: number; totalCost: number; currentPrice: unknown }>>(
      (acc, s) => {
        const sym = s.symbol as string
        const buyQty = Number(s.quantity)
        const soldQty = ((s.trades as Record<string, unknown>[]) ?? [])
          .filter((t) => t.type === "sell")
          .reduce((sum, t) => sum + Number(t.quantity), 0)
        const netQty = Math.max(0, buyQty - soldQty)
        const avg = Number(s.avgBuyPrice)
        if (!acc[sym]) acc[sym] = { symbol: sym, quantity: 0, totalCost: 0, currentPrice: s.currentPrice }
        acc[sym].quantity += netQty
        acc[sym].totalCost += netQty * avg
        return acc
      },
      {}
    )
  ).filter((entry) => entry.quantity > 0)
  .map((entry) => ({
    symbol: entry.symbol,
    quantity: entry.quantity,
    avgBuyPrice: entry.quantity > 0 ? entry.totalCost / entry.quantity : 0,
    currentPrice: entry.currentPrice,
  }))

  const portfolioSymbols = aggregatedStocks.map((s) => s.symbol)
  const { data: livePrices } = useLivePrices(portfolioSymbols)
  const livePriceMap = new Map((livePrices ?? []).map((lp) => [lp.symbol, lp.price]))

  const chartData = aggregatedStocks.map((s) => {
    const qty = s.quantity
    const avg = s.avgBuyPrice
    const cur = livePriceMap.get(s.symbol) ?? Number(s.currentPrice ?? avg)
    const cost = qty * avg
    const value = qty * cur
    const pnl = value - cost
    return {
      name: s.symbol,
      quantity: qty,
      avgBuyPrice: avg,
      value,
      cost,
      pnl,
      pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
    }
  })

  const totalCost = chartData.reduce((sum, d) => sum + d.cost, 0)
  const totalValue = chartData.reduce((sum, d) => sum + d.value, 0)
  const totalPnl = totalValue - totalCost

  if (!mounted || isLoading) return <div className="p-6">Loading...</div>

  if (aggregatedStocks.length === 0) {
    return (
      <div>
        <PageHeader title="Overview" description="No stock holdings found." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description={`Total P&L: ${formatCurrency(totalPnl)} (${formatPercent(totalCost > 0 ? (totalPnl / totalCost) * 100 : 0)})`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invested vs P&L by Stock</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v: number) => formatCurrency(v)} width={100} />
              <Tooltip content={<BarChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
              <Legend />
              <Bar dataKey="cost" name="Invested" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pnl" name="P&L" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holdings Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/30 divide-y sm:divide-y-0 sm:divide-x sm:grid sm:grid-cols-3">
            <div className="flex items-center justify-between sm:block px-4 py-3 sm:text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Invested</p>
              <p className="text-sm font-bold tabular-nums sm:mt-1">{formatCurrency(totalCost)}</p>
            </div>
            <div className="flex items-center justify-between sm:block px-4 py-3 sm:text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total P&L</p>
              <div className="flex items-baseline gap-2 sm:block">
                <p className={`text-sm font-bold tabular-nums sm:mt-1 ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
                </p>
                <p className={`text-[10px] tabular-nums ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatPercent(totalCost > 0 ? (totalPnl / totalCost) * 100 : 0)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between sm:block px-4 py-3 sm:text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current Value</p>
              <p className="text-sm font-bold tabular-nums sm:mt-1">{formatCurrency(totalValue)}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {chartData.map((s) => {
              const isUp = s.pnl >= 0
              const barPct = Math.min(Math.abs(s.pnlPct), 100)
              const costSharePct = totalCost > 0 ? (s.cost / totalCost) * 100 : 0
              const valueSharePct = totalValue > 0 ? (s.value / totalValue) * 100 : 0
              return (
                <div key={s.name} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-base">{s.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                        {s.quantity.toFixed(2)} shares &middot; avg {formatCurrency(s.avgBuyPrice)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-semibold tabular-nums text-sm ${isUp ? "text-green-500" : "text-red-500"}`}>
                        {isUp ? "+" : ""}{formatCurrency(s.pnl)}
                      </p>
                      <p className={`text-xs tabular-nums ${isUp ? "text-green-500" : "text-red-500"}`}>
                        {formatPercent(s.pnlPct)}
                      </p>
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isUp ? "bg-green-500" : "bg-red-500"}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <div className="space-y-1 sm:grid sm:grid-cols-3 sm:gap-1 sm:space-y-0 text-center">
                    <div className="rounded-lg bg-muted/50 px-2 py-1.5 flex items-center justify-between sm:block">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Invested</p>
                      <div className="text-right sm:text-center sm:mt-0.5">
                        <p className="text-xs font-medium tabular-nums">{formatCurrency(s.cost)}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">{costSharePct.toFixed(1)}% of total</p>
                      </div>
                    </div>
                    <div className={`rounded-lg px-2 py-1.5 flex items-center justify-between sm:block ${isUp ? "bg-green-500/10" : "bg-red-500/10"}`}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">P&L</p>
                      <div className="text-right sm:text-center sm:mt-0.5">
                        <p className={`text-xs font-medium tabular-nums ${isUp ? "text-green-500" : "text-red-500"}`}>
                          {isUp ? "+" : ""}{formatCurrency(s.pnl)}
                        </p>
                        <p className={`text-[10px] tabular-nums ${isUp ? "text-green-500" : "text-red-500"}`}>
                          {formatPercent(s.pnlPct)}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2 py-1.5 flex items-center justify-between sm:block">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Value</p>
                      <div className="text-right sm:text-center sm:mt-0.5">
                        <p className="text-xs font-medium tabular-nums">{formatCurrency(s.value)}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">{valueSharePct.toFixed(1)}% of total</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
