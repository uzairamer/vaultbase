"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, TrendingUp, TrendingDown, Search } from "lucide-react"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { fetchStockHistory } from "../hooks"
import type { StockHistoryPoint } from "../hooks"

type Tenure = "daily" | "weekly" | "monthly"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekKey(ts: number): string {
  const date = new Date(ts * 1000)
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const week = Math.floor((date.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return `${date.getFullYear()}-${week}`
}

function getMonthKey(ts: number): string {
  const date = new Date(ts * 1000)
  return `${date.getFullYear()}-${date.getMonth()}`
}

/** Returns the first trading day of each period (week/month) or every day. */
function filterByTenure(data: StockHistoryPoint[], tenure: Tenure): StockHistoryPoint[] {
  if (tenure === "daily") return data
  const result: StockHistoryPoint[] = []
  const seen = new Set<string>()
  for (const point of data) {
    const key = tenure === "weekly" ? getWeekKey(point.timestamp) : getMonthKey(point.timestamp)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(point)
    }
  }
  return result
}

// ─── SIP computation ─────────────────────────────────────────────────────────

interface SipRow {
  date: string
  price: number
  sharesBought: number
  cumShares: number
  totalInvested: number
  currentValue: number
  gainLoss: number
  gainLossPct: number
}

function computeSip(
  data: StockHistoryPoint[],
  amount: number,
  tenure: Tenure,
): SipRow[] {
  const periods = filterByTenure(data, tenure)
  const currentPrice = data[data.length - 1]?.close ?? 0

  let cumShares = 0
  return periods.map((point, i) => {
    const sharesBought = point.close > 0 ? amount / point.close : 0
    cumShares += sharesBought
    const totalInvested = amount * (i + 1)
    const currentValue = cumShares * currentPrice
    const gainLoss = currentValue - totalInvested
    const gainLossPct = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0
    return { date: point.date, price: point.close, sharesBought, cumShares, totalInvested, currentValue, gainLoss, gainLossPct }
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SipSimulator() {
  const [symbolInput, setSymbolInput] = useState("")
  const [symbol, setSymbol] = useState("")
  const [amount, setAmount] = useState(10000)
  const [tenure, setTenure] = useState<Tenure>("monthly")
  const [historyData, setHistoryData] = useState<StockHistoryPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleFetch = async () => {
    const sym = symbolInput.trim().toUpperCase()
    if (!sym) return
    setLoading(true)
    setError("")
    const result = await fetchStockHistory(sym, "1y")
    setLoading(false)
    if (result.data.length === 0) {
      setError(`No data found for "${sym}". Check the symbol and try again.`)
      return
    }
    setSymbol(sym)
    setHistoryData(result.data)
  }

  const rows = useMemo(
    () => (historyData.length > 0 && amount > 0 ? computeSip(historyData, amount, tenure) : []),
    [historyData, amount, tenure],
  )

  const summary = rows.length > 0 ? rows[rows.length - 1] : null
  const currentPrice = historyData.length > 0 ? historyData[historyData.length - 1].close : 0

  const fmtPKR = (n: number) =>
    `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SIP Simulator — 1 Year Backtest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Symbol */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Stock Symbol</label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. MEBL"
                  value={symbolInput}
                  onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleFetch() } }}
                  className="w-32"
                />
                <Button size="sm" onClick={handleFetch} disabled={loading || !symbolInput.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Investment per Period (PKR)</label>
              <Input
                type="number"
                value={amount}
                min={1}
                onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                className="w-40"
              />
            </div>

            {/* Tenure */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tenure</label>
              <div className="inline-flex rounded-lg border p-0.5 text-xs">
                {(["daily", "weekly", "monthly"] as Tenure[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTenure(t)}
                    className={`rounded-md px-3 py-1.5 capitalize transition-colors ${
                      tenure === t
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      {/* ── Summary cards ── */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Total Invested</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(summary.totalInvested)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rows.length} {tenure} {rows.length === 1 ? "purchase" : "purchases"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Shares Accumulated</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{summary.cumShares.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {symbol} @ {fmtPKR(currentPrice)} now
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Current Value</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(summary.currentValue)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">at latest price</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">Total Return</p>
              <div className="mt-1 flex items-center gap-1.5">
                {summary.gainLoss >= 0
                  ? <TrendingUp className="h-4 w-4 shrink-0 text-green-500" />
                  : <TrendingDown className="h-4 w-4 shrink-0 text-red-500" />}
                <p className={`text-lg font-semibold tabular-nums ${summary.gainLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatCurrency(summary.gainLoss)}
                </p>
              </div>
              <p className={`text-xs mt-0.5 ${summary.gainLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatPercent(summary.gainLossPct)} overall
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Detail table ── */}
      {rows.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs">
                  <th className="text-left font-medium text-muted-foreground px-3 py-2.5 w-8">#</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2.5">Date</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-2.5">Price</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-2.5">Shares Bought</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-2.5">Cum. Shares</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-2.5">Total Invested</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-2.5">Current Value</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-2.5">Gain / Loss</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors text-xs tabular-nums ${
                      i === rows.length - 1 ? "bg-muted/20 font-medium" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2.5">{row.date}</td>
                    <td className="px-3 py-2.5 text-right">{fmtPKR(row.price)}</td>
                    <td className="px-3 py-2.5 text-right">{row.sharesBought.toFixed(4)}</td>
                    <td className="px-3 py-2.5 text-right">{row.cumShares.toFixed(4)}</td>
                    <td className="px-3 py-2.5 text-right">{formatCurrency(row.totalInvested)}</td>
                    <td className="px-3 py-2.5 text-right">{formatCurrency(row.currentValue)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={row.gainLoss >= 0 ? "text-green-500" : "text-red-500"}>
                        {formatCurrency(row.gainLoss)}
                        <span className="block text-[10px]">{formatPercent(row.gainLossPct)}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {rows.length === 0 && !loading && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Enter a stock symbol and investment amount above, then press{" "}
            <kbd className="rounded border px-1.5 py-0.5 text-xs font-mono">Enter</kbd> or click search to simulate.
          </p>
        </div>
      )}
    </div>
  )
}
