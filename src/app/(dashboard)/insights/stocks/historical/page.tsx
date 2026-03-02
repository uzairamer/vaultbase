"use client"

import { useState, useCallback, useEffect } from "react"
import { useInsightsData, useStockHistories, fetchStockHistory } from "@/modules/insights/hooks"
import type { StockHistory, HistoryPeriod } from "@/modules/insights/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatPercent } from "@/lib/utils"
import { Plus, X, Loader2 } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

type ChartMode = "price" | "dod" | "normalized"

const PERIOD_OPTIONS: { value: HistoryPeriod; label: string }[] = [
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "3y", label: "3Y" },
  { value: "5y", label: "5Y" },
  { value: "max", label: "Max" },
]

function buildMergedHistory(histories: StockHistory[], activeStocks: Set<string>) {
  const dateMap = new Map<number, Record<string, unknown>>()
  for (const h of histories) {
    if (!activeStocks.has(h.symbol)) continue
    for (const point of h.data) {
      const existing = dateMap.get(point.timestamp) || { date: point.date, timestamp: point.timestamp }
      existing[h.symbol] = point.close
      dateMap.set(point.timestamp, existing)
    }
  }
  return Array.from(dateMap.values()).sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
}

function buildNormalizedHistory(histories: StockHistory[], activeStocks: Set<string>) {
  const dateMap = new Map<number, Record<string, unknown>>()
  for (const h of histories) {
    if (!activeStocks.has(h.symbol)) continue
    if (h.data.length === 0) continue
    const latestPrice = h.data[h.data.length - 1].close
    if (latestPrice === 0) continue
    for (const point of h.data) {
      const normalized = Math.round((point.close / latestPrice) * 10000) / 100
      const existing = dateMap.get(point.timestamp) || { date: point.date, timestamp: point.timestamp }
      existing[h.symbol] = normalized
      dateMap.set(point.timestamp, existing)
    }
  }
  return Array.from(dateMap.values()).sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
}

function buildDodHistory(histories: StockHistory[], activeStocks: Set<string>) {
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
  return Array.from(dateMap.values()).sort((a, b) => (a.timestamp as number) - (b.timestamp as number))
}

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
      : mode === "normalized"
      ? buildNormalizedHistory(histories, activeStocks)
      : buildDodHistory(histories, activeStocks)

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                {mode === "price" ? "Share Price" : mode === "normalized" ? "Normalised (% of Latest Price)" : "Day-over-Day % Change"}
              </CardTitle>
              <div className="flex items-center gap-2">
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
                    onClick={() => onModeChange("normalized")}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      mode === "normalized" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Normalise
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
                <XAxis dataKey="date" className="text-xs" interval="preserveStartEnd" tick={{ fontSize: 11 }} />
                <YAxis
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                  tickFormatter={mode === "price" ? undefined : (v: number) => `${v.toFixed(mode === "normalized" ? 0 : 1)}%`}
                />
                {mode === "dod" && <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />}
                {mode === "normalized" && <ReferenceLine y={100} stroke="#888" strokeDasharray="3 3" />}
                <Tooltip
                  formatter={(value: number, name: string) => [
                    mode === "price"
                      ? `PKR ${value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : mode === "normalized"
                      ? `${value.toFixed(1)}% of latest`
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
                      <p className="text-muted-foreground">Change</p>
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

export default function StockHistoricalPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { data, isLoading } = useInsightsData()
  const stocks = ((data as Record<string, unknown[]>)?.stocks || []) as Record<string, unknown>[]

  const aggregatedStocks = Object.values(
    stocks.reduce<Record<string, { symbol: string; quantity: number; totalCost: number; currentPrice: unknown }>>(
      (acc, s) => {
        const sym = s.symbol as string
        const qty = Number(s.quantity)
        const avg = Number(s.avgBuyPrice)
        if (!acc[sym]) acc[sym] = { symbol: sym, quantity: 0, totalCost: 0, currentPrice: s.currentPrice }
        acc[sym].quantity += qty
        acc[sym].totalCost += qty * avg
        return acc
      },
      {}
    )
  ).map((entry) => ({ symbol: entry.symbol }))

  const portfolioSymbols = aggregatedStocks.map((s) => s.symbol)

  const [portfolioPeriod, setPortfolioPeriod] = useState<HistoryPeriod>("1y")
  const [kmiPeriod, setKmiPeriod] = useState<HistoryPeriod>("1y")

  const { data: portfolioHistories, isLoading: portfolioHistLoading } = useStockHistories(portfolioSymbols, portfolioPeriod)
  const { data: kmiHistories, isLoading: kmiHistLoading } = useStockHistories(KMI30_SYMBOLS, kmiPeriod)

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
  }, [customSymbol, customHistories, kmiPeriod])

  if (!mounted || isLoading) return <div className="p-6">Loading...</div>

  const allKmiHistories = [...(kmiHistories || []), ...customHistories]
  const allKmiSymbols = [...KMI30_SYMBOLS, ...customHistories.map((h) => h.symbol)]

  const portfolioActive = portfolioSelected.size > 0 ? portfolioSelected : new Set(portfolioSymbols)

  return (
    <div className="space-y-6">
      <PageHeader title="Historical Performance" description="Compare price history across your portfolio and the market" />

      <Tabs defaultValue={portfolioSymbols.length > 0 ? "portfolio" : "kmi30"} className="space-y-6">
        <TabsList>
          {portfolioSymbols.length > 0 && <TabsTrigger value="portfolio">My Portfolio</TabsTrigger>}
          <TabsTrigger value="kmi30">KMI30 / Market</TabsTrigger>
        </TabsList>

        {portfolioSymbols.length > 0 && (
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
        )}

        <TabsContent value="kmi30" className="space-y-6 mt-6">
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
              activeStocks={kmiSelected}
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
    </div>
  )
}
