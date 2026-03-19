"use client"

import { useEffect, useState } from "react"
import { useInsightsData, useLivePrices } from "@/modules/insights/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatPercent, cn } from "@/lib/utils"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
  PieChart, Pie,
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

const PIE_COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#ec4899", "#84cc16",
  "#f97316", "#a78bfa", "#2dd4bf", "#fb7185", "#34d399",
  "#60a5fa", "#fbbf24", "#c084fc", "#4ade80", "#38bdf8",
]

function PieTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number; pct: number; pnl: number; pnlPct: number; color: string } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const isUp = d.pnl >= 0
  return (
    <div className="rounded-xl border border-white/10 bg-[#1e293b] shadow-2xl p-3.5 text-sm min-w-[180px] space-y-2">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
        <p className="font-bold text-white">{d.name}</p>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Value</span>
          <span className="font-semibold text-white tabular-nums">{formatCurrency(d.value)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Weight</span>
          <span className="font-semibold text-white tabular-nums">{d.pct.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-white/10 pt-1">
          <span className="text-slate-400">P&L</span>
          <span className={cn("font-semibold tabular-nums", isUp ? "text-emerald-400" : "text-red-400")}>
            {isUp ? "+" : ""}{formatCurrency(d.pnl)} ({isUp ? "+" : ""}{d.pnlPct.toFixed(1)}%)
          </span>
        </div>
      </div>
    </div>
  )
}

function HoldingsPieChart({ data, totalValue }: { data: { name: string; value: number; cost: number; pnl: number; pnlPct: number }[]; totalValue: number }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const pieData = [...data]
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((d, i) => ({
      ...d,
      color: PIE_COLORS[i % PIE_COLORS.length],
      pct: totalValue > 0 ? (d.value / totalValue) * 100 : 0,
    }))

  const active = activeIndex !== null ? pieData[activeIndex] : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Portfolio Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-8 items-center">

          {/* Donut */}
          <div className="relative shrink-0" style={{ width: 260, height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={78}
                  outerRadius={118}
                  dataKey="value"
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  onMouseEnter={(_, i) => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      opacity={activeIndex === null || activeIndex === i ? 1 : 0.25}
                      style={{ transition: "opacity 150ms", cursor: "pointer" }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              {active ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full mb-1.5" style={{ background: active.color }} />
                  <p className="text-xs font-semibold">{active.name}</p>
                  <p className="text-lg font-bold tabular-nums leading-tight">{active.pct.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{formatCurrency(active.value)}</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Portfolio</p>
                  <p className="text-lg font-bold tabular-nums leading-tight">{formatCurrency(totalValue)}</p>
                  <p className="text-[10px] text-muted-foreground">{pieData.length} holdings</p>
                </>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex-1 w-full min-w-0 space-y-0.5">
            {pieData.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-default transition-colors",
                  activeIndex === i ? "bg-muted" : "hover:bg-muted/40"
                )}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {/* Color swatch + bar */}
                <div className="flex flex-col gap-1 shrink-0">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                </div>

                <span className="font-semibold text-sm w-16 shrink-0">{d.name}</span>

                {/* Weight bar */}
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-0">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${d.pct}%`, background: d.color, opacity: 0.8 }}
                  />
                </div>

                <span className="text-xs tabular-nums text-muted-foreground w-10 text-right shrink-0">
                  {d.pct.toFixed(1)}%
                </span>
                <span className="text-xs tabular-nums font-medium w-24 text-right shrink-0">
                  {formatCurrency(d.value)}
                </span>
                <span className={cn(
                  "text-xs tabular-nums w-16 text-right shrink-0",
                  d.pnl >= 0 ? "text-emerald-500" : "text-red-500"
                )}>
                  {d.pnl >= 0 ? "+" : ""}{d.pnlPct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
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

      <HoldingsPieChart data={chartData} totalValue={totalValue} />

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
