"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Loader2, Eye, X, Bell, BellRing } from "lucide-react"
import { formatPercent } from "@/lib/utils"
import {
  useWatchlist,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useLivePrices,
  useStockHistories,
} from "../hooks"
import type { WatchlistItem, LivePrice } from "../hooks"
import { computeChangeMetrics, computeDaysAtCurrentPrice } from "../utils/compute-changes"
import type { ChangeMetrics } from "../utils/compute-changes"
import { METRIC_LABELS } from "../utils/compute-changes"

import type { StockHistoryPoint } from "../hooks"

// Only DoD, WoW, MoM, YTD shown as individual columns; multi-year rolled into YoxY
const SHORT_METRIC_KEYS: (keyof ChangeMetrics)[] = ["dod", "wow", "mom", "ytd"]

const ALERT_THRESHOLD = 0.5 // ±0.5%

function ChangeCell({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/40">-</span>
  }
  return (
    <span className={value >= 0 ? "text-green-500" : "text-red-500"}>
      {formatPercent(value)}
    </span>
  )
}

function YoxYCell({ metrics }: { metrics: ReturnType<typeof computeChangeMetrics> | undefined }) {
  if (!metrics) return <span className="text-muted-foreground/40">-</span>

  const rows: { label: string; value: number | null }[] = [
    { label: "YoY", value: metrics.yoy },
    { label: "2Y",  value: metrics.yo2y },
    { label: "3Y",  value: metrics.yo3y },
    { label: "4Y",  value: metrics.yo4y },
    { label: "5Y",  value: metrics.yo5y },
    { label: "All", value: metrics.inception },
  ]

  return (
    <div className="relative group/yoxy inline-block">
      <ChangeCell value={metrics.yoy} />
      {/* Hover card */}
      <div className="absolute bottom-full right-0 mb-1.5 z-50 hidden group-hover/yoxy:block min-w-[110px] rounded-md border bg-popover shadow-md p-2 text-xs">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            {value == null
              ? <span className="text-muted-foreground/40">-</span>
              : <span className={value >= 0 ? "text-green-500" : "text-red-500"}>{formatPercent(value)}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function Sparkline({ points, width, height = 32 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return <span className="text-muted-foreground/40">-</span>
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const padY = 2
  const innerH = height - padY * 2
  const w = width ?? 100

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w
    const y = padY + innerH - ((v - min) / range) * innerH
    return `${x},${y}`
  })

  const up = points[points.length - 1] >= points[0]

  return (
    <svg
      width={width ?? "100%"}
      height={height}
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="block w-full"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={up ? "#22c55e" : "#ef4444"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatDaysAgo(days: number): string {
  if (days < 365) return `${days}d ago`
  const years = days / 365
  return `${years.toFixed(1)}y ago`
}

function LastSeenBadge({ days }: { days: number | null }) {
  if (days === null) {
    return (
      <span
        className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-400"
        title="Price not seen before in available history at this level (±1% range)"
      >
        ATL
      </span>
    )
  }

  // Colour the badge based on how far back the price was last seen
  let cls: string
  if (days >= 365) {
    cls = "bg-red-500/10 text-red-400"        // multi-year low — significant
  } else if (days >= 90) {
    cls = "bg-orange-500/10 text-orange-400"  // 3-month low
  } else if (days >= 30) {
    cls = "bg-yellow-500/10 text-yellow-400"  // 1-month low
  } else {
    cls = "bg-muted text-muted-foreground"    // recently seen — unremarkable
  }

  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const dateStr = date.toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}
      title={`${dateStr} (~${days}d ago, ±1% range)`}
    >
      {formatDaysAgo(days)}
    </span>
  )
}

function getLast7Days(data: StockHistoryPoint[]): number[] {
  if (data.length === 0) return []
  return data.slice(-7).map((d) => d.close)
}

/** Returns avg volume over the last 7 completed trading sessions. */
function get7DayAvgVolume(data: StockHistoryPoint[]): number | null {
  if (data.length < 2) return null
  // Exclude the last candle (may be today's partial session) and take prior 7
  const sessions = data.slice(-8, -1)
  if (sessions.length === 0) return null
  const total = sessions.reduce((sum, d) => sum + d.volume, 0)
  return total / sessions.length
}

function HiLo({ high, low }: { high: number; low: number }) {
  if (high === 0 && low === 0) return <span className="text-muted-foreground/40">-</span>
  const fmt = (n: number) => n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (
    <span className="tabular-nums text-xs">
      <span className="text-green-500">{fmt(high)}</span>
      <span className="text-muted-foreground/50 mx-0.5">/</span>
      <span className="text-red-500">{fmt(low)}</span>
    </span>
  )
}

function VolumeCell({ liveVol, avgVol }: { liveVol: number; avgVol: number | null }) {
  if (liveVol === 0) return <span className="text-muted-foreground/40">-</span>
  if (!avgVol || avgVol === 0) {
    return (
      <span className="tabular-nums text-muted-foreground">
        {liveVol.toLocaleString("en-PK")}
      </span>
    )
  }
  const pct = ((liveVol - avgVol) / avgVol) * 100
  const color = pct >= 0 ? "text-green-500" : "text-red-500"
  const sign = pct >= 0 ? "+" : ""
  const tooltip = `Today: ${liveVol.toLocaleString("en-PK")} | 7d avg: ${Math.round(avgVol).toLocaleString("en-PK")}`
  return (
    <span className={`tabular-nums ${color}`} title={tooltip}>
      {sign}{pct.toFixed(0)}% avg
    </span>
  )
}

function sendNotification(symbol: string, changePct: number, price: number) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  const direction = changePct >= 0 ? "up" : "down"
  const sign = changePct >= 0 ? "+" : ""
  new Notification(`${symbol} price alert`, {
    body: `${symbol} is ${direction} ${sign}${changePct.toFixed(2)}% — PKR ${price.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    icon: changePct >= 0 ? undefined : undefined,
  })
}

export function WatchlistTab() {
  const [symbolInput, setSymbolInput] = useState("")
  const [alertPrices, setAlertPrices] = useState<Map<string, number>>(new Map())
  const firedRef = useRef<Set<string>>(new Set())

  const { data: watchlistItems, isLoading: watchlistLoading } = useWatchlist()
  const addMutation = useAddToWatchlist()
  const removeMutation = useRemoveFromWatchlist()

  const symbols = ((watchlistItems as WatchlistItem[]) ?? []).map((item) => item.symbol)

  const { data: livePrices, isLoading: livePricesLoading, isFetching: livePricesFetching } = useLivePrices(symbols)
  const { data: histories, isLoading: historiesLoading } = useStockHistories(symbols, "max")

  const livePriceMap = new Map<string, LivePrice>()
  if (livePrices) {
    for (const lp of livePrices) {
      livePriceMap.set(lp.symbol, lp)
    }
  }

  const metricsMap = new Map<string, ReturnType<typeof computeChangeMetrics>>()
  const sparklineMap = new Map<string, number[]>()
  const daysAtPriceMap = new Map<string, number | null>()
  const volAvgMap = new Map<string, number | null>()
  if (histories) {
    for (const h of histories) {
      metricsMap.set(h.symbol, computeChangeMetrics(h.data))
      sparklineMap.set(h.symbol, getLast7Days(h.data))
      const currentPrice = livePriceMap.get(h.symbol)?.price ?? 0
      daysAtPriceMap.set(h.symbol, computeDaysAtCurrentPrice(currentPrice, h.data))
      volAvgMap.set(h.symbol, get7DayAvgVolume(h.data))
    }
  }

  const handleAdd = () => {
    const sym = symbolInput.trim().toUpperCase()
    if (!sym) return
    addMutation.mutate(sym)
    setSymbolInput("")
  }

  const handleRemove = (symbol: string) => {
    removeMutation.mutate(symbol)
    setAlertPrices((prev) => { const next = new Map(prev); next.delete(symbol); return next })
  }

  const toggleAlert = (symbol: string, currentPrice: number) => {
    setAlertPrices((prev) => {
      const next = new Map(prev)
      if (next.has(symbol)) {
        next.delete(symbol)
        firedRef.current.delete(symbol)
      } else if (currentPrice > 0) {
        next.set(symbol, currentPrice)
        firedRef.current.delete(symbol)
        // Request permission on first alert
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
          Notification.requestPermission()
        }
      }
      return next
    })
  }

  // Check live prices against alert thresholds
  useEffect(() => {
    if (alertPrices.size === 0 || !livePrices) return
    for (const lp of livePrices) {
      const refPrice = alertPrices.get(lp.symbol)
      if (refPrice === undefined || refPrice === 0 || lp.price === 0) continue
      if (firedRef.current.has(lp.symbol)) continue

      const changePct = ((lp.price - refPrice) / refPrice) * 100
      if (Math.abs(changePct) >= ALERT_THRESHOLD) {
        sendNotification(lp.symbol, changePct, lp.price)
        firedRef.current.add(lp.symbol)
        // Auto-remove the alert after firing
        setAlertPrices((prev) => { const next = new Map(prev); next.delete(lp.symbol); return next })
      }
    }
  }, [livePrices, alertPrices])

  const isDataLoading = watchlistLoading || (symbols.length > 0 && (livePricesLoading || historiesLoading))

  return (
    <div className="space-y-6">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
        <Input
          placeholder="Add stock symbol (e.g. LUCK)"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAdd()
            }
          }}
          className="max-w-xs"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={addMutation.isPending || !symbolInput.trim()}
        >
          {addMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          {addMutation.isPending ? "Adding..." : "Add"}
        </Button>
        </div>
        {livePricesFetching && !isDataLoading && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating prices…
          </span>
        )}
      </div>

      {symbols.length === 0 && !watchlistLoading ? (
        <EmptyState
          icon={Eye}
          title="No watchlist items"
          description="Add stock symbols above to track their live prices and performance metrics."
        />
      ) : (
        <>
          {/* ── Mobile tiles (< sm) ────────────────────────────────────── */}
          <div className="sm:hidden space-y-3">
            {isDataLoading
              ? symbols.map((symbol) => (
                  <div key={symbol} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5">
                        <div className="font-semibold">{symbol}</div>
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {SHORT_METRIC_KEYS.map((key) => (
                        <div key={key} className="space-y-1">
                          <Skeleton className="h-3 w-8" />
                          <Skeleton className="h-4 w-10" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              : symbols.map((symbol, i) => {
                  const lp = livePriceMap.get(symbol)
                  const metrics = metricsMap.get(symbol)
                  const price = lp?.price ?? 0
                  const isAlerting = alertPrices.has(symbol)
                  const refPrice = alertPrices.get(symbol)
                  return (
                    <div key={symbol} className="rounded-lg border p-3 space-y-3 text-sm">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{i + 1}. {symbol}</span>
                            <HiLo high={lp?.dayHigh ?? 0} low={lp?.dayLow ?? 0} />
                          </div>
                          <div className="mt-1">
                            <LastSeenBadge days={daysAtPriceMap.get(symbol) ?? null} />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium tabular-nums">
                            {price > 0
                              ? `PKR ${price.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "-"}
                          </div>
                          <div className="flex items-center justify-end gap-0.5 mt-1">
                            <button
                              onClick={() => toggleAlert(symbol, price)}
                              className={`p-1 rounded-md transition-colors ${
                                isAlerting
                                  ? "text-yellow-500"
                                  : "text-muted-foreground/50"
                              }`}
                              title={
                                isAlerting
                                  ? `Alert active — ref PKR ${refPrice?.toLocaleString("en-PK", { minimumFractionDigits: 2 })} (±${ALERT_THRESHOLD}%)`
                                  : `Set price alert (±${ALERT_THRESHOLD}% from current)`
                              }
                            >
                              {isAlerting ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => handleRemove(symbol)}
                              className="p-1 rounded-md hover:bg-muted"
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Sparkline */}
                      <Sparkline points={sparklineMap.get(symbol) ?? []} width={undefined} height={28} />

                      {/* Short metrics */}
                      <div className="grid grid-cols-4 gap-x-2 gap-y-1 text-xs">
                        {SHORT_METRIC_KEYS.map((key) => (
                          <div key={key}>
                            <div className="text-muted-foreground mb-0.5">{METRIC_LABELS[key]}</div>
                            <ChangeCell value={metrics?.[key]} />
                          </div>
                        ))}
                      </div>

                      {/* Volume vs 7d avg */}
                      <div className="text-xs border-t pt-2 flex items-center gap-2">
                        <span className="text-muted-foreground">Vol</span>
                        <VolumeCell liveVol={lp?.volume ?? 0} avgVol={volAvgMap.get(symbol) ?? null} />
                      </div>
                    </div>
                  )
                })}
          </div>

          {/* ── Desktop table (≥ sm) ───────────────────────────────────── */}
          <div className="hidden sm:block rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-2 py-2.5 w-8">#</th>
                    <th className="text-left font-medium text-muted-foreground px-2 py-2.5">Name</th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5">Price</th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5 hidden md:table-cell">H / L</th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5" title="Last time price was within ±1% of current">Last seen</th>
                    {SHORT_METRIC_KEYS.map((key) => (
                      <th key={key} className="text-right font-medium text-muted-foreground px-1.5 py-2.5">
                        {METRIC_LABELS[key]}
                      </th>
                    ))}
                    <th className="text-right font-medium text-muted-foreground px-1.5 py-2.5" title="Hover to see 2Y, 3Y, 4Y, 5Y, All">YoxY</th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5 hidden lg:table-cell">Volume</th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5 hidden md:table-cell">Last 7d</th>
                    <th className="w-16 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {isDataLoading
                    ? symbols.map((symbol, i) => (
                        <tr key={symbol} className="border-b last:border-b-0">
                          <td className="px-2 py-2.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-2.5 font-medium">{symbol}</td>
                          <td className="px-2 py-2.5 text-right"><Skeleton className="h-4 w-20 ml-auto" /></td>
                          <td className="px-2 py-2.5 text-right hidden md:table-cell"><Skeleton className="h-4 w-24 ml-auto" /></td>
                          <td className="px-2 py-2.5 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          {SHORT_METRIC_KEYS.map((key) => (
                            <td key={key} className="px-1.5 py-2.5 text-right">
                              <Skeleton className="h-4 w-12 ml-auto" />
                            </td>
                          ))}
                          <td className="px-1.5 py-2.5 text-right">
                            <Skeleton className="h-4 w-12 ml-auto" />
                          </td>
                          <td className="px-2 py-2.5 text-right hidden lg:table-cell"><Skeleton className="h-4 w-20 ml-auto" /></td>
                          <td className="px-2 py-2.5 text-right hidden md:table-cell"><Skeleton className="h-8 w-[100px] ml-auto" /></td>
                          <td className="px-2 py-2.5" />
                        </tr>
                      ))
                    : symbols.map((symbol, i) => {
                        const lp = livePriceMap.get(symbol)
                        const metrics = metricsMap.get(symbol)
                        const price = lp?.price ?? 0
                        const volume = lp?.volume ?? 0
                        const isAlerting = alertPrices.has(symbol)
                        const refPrice = alertPrices.get(symbol)
                        return (
                          <tr key={symbol} className="border-b last:border-b-0 group hover:bg-muted/30 transition-colors">
                            <td className="px-2 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="px-2 py-2.5 font-semibold">{symbol}</td>
                            <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                              {price > 0
                                ? `PKR ${price.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "-"}
                            </td>
                            <td className="px-2 py-2.5 text-right hidden md:table-cell">
                              <HiLo high={lp?.dayHigh ?? 0} low={lp?.dayLow ?? 0} />
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-xs">
                              <LastSeenBadge days={daysAtPriceMap.get(symbol) ?? null} />
                            </td>
                            {SHORT_METRIC_KEYS.map((key) => (
                              <td key={key} className="px-1.5 py-2.5 text-right tabular-nums text-xs">
                                <ChangeCell value={metrics?.[key]} />
                              </td>
                            ))}
                            <td className="px-1.5 py-2.5 text-right tabular-nums text-xs">
                              <YoxYCell metrics={metrics} />
                            </td>
                            <td className="px-2 py-2.5 text-right text-xs hidden lg:table-cell">
                              <VolumeCell liveVol={volume} avgVol={volAvgMap.get(symbol) ?? null} />
                            </td>
                            <td className="px-2 py-2.5 text-right hidden md:table-cell">
                              <Sparkline points={sparklineMap.get(symbol) ?? []} width={100} />
                            </td>
                            <td className="px-2 py-2.5">
                              <div className="flex items-center justify-end gap-0.5">
                                <button
                                  onClick={() => toggleAlert(symbol, price)}
                                  className={`p-1 rounded-md transition-colors ${
                                    isAlerting
                                      ? "text-yellow-500 hover:text-yellow-400"
                                      : "text-muted-foreground/50 hover:text-foreground"
                                  }`}
                                  title={
                                    isAlerting
                                      ? `Alert active — ref PKR ${refPrice?.toLocaleString("en-PK", { minimumFractionDigits: 2 })} (±${ALERT_THRESHOLD}%)`
                                      : `Set price alert (±${ALERT_THRESHOLD}% from current)`
                                  }
                                >
                                  {isAlerting ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleRemove(symbol)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                                >
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
