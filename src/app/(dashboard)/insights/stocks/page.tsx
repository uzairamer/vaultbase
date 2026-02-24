"use client"

import { useState, useCallback, useEffect } from "react"
import { useInsightsData, useStockHistories, fetchStockHistory, useLivePrices } from "@/modules/insights/hooks"
import type { StockHistory, HistoryPeriod } from "@/modules/insights/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { Plus, X, Loader2 } from "lucide-react"
import { WatchlistTab } from "@/modules/insights/components/watchlist-tab"
import { StockHeatmap } from "@/modules/insights/components/stock-heatmap"
import { SipSimulator } from "@/modules/insights/components/sip-simulator"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
} from "recharts"

const COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4",
  "#84cc16", "#a855f7", "#0ea5e9", "#f43f5e", "#10b981",
]

const KMI30_SYMBOLS = [
  "OGDC", "PPL", "MARI", "POL", "LUCK", "ENGRO", "FFC", "EFERT",
  "HBL", "MCB", "UBL", "MEBL", "BAHL", "NBP", "HUBC", "KEL",
  "ATRL", "PSO", "SHEL", "MTL", "SEARL", "AGP", "TRG", "SYS",
  "COLG", "NESTLE", "UNITY", "AVN", "MLCF", "SYST",
]

type ChartMode = "price" | "dod"

export default function StockInsightsPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { data, isLoading } = useInsightsData()

  const stocks = ((data as Record<string, unknown[]>)?.stocks || []) as Record<string, unknown>[]
  const portfolioSymbols = stocks.map((s) => s.symbol as string)

  const { data: livePrices } = useLivePrices(portfolioSymbols)
  const livePriceMap = new Map((livePrices ?? []).map((lp) => [lp.symbol, lp.price]))

  // Period state
  const [portfolioPeriod, setPortfolioPeriod] = useState<HistoryPeriod>("1y")
  const [kmiPeriod, setKmiPeriod] = useState<HistoryPeriod>("1y")

  // Portfolio historical data
  const { data: portfolioHistories, isLoading: portfolioHistLoading } = useStockHistories(portfolioSymbols, portfolioPeriod)

  // KMI30 historical data
  const { data: kmiHistories, isLoading: kmiHistLoading } = useStockHistories(KMI30_SYMBOLS, kmiPeriod)

  // State
  const [portfolioSelected, setPortfolioSelected] = useState<Set<string>>(new Set())
  const [kmiSelected, setKmiSelected] = useState<Set<string>>(new Set())
  const [portfolioMode, setPortfolioMode] = useState<ChartMode>("price")
  const [kmiMode, setKmiMode] = useState<ChartMode>("price")
  const [customSymbol, setCustomSymbol] = useState("")
  const [customHistories, setCustomHistories] = useState<StockHistory[]>([])
  const [customLoading, setCustomLoading] = useState(false)

  const addCustomStock = useCallback(async () => {
    const sym = customSymbol.trim().toUpperCase()
    if (!sym) return
    const allSymbols = [...KMI30_SYMBOLS, ...customHistories.map((h) => h.symbol)]
    if (allSymbols.includes(sym)) {
      setKmiSelected((prev) => new Set([...prev, sym]))
      setCustomSymbol("")
      return
    }
    setCustomLoading(true)
    const history = await fetchStockHistory(sym, kmiPeriod)
    setCustomLoading(false)
    if (history.data.length === 0) return
    setCustomHistories((prev) => [...prev, history])
    setKmiSelected((prev) => new Set([...prev, sym]))
    setCustomSymbol("")
  }, [customSymbol, customHistories])

  if (!mounted || isLoading) return <div className="p-6">Loading...</div>

  const hasStocks = stocks.length > 0

  const chartData = stocks.map((s) => {
    const qty = Number(s.quantity)
    const avg = Number(s.avgBuyPrice)
    const cur = livePriceMap.get(s.symbol as string) ?? Number(s.currentPrice ?? avg)
    const cost = qty * avg
    const value = qty * cur
    const pnl = value - cost
    return {
      name: s.symbol as string,
      value,
      cost,
      pnl,
      pnlPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
    }
  })

  const totalCost = chartData.reduce((sum, d) => sum + d.cost, 0)
  const totalValue = chartData.reduce((sum, d) => sum + d.value, 0)
  const totalPnl = totalValue - totalCost

  // Merge KMI + custom histories
  const allKmiHistories = [...(kmiHistories || []), ...customHistories]
  const allKmiSymbols = [...KMI30_SYMBOLS, ...customHistories.map((h) => h.symbol)]

  const portfolioActive = portfolioSelected.size > 0 ? portfolioSelected : new Set(portfolioSymbols)
  const kmiActive = kmiSelected

  return (
    <div>
      <PageHeader
        title="Stock Performance"
        description={hasStocks ? `Total P&L: ${formatCurrency(totalPnl)} (${formatPercent(totalCost > 0 ? (totalPnl / totalCost) * 100 : 0)})` : "Analyze your stock portfolio"}
      />

      <Tabs defaultValue={hasStocks ? "overview" : "watchlist"} className="space-y-6">
        <TabsList>
          {hasStocks && <TabsTrigger value="overview">Overview</TabsTrigger>}
          {hasStocks && <TabsTrigger value="historical">Historical Performance</TabsTrigger>}
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          <TabsTrigger value="sip">SIP</TabsTrigger>
        </TabsList>

        {hasStocks && <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Portfolio Value by Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profit / Loss by Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Holdings Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {chartData.map((s) => (
                  <div key={s.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-muted-foreground">Cost: {formatCurrency(s.cost)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(s.value)}</p>
                      <p className={`text-sm ${s.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatCurrency(s.pnl)} ({formatPercent(s.pnlPct)})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>}

        {hasStocks && <TabsContent value="historical" className="space-y-6">
          <Tabs defaultValue="portfolio">
            <TabsList>
              <TabsTrigger value="portfolio">My Portfolio</TabsTrigger>
              <TabsTrigger value="kmi30">KMI30 / Market</TabsTrigger>
            </TabsList>

            {/* ── MY PORTFOLIO ── */}
            <TabsContent value="portfolio" className="space-y-6 mt-6">
              {portfolioHistLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading historical data...</div>
              ) : (
                <HistoricalChart
                  allSymbols={portfolioSymbols}
                  activeStocks={portfolioActive}
                  histories={portfolioHistories || []}
                  mode={portfolioMode}
                  onModeChange={setPortfolioMode}
                  period={portfolioPeriod}
                  onPeriodChange={setPortfolioPeriod}
                  onToggle={(sym) => {
                    setPortfolioSelected((prev) => {
                      const next = new Set(prev)
                      if (next.has(sym)) next.delete(sym)
                      else next.add(sym)
                      return next
                    })
                  }}
                />
              )}
            </TabsContent>

            {/* ── KMI30 / MARKET ── */}
            <TabsContent value="kmi30" className="space-y-6 mt-6">
              {/* Add custom stock input */}
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Add stock symbol (e.g. LUCK)"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomStock() } }}
                  className="max-w-xs"
                />
                <Button size="sm" onClick={addCustomStock} disabled={customLoading || !customSymbol.trim()}>
                  {customLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  {customLoading ? "Fetching..." : "Add"}
                </Button>
              </div>

              {kmiHistLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading KMI30 data...</div>
              ) : (
                <HistoricalChart
                  allSymbols={allKmiSymbols}
                  activeStocks={kmiActive}
                  histories={allKmiHistories}
                  mode={kmiMode}
                  onModeChange={setKmiMode}
                  period={kmiPeriod}
                  onPeriodChange={setKmiPeriod}
                  onToggle={(sym) => {
                    setKmiSelected((prev) => {
                      const next = new Set(prev)
                      if (next.has(sym)) next.delete(sym)
                      else next.add(sym)
                      return next
                    })
                  }}
                  onRemoveCustom={(sym) => {
                    setCustomHistories((prev) => prev.filter((h) => h.symbol !== sym))
                    setKmiSelected((prev) => {
                      const next = new Set(prev)
                      next.delete(sym)
                      return next
                    })
                  }}
                  customSymbols={new Set(customHistories.map((h) => h.symbol))}
                />
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>}

        <TabsContent value="heatmap" className="space-y-6">
          <StockHeatmap />
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-6">
          <WatchlistTab />
        </TabsContent>

        <TabsContent value="sip" className="space-y-6">
          <SipSimulator />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ────────────────────────────────────────
// Shared chart component for both tabs
// ────────────────────────────────────────
const PERIOD_OPTIONS: { value: HistoryPeriod; label: string }[] = [
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "3y", label: "3Y" },
  { value: "5y", label: "5Y" },
  { value: "max", label: "Max" },
]

function HistoricalChart({
  allSymbols,
  activeStocks,
  histories,
  mode,
  onModeChange,
  period,
  onPeriodChange,
  onToggle,
  onRemoveCustom,
  customSymbols,
}: {
  allSymbols: string[]
  activeStocks: Set<string>
  histories: StockHistory[]
  mode: ChartMode
  onModeChange: (m: ChartMode) => void
  period: HistoryPeriod
  onPeriodChange: (p: HistoryPeriod) => void
  onToggle: (symbol: string) => void
  onRemoveCustom?: (symbol: string) => void
  customSymbols?: Set<string>
}) {
  const mergedData =
    mode === "price"
      ? buildMergedHistory(histories, activeStocks)
      : buildDodHistory(histories, activeStocks)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                {mode === "price" ? "Share Price" : "Day-over-Day % Change"}
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Period toggle */}
                <div className="inline-flex rounded-lg border p-0.5 text-xs">
                  {PERIOD_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => onPeriodChange(p.value)}
                      className={`rounded-md px-2.5 py-1 transition-colors ${
                        period === p.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {/* Mode toggle */}
                <div className="inline-flex rounded-lg border p-0.5 text-xs">
                  <button
                    onClick={() => onModeChange("price")}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      mode === "price" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Price
                  </button>
                  <button
                    onClick={() => onModeChange("dod")}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      mode === "dod" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    DoD %
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {allSymbols.map((symbol) => {
                const colorIdx = allSymbols.indexOf(symbol)
                const isActive = activeStocks.has(symbol)
                const isCustom = customSymbols?.has(symbol)
                return (
                  <button
                    key={symbol}
                    onClick={() => onToggle(symbol)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-transparent text-white"
                        : "border-border text-muted-foreground bg-background"
                    }`}
                    style={isActive ? { backgroundColor: COLORS[colorIdx % COLORS.length] } : undefined}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: COLORS[colorIdx % COLORS.length] }}
                    />
                    {symbol}
                    {isCustom && onRemoveCustom ? (
                      <X
                        className="h-3 w-3 ml-0.5 hover:text-white/80"
                        onClick={(e) => { e.stopPropagation(); onRemoveCustom(symbol) }}
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mergedData.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center text-muted-foreground">
              {activeStocks.size === 0 ? "Select stocks above to view chart" : "No historical data available"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={mergedData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  interval="preserveStartEnd"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                  tickFormatter={mode === "dod" ? (v: number) => `${v.toFixed(1)}%` : undefined}
                />
                {mode === "dod" ? <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" /> : null}
                <Tooltip
                  formatter={(value: number, name: string) => [
                    mode === "price"
                      ? `PKR ${value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`,
                    name,
                  ]}
                />
                <Legend />
                {allSymbols.map((symbol) =>
                  activeStocks.has(symbol) ? (
                    <Line
                      key={symbol}
                      type="monotone"
                      dataKey={symbol}
                      stroke={COLORS[allSymbols.indexOf(symbol) % COLORS.length]}
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {histories
          .filter((h) => activeStocks.has(h.symbol) && h.data.length > 0)
          .map((h) => {
            const first = h.data[0].close
            const last = h.data[h.data.length - 1].close
            const change = last - first
            const changePct = first > 0 ? (change / first) * 100 : 0
            const high = Math.max(...h.data.map((d) => d.close))
            const low = Math.min(...h.data.map((d) => d.close))
            return (
              <Card key={h.symbol}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[allSymbols.indexOf(h.symbol) % COLORS.length] }}
                    />
                    {h.symbol}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Current</p>
                      <p className="font-medium">PKR {last.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Change (1Y)</p>
                      <p className={`font-medium ${change >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {change >= 0 ? "+" : ""}{change.toFixed(2)} ({formatPercent(changePct)})
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">52W High</p>
                      <p className="font-medium">PKR {high.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">52W Low</p>
                      <p className="font-medium">PKR {low.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>
    </>
  )
}

// ────────────────────────────────────────
// Data builders
// ────────────────────────────────────────
function buildMergedHistory(
  histories: StockHistory[],
  activeStocks: Set<string>,
) {
  const dateMap = new Map<number, Record<string, unknown>>()

  for (const h of histories) {
    if (!activeStocks.has(h.symbol)) continue
    for (const point of h.data) {
      const existing = dateMap.get(point.timestamp) || { date: point.date, timestamp: point.timestamp }
      existing[h.symbol] = point.close
      dateMap.set(point.timestamp, existing)
    }
  }

  return Array.from(dateMap.values()).sort(
    (a, b) => (a.timestamp as number) - (b.timestamp as number),
  )
}

function buildDodHistory(
  histories: StockHistory[],
  activeStocks: Set<string>,
) {
  const dateMap = new Map<number, Record<string, unknown>>()

  for (const h of histories) {
    if (!activeStocks.has(h.symbol)) continue
    for (let i = 1; i < h.data.length; i++) {
      const prev = h.data[i - 1].close
      const cur = h.data[i].close
      const dodPct = prev > 0 ? ((cur - prev) / prev) * 100 : 0
      const point = h.data[i]
      const existing = dateMap.get(point.timestamp) || { date: point.date, timestamp: point.timestamp }
      existing[h.symbol] = Math.round(dodPct * 100) / 100
      dateMap.set(point.timestamp, existing)
    }
  }

  return Array.from(dateMap.values()).sort(
    (a, b) => (a.timestamp as number) - (b.timestamp as number),
  )
}
