"use client"

import { useState, useMemo, use } from "react"
import { useLedger, useInventory, useBusinesses } from "@/modules/businesses/hooks"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/page-header"
import { cn, formatCurrency, formatCompact, formatPercent } from "@/lib/utils"
import { BusinessSummaryCard } from "@/components/shared/business-summary-card"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts"
import {
  format,
  subDays,
  subMonths,
  startOfMonth,
  startOfYear,
  parseISO,
  isWithinInterval,
} from "date-fns"
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, AlertTriangle } from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string
  type: "income" | "expense"
  category: string
  amount: string | number
  date: string
  linkedInventoryId?: string | null
  quantitySold?: number | null
  linkedInventory?: { id: string; name: string } | null
}

interface InventoryItem {
  id: string
  name: string
  quantity: number
  lowStockThreshold: number
  purchasePrice: string | number
  sellingPrice?: string | number | null
}

interface Business {
  id: string
  name: string
}

// ── Date presets ───────────────────────────────────────────────────────────────

type Preset = "7d" | "30d" | "3m" | "6m" | "ytd" | "all"

const PRESETS: { key: Preset; label: string }[] = [
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "3m", label: "Last 3 Months" },
  { key: "6m", label: "Last 6 Months" },
  { key: "ytd", label: "Year to Date" },
  { key: "all", label: "All Time" },
]

function getDateRange(preset: Preset): { from: Date | null; to: Date } {
  const today = new Date()
  if (preset === "7d") return { from: subDays(today, 6), to: today }
  if (preset === "30d") return { from: subDays(today, 29), to: today }
  if (preset === "3m") return { from: subMonths(today, 3), to: today }
  if (preset === "6m") return { from: subMonths(today, 6), to: today }
  if (preset === "ytd") return { from: startOfYear(today), to: today }
  return { from: null, to: today }
}

// ── Chart colours ──────────────────────────────────────────────────────────────

const PIE_COLORS = ["#6366f1", "#ef4444", "#f59e0b", "#22c55e", "#8b5cf6", "#06b6d4", "#ec4899", "#10b981", "#f97316"]

// ── Helpers ────────────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = typeof v === "string" ? parseFloat(v) : v
  return isNaN(n) ? 0 : n
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BusinessInsightsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params)

  const [preset, setPreset] = useState<Preset>("3m")

  const { data: rawBusinesses = [] } = useBusinesses()
  const businesses = rawBusinesses as Business[]
  const business = businesses.find((b) => b.id === businessId)

  // Fetch all ledger entries (no server-side date filter — we filter client-side)
  const { data: rawLedger = [], isLoading: ledgerLoading } = useLedger(businessId)
  const { data: rawInventory = [] } = useInventory(businessId)

  const allEntries = rawLedger as LedgerEntry[]
  const inventory = rawInventory as InventoryItem[]

  // ── Filter entries by date range ───────────────────────────────────────────
  const { from, to } = getDateRange(preset)

  const entries = useMemo(() => {
    if (!from) return allEntries
    return allEntries.filter((e) => {
      const d = parseISO(e.date)
      return isWithinInterval(d, { start: from, end: to })
    })
  }, [allEntries, from, to])

  // ── Core metrics ───────────────────────────────────────────────────────────
  const { totalRevenue, totalExpenses, cogs } = useMemo(() => {
    let revenue = 0
    let expenses = 0
    let costOfGoods = 0
    for (const e of entries) {
      const amt = toNum(e.amount)
      if (e.type === "income") {
        revenue += amt
      } else {
        expenses += amt
        if (e.category === "Cost of Goods" || e.category === "COGS") {
          costOfGoods += amt
        }
      }
    }
    return { totalRevenue: revenue, totalExpenses: expenses, cogs: costOfGoods }
  }, [entries])

  const netProfit = totalRevenue - totalExpenses
  const grossMargin =
    totalRevenue > 0
      ? cogs > 0
        ? ((totalRevenue - cogs) / totalRevenue) * 100
        : (netProfit / totalRevenue) * 100
      : 0

  // ── Revenue vs Expenses chart data ─────────────────────────────────────────
  const chartData = useMemo(() => {
    if (entries.length === 0) return []

    const isShortRange = preset === "7d" || preset === "30d"

    if (isShortRange) {
      // Group by week (7-day windows)
      const buckets = new Map<string, { revenue: number; expenses: number }>()
      for (const e of entries) {
        const d = parseISO(e.date)
        // bucket key = start of the week containing this date (Sun offset)
        const dayOfWeek = d.getDay()
        const weekStart = subDays(d, dayOfWeek)
        const key = format(weekStart, "MMM d")
        const existing = buckets.get(key) ?? { revenue: 0, expenses: 0 }
        const amt = toNum(e.amount)
        if (e.type === "income") existing.revenue += amt
        else existing.expenses += amt
        buckets.set(key, existing)
      }
      return Array.from(buckets.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, v]) => ({ label, ...v }))
    }

    // Group by month
    const buckets = new Map<string, { revenue: number; expenses: number }>()
    for (const e of entries) {
      const key = format(parseISO(e.date), "MMM yy")
      const existing = buckets.get(key) ?? { revenue: 0, expenses: 0 }
      const amt = toNum(e.amount)
      if (e.type === "income") existing.revenue += amt
      else existing.expenses += amt
      buckets.set(key, existing)
    }
    // Sort by date (parse "MMM yy" back)
    const sorted = Array.from(buckets.entries()).sort((a, b) => {
      const da = new Date(`01 ${a[0]}`)
      const db = new Date(`01 ${b[0]}`)
      return da.getTime() - db.getTime()
    })
    return sorted.map(([label, v]) => ({ label, ...v }))
  }, [entries, preset])

  // ── Expense breakdown (for pie chart) ──────────────────────────────────────
  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      if (e.type === "expense") {
        map.set(e.category, (map.get(e.category) ?? 0) + toNum(e.amount))
      }
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [entries])

  // ── Top products by revenue (from linked inventory sales) ──────────────────
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; unitsSold: number }>()
    for (const e of entries) {
      if (e.type === "income" && e.linkedInventoryId && e.linkedInventory) {
        const id = e.linkedInventoryId
        const existing = map.get(id) ?? { name: e.linkedInventory.name, revenue: 0, unitsSold: 0 }
        existing.revenue += toNum(e.amount)
        existing.unitsSold += e.quantitySold ?? 0
        map.set(id, existing)
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [entries])

  // ── Inventory snapshot ─────────────────────────────────────────────────────
  const { inventoryValue, productsInStock, lowStockAlerts } = useMemo(() => {
    let value = 0
    let inStock = 0
    let lowStock = 0
    for (const item of inventory) {
      const price = toNum(item.purchasePrice)
      value += item.quantity * price
      if (item.quantity > 0) inStock++
      if (item.quantity <= item.lowStockThreshold) lowStock++
    }
    return { inventoryValue: value, productsInStock: inStock, lowStockAlerts: lowStock }
  }, [inventory])

  // ── Custom tooltip for pie ─────────────────────────────────────────────────
  function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
        <p className="font-medium">{payload[0].name}</p>
        <p className="text-muted-foreground">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (ledgerLoading) {
    return (
      <div>
        <PageHeader title="Insights" description={business?.name} />
        <div className="py-10 text-center text-sm text-muted-foreground">Loading insights...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <PageHeader
        title="Insights"
        description={business ? `Business analytics for ${business.name}` : "Business analytics"}
      />

      {/* ── 1. Date range presets ────────────────────────────────────────────── */}
      <div className="flex overflow-x-auto gap-2 pb-2 -mx-6 px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0 mb-6">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={cn(
              "shrink-0 h-8 px-3 text-xs rounded-full border transition-colors",
              preset === p.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── 2. Status banner ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden border ring-1 p-5 mb-6 -mx-6 px-6 rounded-none sm:rounded-xl sm:mx-0 sm:px-5",
          netProfit >= 0
            ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/5 border-emerald-500/30 ring-emerald-500/30"
            : "bg-gradient-to-br from-red-500/20 to-rose-500/5 border-red-500/30 ring-red-500/30"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {netProfit >= 0 ? (
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-400" />
              )}
              <p className="text-sm font-bold">
                {business?.name ?? "This business"}
              </p>
            </div>
            <p className={cn("text-4xl font-bold tabular-nums", netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
              {formatCompact(Math.abs(netProfit))}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {netProfit >= 0 ? "Profit · " : "Loss · "}
              {formatCurrency(Math.abs(netProfit))}
            </p>
          </div>
          {totalRevenue > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
                Margin
              </p>
              <p className={cn("text-2xl font-bold tabular-nums", netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                {formatPercent(grossMargin)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Metric cards: mobile=unified card, desktop=grid ───────────────── */}
      <BusinessSummaryCard
        rows={[
          { label: "Revenue",  value: totalRevenue,  color: "emerald" },
          { label: "Expenses", value: totalExpenses, color: "red" },
          { label: cogs > 0 ? "Gross Margin" : "Profit Margin", value: grossMargin, color: "muted", isPercent: true },
        ]}
        net={netProfit}
      />

      {/* Desktop metric grid */}
      <div className="hidden sm:grid gap-2 sm:gap-3 sm:grid-cols-4 mb-6">
        {/* Revenue */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-500/20 to-teal-500/5 ring-1 ring-emerald-500/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-emerald-500/15 p-1.5">
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Revenue</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-emerald-400">{formatCompact(totalRevenue)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{formatCurrency(totalRevenue)}</p>
        </div>

        {/* Expenses */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-red-500/20 to-rose-500/5 ring-1 ring-red-500/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-red-500/15 p-1.5">
              <ShoppingCart className="h-4 w-4 text-red-400" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Expenses</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-red-400">{formatCompact(totalExpenses)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{formatCurrency(totalExpenses)}</p>
        </div>

        {/* Net Profit */}
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border ring-1 p-4",
            netProfit >= 0
              ? "bg-gradient-to-br from-indigo-500/20 to-violet-500/5 ring-indigo-500/30"
              : "bg-gradient-to-br from-red-500/20 to-rose-500/5 ring-red-500/30"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("rounded-lg p-1.5", netProfit >= 0 ? "bg-indigo-500/15" : "bg-red-500/15")}>
              {netProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-indigo-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
            </div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Net {netProfit >= 0 ? "Profit" : "Loss"}
            </p>
          </div>
          <p className={cn("text-xl font-bold tabular-nums", netProfit >= 0 ? "text-indigo-400" : "text-red-400")}>
            {formatCompact(Math.abs(netProfit))}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{formatCurrency(netProfit)}</p>
        </div>

        {/* Gross Margin */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-sky-500/20 to-blue-500/5 ring-1 ring-sky-500/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-sky-500/15 p-1.5">
              <TrendingUp className="h-4 w-4 text-sky-400" />
            </div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {cogs > 0 ? "Gross Margin" : "Profit Margin"}
            </p>
          </div>
          <p className="text-xl font-bold tabular-nums text-sky-400">
            {totalRevenue > 0 ? `${grossMargin.toFixed(1)}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totalRevenue > 0 ? formatPercent(grossMargin) : "No revenue yet"}
          </p>
        </div>
      </div>{/* end desktop metric grid */}

      {/* ── 4. Revenue vs Expenses line chart ────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base font-semibold mb-0">Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <DollarSign className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No data for this period</p>
            </div>
          ) : (
            <div className="h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCompact(v)}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    name="Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="Expenses"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 5. Two-column charts ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-6">
        {/* Left: Expense Breakdown donut */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold mb-0">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ShoppingCart className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">No expenses for this period</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                    >
                      {expenseBreakdown.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-col gap-1.5 mt-2">
                  {expenseBreakdown.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium tabular-nums">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Top Products BarChart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold mb-0">Top Products by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">No sales linked to inventory yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                  Link inventory products to Sales Revenue entries in the Ledger.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCompact(v)}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="revenue" fill="#22c55e" radius={[0, 4, 4, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 6. Inventory snapshot ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Total Inventory Value */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-indigo-500/20 to-violet-500/5 ring-1 ring-indigo-500/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-indigo-500/15 p-1.5">
              <Package className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inventory Value</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-indigo-400">{formatCompact(inventoryValue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(inventoryValue)}</p>
        </div>

        {/* Products in Stock */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-500/20 to-teal-500/5 ring-1 ring-emerald-500/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-emerald-500/15 p-1.5">
              <Package className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">In Stock</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-400">{productsInStock}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            of {inventory.length} product{inventory.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Low Stock Alerts */}
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border ring-1 p-4",
            lowStockAlerts > 0
              ? "bg-gradient-to-br from-red-500/20 to-rose-500/5 ring-red-500/30"
              : "bg-gradient-to-br from-muted/40 to-muted/10 ring-border"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("rounded-lg p-1.5", lowStockAlerts > 0 ? "bg-red-500/15" : "bg-muted")}>
              <AlertTriangle className={cn("h-4 w-4", lowStockAlerts > 0 ? "text-red-400" : "text-muted-foreground")} />
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Low Stock</p>
          </div>
          <p className={cn("text-2xl font-bold tabular-nums", lowStockAlerts > 0 ? "text-red-400" : "text-foreground")}>
            {lowStockAlerts}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lowStockAlerts === 0 ? "All stocked up" : `item${lowStockAlerts > 1 ? "s" : ""} need restocking`}
          </p>
        </div>
      </div>
    </div>
  )
}
