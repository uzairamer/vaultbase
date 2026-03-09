"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, Loader2, Eye, X, Bell, BellRing, BellDot, Sparkles, XCircle } from "lucide-react"
import { toast } from "sonner"
import { formatPercent } from "@/lib/utils"
import {
  useWatchlist,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useRoundRobinPrices,
  useStockHistories,
} from "../hooks"
import type { WatchlistItem, LivePrice } from "../hooks"
import { computeChangeMetrics, computeDaysAtCurrentPrice } from "../utils/compute-changes"
import type { ChangeMetrics } from "../utils/compute-changes"
import { METRIC_LABELS } from "../utils/compute-changes"

import type { StockHistoryPoint } from "../hooks"

// Only DoD, WoW, MoM, YTD shown as individual columns; multi-year rolled into YoxY
const SHORT_METRIC_KEYS: (keyof ChangeMetrics)[] = ["wow", "mom", "ytd"]

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
        className="inline-flex items-center rounded px-1.5 py-0.5 text-sm font-medium bg-purple-500/10 text-purple-400"
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
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-sm font-medium ${cls}`}
      title={`${dateStr} (~${days}d ago, ±1% range)`}
    >
      {formatDaysAgo(days)}
    </span>
  )
}

function isToday(timestamp: number): boolean {
  const d = new Date(timestamp * 1000)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

/** Returns the most recent completed session's closing price, skipping today's candle if the API included it. */
function getLDCP(data: StockHistoryPoint[]): number {
  if (data.length === 0) return 0
  const last = data[data.length - 1]
  if (isToday(last.timestamp)) {
    // Today's in-progress candle — use the previous session
    return data.length >= 2 ? data[data.length - 2].close : 0
  }
  return last.close
}

function getLast7Days(data: StockHistoryPoint[]): number[] {
  if (data.length === 0) return []
  return data.slice(-7).map((d) => d.close)
}

function get1YAvgPrice(data: StockHistoryPoint[]): number | null {
  if (data.length === 0) return null
  const oneYearAgo = (data[data.length - 1].timestamp) - 365 * 24 * 60 * 60
  const slice = data.filter((d) => d.timestamp >= oneYearAgo)
  if (slice.length === 0) return null
  return slice.reduce((sum, d) => sum + d.close, 0) / slice.length
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

function get7DayMedianVolume(data: StockHistoryPoint[]): number | null {
  if (data.length < 2) return null
  const sessions = data.slice(-8, -1)
  if (sessions.length === 0) return null
  const sorted = sessions.map((d) => d.volume).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function HiLo({ high, low, ldcp }: { high: number; low: number; ldcp: number }) {
  if (high === 0 && low === 0) return <span className="text-muted-foreground/40">-</span>
  const fmt = (n: number) => n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const highPct = ldcp > 0 ? ((high - ldcp) / ldcp) * 100 : null
  const lowPct = ldcp > 0 ? ((low - ldcp) / ldcp) * 100 : null
  return (
    <span className="tabular-nums text-sm space-y-0.5 block text-right">
      <span className="block text-green-500">
        {fmt(high)}{highPct != null ? <span className="ml-1 opacity-70">(+{highPct.toFixed(1)}%)</span> : null}
      </span>
      <span className="block text-red-500">
        {fmt(low)}{lowPct != null ? <span className="ml-1 opacity-70">({lowPct.toFixed(1)}%)</span> : null}
      </span>
    </span>
  )
}


// Shared AudioContext — created once on first user gesture so iOS unlocks it
let _audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  try {
    if (!_audioCtx) _audioCtx = new AudioContext()
    return _audioCtx
  } catch { return null }
}

function playAlertChime(up: boolean) {
  const ctx = getAudioCtx()
  if (!ctx) return

  const notes = up
    ? [{ freq: 880, start: 0 }, { freq: 1320, start: 0.12 }]  // A5 → E6
    : [{ freq: 880, start: 0 }, { freq: 698, start: 0.12 }]   // A5 → F5

  const doPlay = () => {
    try {
      const gain = ctx.createGain()
      gain.connect(ctx.destination)
      for (const { freq, start } of notes) {
        const osc = ctx.createOscillator()
        const env = ctx.createGain()
        osc.type = "sine"
        osc.frequency.value = freq
        osc.connect(env)
        env.connect(gain)
        env.gain.setValueAtTime(0, ctx.currentTime + start)
        env.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.01)
        env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.35)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + 0.35)
      }
    } catch { /* silently skip */ }
  }

  // iOS starts AudioContext in "suspended" — resume() unlocks it
  if (ctx.state === "suspended") {
    ctx.resume().then(doPlay).catch(() => {})
  } else {
    doPlay()
  }
}

function sendNotification(symbol: string, changePct: number, price: number, ldcp?: number) {
  const sign = changePct >= 0 ? "+" : ""
  const priceStr = price.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const dodStr = ldcp && ldcp > 0
    ? ` · DoD ${((price - ldcp) / ldcp * 100) >= 0 ? "+" : ""}${((price - ldcp) / ldcp * 100).toFixed(2)}%`
    : ""
  const msg = `${symbol} ${sign}${changePct.toFixed(2)}%${dodStr} — PKR ${priceStr}`

  playAlertChime(changePct >= 0)

  if (changePct >= 0) {
    toast.success(`Price alert: ${msg}`, { duration: 15000 })
  } else {
    toast.error(`Price alert: ${msg}`, { duration: 15000 })
  }

  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    new Notification(`${symbol} price alert`, { body: msg })
  }
}

type AlertEntry = { refPrice: number; threshold: number }

function ColHeader({ label, full, description, formula }: {
  label: string
  full?: string
  description: string
  formula?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dashed decoration-muted-foreground/40 underline-offset-2">
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 space-y-1">
        {full && <p className="font-semibold text-xs">{full}</p>}
        <p className="text-xs text-muted-foreground">{description}</p>
        {formula && <p className="font-mono text-[10px] text-muted-foreground/70 pt-0.5 border-t border-border mt-1">{formula}</p>}
      </TooltipContent>
    </Tooltip>
  )
}

const METRIC_TOOLTIPS: Partial<Record<keyof ChangeMetrics, { full: string; description: string; formula: string }>> = {
  wow: { full: "Week over Week", description: "Price change over the past 7 calendar days.", formula: "(Price − Price₋₇d) ÷ Price₋₇d × 100" },
  mom: { full: "Month over Month", description: "Price change over the past 30 calendar days.", formula: "(Price − Price₋₃₀d) ÷ Price₋₃₀d × 100" },
  ytd: { full: "Year to Date", description: "Price change since January 1st of the current year.", formula: "(Price − PriceJan₁) ÷ PriceJan₁ × 100" },
}

export function WatchlistTab() {
  const [symbolInput, setSymbolInput] = useState("")
  const [alertPrices, setAlertPrices] = useState<Map<string, AlertEntry>>(() => {
    if (typeof window === "undefined") return new Map()
    try {
      const saved = localStorage.getItem("watchlist-alerts")
      if (saved) return new Map(JSON.parse(saved) as [string, AlertEntry][])
    } catch {}
    return new Map()
  })
  const [alertDialog, setAlertDialog] = useState<{ symbol: string; price: number } | { symbol: "__all__"; price: 0 } | null>(null)
  const [thresholdInput, setThresholdInput] = useState("0.5")
  const firedRef = useRef<Set<string>>(new Set())
  const [showFetchGlow, setShowFetchGlow] = useState(true)
  const [glowingSymbols, setGlowingSymbols] = useState<Map<string, "active" | "fadeout">>(new Map())
  const glowTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const prevFetchingRef = useRef<string | null>(null)
  const [flashMap, setFlashMap] = useState<Map<string, "up" | "down">>(new Map())
  const prevPricesRef = useRef<Map<string, number>>(new Map())
  const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Persist alerts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("watchlist-alerts", JSON.stringify(Array.from(alertPrices.entries())))
  }, [alertPrices])

  const { data: watchlistItems, isLoading: watchlistLoading } = useWatchlist()
  const addMutation = useAddToWatchlist()
  const removeMutation = useRemoveFromWatchlist()

  const symbols = ((watchlistItems as WatchlistItem[]) ?? []).map((item) => item.symbol)

  const { data: livePrices, isLoading: livePricesLoading, isFetching: livePricesFetching, fetchingSymbol } = useRoundRobinPrices(symbols)
  const { data: histories, isLoading: historiesLoading } = useStockHistories(symbols, "max")

  // Flash price cells when prices change after a fetch
  useEffect(() => {
    if (!livePrices) return
    const updates: [string, "up" | "down"][] = []
    for (const lp of livePrices) {
      const prev = prevPricesRef.current.get(lp.symbol)
      if (prev !== undefined && lp.price > 0 && lp.price !== prev) {
        updates.push([lp.symbol, lp.price > prev ? "up" : "down"])
      }
      prevPricesRef.current.set(lp.symbol, lp.price)
    }
    if (updates.length === 0) return
    setFlashMap((prev) => { const next = new Map(prev); for (const [s, d] of updates) next.set(s, d); return next })
    for (const [sym] of updates) {
      const existing = flashTimersRef.current.get(sym)
      if (existing) clearTimeout(existing)
      const t = setTimeout(() => {
        setFlashMap((prev) => { const next = new Map(prev); next.delete(sym); return next })
        flashTimersRef.current.delete(sym)
      }, 2200)
      flashTimersRef.current.set(sym, t)
    }
  }, [livePrices])

  // Cleanup flash timers on unmount
  useEffect(() => {
    return () => { for (const t of flashTimersRef.current.values()) clearTimeout(t) }
  }, [])

  // Fade-in → spin → fade-out glow lifecycle
  useEffect(() => {
    const prev = prevFetchingRef.current
    const curr = fetchingSymbol

    if (curr && curr !== prev) {
      // Cancel any pending fade-out for this symbol
      const existing = glowTimersRef.current.get(curr)
      if (existing) { clearTimeout(existing); glowTimersRef.current.delete(curr) }
      setGlowingSymbols((m) => { const n = new Map(m); n.set(curr, "active"); return n })
    }

    if (prev && prev !== curr) {
      // Switch to fade-out, then remove
      setGlowingSymbols((m) => { const n = new Map(m); n.set(prev, "fadeout"); return n })
      const t = setTimeout(() => {
        setGlowingSymbols((m) => { const n = new Map(m); n.delete(prev); return n })
        glowTimersRef.current.delete(prev)
      }, 500)
      glowTimersRef.current.set(prev, t)
    }

    prevFetchingRef.current = curr
  }, [fetchingSymbol])

  // Cleanup glow timers on unmount
  useEffect(() => {
    return () => { for (const t of glowTimersRef.current.values()) clearTimeout(t) }
  }, [])

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
  const volMedMap = new Map<string, number | null>()
  const avgPriceMap = new Map<string, number | null>()
  const ldcpMap = new Map<string, number>()
  if (histories) {
    for (const h of histories) {
      metricsMap.set(h.symbol, computeChangeMetrics(h.data))
      sparklineMap.set(h.symbol, getLast7Days(h.data))
      const currentPrice = livePriceMap.get(h.symbol)?.price ?? 0
      daysAtPriceMap.set(h.symbol, computeDaysAtCurrentPrice(currentPrice, h.data))
      volAvgMap.set(h.symbol, get7DayAvgVolume(h.data))
      volMedMap.set(h.symbol, get7DayMedianVolume(h.data))
      avgPriceMap.set(h.symbol, get1YAvgPrice(h.data))
      ldcpMap.set(h.symbol, getLDCP(h.data))
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
    if (alertDialog?.symbol === symbol) setAlertDialog(null)
  }

  const removeAlert = (symbol: string) => {
    setAlertPrices((prev) => { const next = new Map(prev); next.delete(symbol); return next })
    firedRef.current.delete(symbol)
  }

  const openAlertDialog = (symbol: string, price: number) => {
    setThresholdInput("0.5")
    setAlertDialog({ symbol, price })
  }

  const confirmAlert = () => {
    if (!alertDialog) return
    const threshold = parseFloat(thresholdInput)
    if (isNaN(threshold) || threshold <= 0) { setAlertDialog(null); return }

    if (alertDialog.symbol === "__all__") {
      // Set alert for every symbol that has a live price
      setAlertPrices((prev) => {
        const next = new Map(prev)
        for (const sym of symbols) {
          const price = livePriceMap.get(sym)?.price ?? 0
          if (price > 0) {
            next.set(sym, { refPrice: price, threshold })
            firedRef.current.delete(sym)
          }
        }
        return next
      })
    } else {
      if (alertDialog.price > 0) {
        setAlertPrices((prev) => { const next = new Map(prev); next.set(alertDialog.symbol, { refPrice: alertDialog.price, threshold }); return next })
        firedRef.current.delete(alertDialog.symbol)
      }
    }

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
    setAlertDialog(null)
  }

  const fireTestAlert = async () => {
    playAlertChime(true)
    // Toast always works — fire it immediately
    toast.success("Price alert: LUCK +2.50% — PKR 155.00 (test)", { duration: 15000 })

    // Also try browser notification
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission()
      }
      if (Notification.permission === "granted") {
        new Notification("Vaultbase price alert — test", {
          body: "LUCK +2.50% — PKR 155.00 (test notification)",
        })
      }
    }
  }

  // Check live prices against alert thresholds
  useEffect(() => {
    if (alertPrices.size === 0 || !livePrices) return
    for (const lp of livePrices) {
      const entry = alertPrices.get(lp.symbol)
      if (!entry || entry.refPrice === 0 || lp.price === 0) continue
      if (firedRef.current.has(lp.symbol)) continue

      const changePct = ((lp.price - entry.refPrice) / entry.refPrice) * 100
      if (Math.abs(changePct) >= entry.threshold) {
        sendNotification(lp.symbol, changePct, lp.price, ldcpMap.get(lp.symbol))
        // Roll the base price forward to the triggered price so the next
        // alert fires when the price moves another ±threshold% from here
        setAlertPrices((prev) => {
          const next = new Map(prev)
          next.set(lp.symbol, { refPrice: lp.price, threshold: entry.threshold })
          return next
        })
        // Allow re-firing once the ref price has been updated
        firedRef.current.delete(lp.symbol)
      }
    }
  }, [livePrices, alertPrices])

  const isDataLoading = watchlistLoading || (symbols.length > 0 && (livePricesLoading || historiesLoading))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        {/* Row 1 — input + add */}
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
        {/* Row 2 — actions */}
        <div className="flex items-center gap-2">
          {symbols.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setThresholdInput("0.5"); setAlertDialog({ symbol: "__all__", price: 0 }) }}
              title="Set price alert for all watchlist symbols at once"
            >
              <BellRing className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Alert All</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFetchGlow((v) => !v)}
            title={showFetchGlow ? "Disable fetch glow" : "Enable fetch glow"}
            className={showFetchGlow ? "border-yellow-500/50 text-yellow-500 hover:text-yellow-400" : ""}
          >
            <Sparkles className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Glow</span>
          </Button>
          <Button size="sm" variant="outline" onClick={fireTestAlert} title="Send a test notification to verify alerts are working">
            <BellDot className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Test Alert</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => toast.dismiss()} title="Clear all notifications">
            <XCircle className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </div>

      {symbols.length === 0 && !watchlistLoading ? (
        <EmptyState
          icon={Eye}
          title="No watchlist items"
          description="Add stock symbols above to track their live prices and performance metrics."
        />
      ) : (
        <>
          {/* ── Mobile grid (< sm) — 3 per row ────────────────────────── */}
          <div className="sm:hidden grid grid-cols-2 gap-2">
            {isDataLoading
              ? symbols.map((symbol) => (
                  <div key={symbol} className="rounded-xl border p-2.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{symbol}</span>
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <div className="space-y-1.5 pt-1 border-t">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))
              : symbols.map((symbol) => {
                  const lp = livePriceMap.get(symbol)
                  const metrics = metricsMap.get(symbol)
                  const price = lp?.price ?? 0
                  const high = lp?.dayHigh ?? 0
                  const low = lp?.dayLow ?? 0
                  const avg = avgPriceMap.get(symbol) ?? null
                  const ldcp = ldcpMap.get(symbol) ?? 0
                  const dod = ldcp > 0 && price > 0 ? ((price - ldcp) / ldcp) * 100 : null
                  const isAlerting = alertPrices.has(symbol)
                  const alertEntry = alertPrices.get(symbol)

                  const fmt = (n: number) => n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`

                  const highPct = ldcp > 0 && high > 0 ? ((high - ldcp) / ldcp) * 100 : null
                  const lowPct = ldcp > 0 && low > 0 ? ((low - ldcp) / ldcp) * 100 : null
                  const avgPct = price > 0 && avg ? ((price - avg) / avg) * 100 : null

                  const int = (n: number) => Math.round(n).toLocaleString("en-PK")
                  const liveVol = lp?.volume ?? 0
                  const avgVol = volAvgMap.get(symbol) ?? null
                  const medVol = volMedMap.get(symbol) ?? null

                  return (
                    <div
                      key={symbol}
                      className="rounded-xl border p-3 space-y-2 text-xs"
                      style={(() => {
                        const glow = showFetchGlow ? glowingSymbols.get(symbol) : undefined
                        if (glow === "active") return { animation: "fetch-gold-fadein 0.3s ease-out forwards, fetch-gold-spin 1.2s 0.3s linear infinite" }
                        if (glow === "fadeout") return { animation: "fetch-gold-fadeout 0.5s ease-in forwards" }
                        if (flashMap.get(symbol) === "up") return { animation: "price-flash-up 2s ease-out forwards" }
                        if (flashMap.get(symbol) === "down") return { animation: "price-flash-down 2s ease-out forwards" }
                        return undefined
                      })()}
                    >

                      {/* Symbol + actions */}
                      <div className="flex items-center justify-between gap-0.5">
                        <span className="font-bold text-sm truncate">{symbol}</span>
                        <div className="flex shrink-0">
                          {isAlerting ? (
                            <button
                              onClick={() => removeAlert(symbol)}
                              className="p-1 rounded transition-colors text-yellow-500"
                              title={`Alert active — ref PKR ${alertEntry?.refPrice.toLocaleString("en-PK", { minimumFractionDigits: 2 })} (±${alertEntry?.threshold}%) — click to remove`}
                            >
                              <BellRing className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openAlertDialog(symbol, price)}
                              className="p-1 rounded transition-colors text-muted-foreground/40"
                              title="Set price alert"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleRemove(symbol)} className="p-1 rounded hover:bg-muted">
                            <X className="h-3.5 w-3.5 text-muted-foreground/40" />
                          </button>
                        </div>
                      </div>

                      {/* Price + DoD inline */}
                      <div className="tabular-nums">
                        <span className={`font-semibold text-sm ${dod != null ? (dod >= 0 ? "text-green-500" : "text-red-500") : ""}`}>
                          {price > 0 ? `Rs. ${fmt(price)}` : "—"}
                          {dod != null && (
                            <span className="ml-1 font-normal opacity-80">({dod >= 0 ? "+" : ""}{dod.toFixed(2)}%)</span>
                          )}
                        </span>
                      </div>

                      {/* LDCP */}
                      {ldcp > 0 && (
                        <div className="flex items-center justify-between border-t pt-1 tabular-nums">
                          <span className="text-muted-foreground">LDCP</span>
                          <span>Rs. {fmt(ldcp)}</span>
                        </div>
                      )}

                      {/* H / L */}
                      <div className="space-y-0.5 border-t pt-1 tabular-nums">
                        {high > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">High</span>
                            <span className="text-green-500">
                              Rs. {int(high)}{highPct != null ? ` (+${highPct.toFixed(1)}%)` : ""}
                            </span>
                          </div>
                        )}
                        {low > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Low</span>
                            <span className="text-red-500">
                              Rs. {int(low)}{lowPct != null ? ` (${lowPct.toFixed(1)}%)` : ""}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* RVOL (avg) + RVOL (med) */}
                      {liveVol > 0 && (avgVol || medVol) && (
                        <div className="space-y-0.5 border-t pt-1">
                          {avgVol && avgVol > 0 && (() => {
                            const rvol = liveVol / avgVol
                            const color = rvol >= 2 ? "text-green-500" : rvol >= 1 ? "" : "text-muted-foreground"
                            return (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">RVOL (avg)</span>
                                <span className={`tabular-nums ${color}`}>{rvol.toFixed(2)}x</span>
                              </div>
                            )
                          })()}
                          {medVol && medVol > 0 && (() => {
                            const rvol = liveVol / medVol
                            const color = rvol >= 2 ? "text-green-500" : rvol >= 1 ? "" : "text-muted-foreground"
                            return (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">RVOL (med)</span>
                                <span className={`tabular-nums ${color}`}>{rvol.toFixed(2)}x</span>
                              </div>
                            )
                          })()}
                        </div>
                      )}

                    </div>
                  )
                })}
          </div>

          {/* ── Desktop table (≥ sm) ───────────────────────────────────── */}
          <div className="hidden sm:block rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-2 py-2.5 w-8">#</th>
                    <th className="text-left font-medium text-muted-foreground px-2 py-2.5">Name</th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5">
                      <ColHeader label="Price (DoD)" full="Price with Day-over-Day Change" description="Current market price alongside its percentage change since the previous session's close." formula="(Price − LDCP) ÷ LDCP × 100" />
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5 hidden md:table-cell">
                      <ColHeader label="LDCP" full="Last Day Closing Price" description="The official closing price of the most recent completed trading session." />
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5 hidden md:table-cell">
                      <ColHeader label="H / L" full="Day High / Day Low" description="The highest and lowest prices traded in today's session, with percentage distance from current price." />
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5">
                      <ColHeader label="Last seen" full="Last Seen at This Price" description="How long ago the stock last traded within ±1% of its current price. Longer = more unusual level." />
                    </th>
                    {SHORT_METRIC_KEYS.map((key) => {
                      const tip = METRIC_TOOLTIPS[key]
                      return (
                        <th key={key} className="text-right font-medium text-muted-foreground px-1.5 py-2.5">
                          {tip
                            ? <ColHeader label={METRIC_LABELS[key]} full={tip.full} description={tip.description} formula={tip.formula} />
                            : METRIC_LABELS[key]}
                        </th>
                      )
                    })}
                    <th className="text-right font-medium text-muted-foreground px-1.5 py-2.5">
                      <ColHeader label="YoxY" full="Year-over-Year (Multi-Year)" description="Annual return from 1 to 5 years ago plus all-time. Hover the value to expand." formula="(Price − Priceₙ years ago) ÷ Priceₙ years ago × 100" />
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5 hidden lg:table-cell">
                      <ColHeader label="RVOL (avg)" full="Relative Volume (Average)" description="Today's volume relative to the 7-session average. Above 2x signals elevated activity." formula="Today's Volume ÷ 7D Avg Volume" />
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5 hidden lg:table-cell">
                      <ColHeader label="RVOL (med)" full="Relative Volume (Median)" description="Today's volume relative to the 7-session median. Less sensitive to outlier days than the average." formula="Today's Volume ÷ 7D Median Volume" />
                    </th>
                    <th className="text-right font-medium text-muted-foreground px-2 py-2.5 hidden md:table-cell">
                      <ColHeader label="Last 7d" full="Last 7 Trading Days" description="Sparkline of closing prices over the past 7 completed trading sessions." />
                    </th>
                    <th className="w-16 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {isDataLoading
                    ? symbols.map((symbol, i) => (
                        <tr key={symbol} className="border-b last:border-b-0">
                          <td className="px-2 py-2.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-2.5 font-medium">{symbol}</td>
                          <td className="px-2 py-2.5 text-right"><Skeleton className="h-4 w-24 ml-auto" /></td>
                          <td className="px-2 py-2.5 text-right hidden md:table-cell"><Skeleton className="h-4 w-16 ml-auto" /></td>
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
                          <td className="px-2 py-2.5 text-right hidden lg:table-cell"><Skeleton className="h-4 w-12 ml-auto" /></td>
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
                        const ldcp = ldcpMap.get(symbol) ?? 0
                        const dod = ldcp > 0 && price > 0 ? ((price - ldcp) / ldcp) * 100 : null
                        const isAlerting = alertPrices.has(symbol)
                        const alertEntry = alertPrices.get(symbol)
                        const fmtPrice = (n: number) => n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        return (
                          <tr
                            key={symbol}
                            className="border-b last:border-b-0 group hover:bg-muted/30"
                            style={(() => {
                              const glow = showFetchGlow ? glowingSymbols.get(symbol) : undefined
                              if (glow === "active") return { animation: "fetch-gold-fadein 0.3s ease-out forwards, fetch-gold-spin 1.2s 0.3s linear infinite" }
                              if (glow === "fadeout") return { animation: "fetch-gold-fadeout 0.5s ease-in forwards" }
                              if (flashMap.get(symbol) === "up") return { animation: "price-flash-up 2s ease-out forwards" }
                              if (flashMap.get(symbol) === "down") return { animation: "price-flash-down 2s ease-out forwards" }
                              return undefined
                            })()}
                          >
                            <td className="px-2 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="px-2 py-2.5 font-semibold">{symbol}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums whitespace-nowrap">
                              {price > 0 ? (
                                <>
                                  <span className="font-medium">PKR {fmtPrice(price)}</span>
                                  {dod != null && (
                                    <span className={`ml-1.5 text-sm ${dod >= 0 ? "text-green-500" : "text-red-500"}`}>
                                      ({dod >= 0 ? "+" : ""}{dod.toFixed(2)}%)
                                    </span>
                                  )}
                                </>
                              ) : "-"}
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-sm text-muted-foreground hidden md:table-cell">
                              {ldcp > 0 ? fmtPrice(ldcp) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="px-2 py-2.5 text-right hidden md:table-cell">
                              <HiLo high={lp?.dayHigh ?? 0} low={lp?.dayLow ?? 0} ldcp={ldcp} />
                            </td>
                            <td className="px-2 py-2.5 text-right tabular-nums text-sm">
                              <LastSeenBadge days={daysAtPriceMap.get(symbol) ?? null} />
                            </td>
                            {SHORT_METRIC_KEYS.map((key) => (
                              <td key={key} className="px-1.5 py-2.5 text-right tabular-nums text-sm">
                                <ChangeCell value={metrics?.[key]} />
                              </td>
                            ))}
                            <td className="px-1.5 py-2.5 text-right tabular-nums text-sm">
                              <YoxYCell metrics={metrics} />
                            </td>
                            <td className="px-2 py-2.5 text-right text-sm tabular-nums hidden lg:table-cell">
                              {(() => {
                                const avgVol = volAvgMap.get(symbol) ?? null
                                if (!volume || !avgVol || avgVol === 0) return <span className="text-muted-foreground/40">—</span>
                                const rvol = volume / avgVol
                                const color = rvol >= 2 ? "text-green-500" : rvol >= 1 ? "text-foreground" : "text-muted-foreground"
                                return <span className={color}>{rvol.toFixed(2)}x</span>
                              })()}
                            </td>
                            <td className="px-2 py-2.5 text-right text-sm tabular-nums hidden lg:table-cell">
                              {(() => {
                                const medVol = volMedMap.get(symbol) ?? null
                                if (!volume || !medVol || medVol === 0) return <span className="text-muted-foreground/40">—</span>
                                const rvol = volume / medVol
                                const color = rvol >= 2 ? "text-green-500" : rvol >= 1 ? "text-foreground" : "text-muted-foreground"
                                return <span className={color}>{rvol.toFixed(2)}x</span>
                              })()}
                            </td>
                            <td className="px-2 py-2.5 text-right hidden md:table-cell">
                              <Sparkline points={sparklineMap.get(symbol) ?? []} width={100} />
                            </td>
                            <td className="px-2 py-2.5">
                              <div className="flex items-center justify-end gap-0.5">
                                {isAlerting ? (
                                  <button
                                    onClick={() => removeAlert(symbol)}
                                    className="p-1 rounded-md transition-colors text-yellow-500 hover:text-yellow-400"
                                    title={`Alert active — ref PKR ${alertEntry?.refPrice.toLocaleString("en-PK", { minimumFractionDigits: 2 })} (±${alertEntry?.threshold}%) — click to remove`}
                                  >
                                    <BellRing className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => openAlertDialog(symbol, price)}
                                    className="p-1 rounded-md transition-colors text-muted-foreground/50 hover:text-foreground"
                                    title="Set price alert"
                                  >
                                    <Bell className="h-3.5 w-3.5" />
                                  </button>
                                )}
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

      <Dialog open={!!alertDialog} onOpenChange={(open) => { if (!open) setAlertDialog(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {alertDialog?.symbol === "__all__"
                ? `Alert All — ${symbols.length} symbols`
                : `Set Price Alert — ${alertDialog?.symbol}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Alert threshold (%)</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">±</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.1"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmAlert() }}
                  autoFocus
                />
                <span className="text-muted-foreground">%</span>
              </div>
              {alertDialog?.symbol === "__all__" ? (
                <p className="text-xs text-muted-foreground">Ref price set to current live price for each symbol.</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ref price: PKR {alertDialog?.price.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—"}
                </p>
              )}
            </div>
            <Button className="w-full" onClick={confirmAlert}>
              {alertDialog?.symbol === "__all__" ? `Alert All ${symbols.length} Symbols` : "Set Alert"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
