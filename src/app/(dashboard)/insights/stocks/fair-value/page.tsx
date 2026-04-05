"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, KeyRound, TrendingUp, TrendingDown, Minus } from "lucide-react"
import Link from "next/link"
import { cn, formatCurrency } from "@/lib/utils"
import { fetchStockHistory } from "@/modules/insights/hooks"
import type { HistoryPeriod } from "@/modules/insights/hooks"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from "recharts"

const TOKEN_KEY   = "ahltd-token"
const SESSION_KEY = "ahltd-session"

type Period = "ytd" | "1y" | "3y" | "max"

const PERIODS: { value: Period; label: string }[] = [
  { value: "ytd", label: "YTD" },
  { value: "1y",  label: "1Y"  },
  { value: "3y",  label: "3Y"  },
  { value: "max", label: "Max" },
]

// Reference P/E bands with color zones
const PE_REFS = [
  { value: 5,  label: "5×",  color: "#22c55e" },
  { value: 10, label: "10×", color: "#84cc16" },
  { value: 15, label: "15×", color: "#f59e0b" },
  { value: 20, label: "20×", color: "#f97316" },
  { value: 25, label: "25×", color: "#ef4444" },
  { value: 30, label: "30×", color: "#dc2626" },
]

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface PePoint {
  date: string
  timestamp: number
  price: number
  ttmEps: number
  pe: number
}

function PeTooltip({ active, payload }: {
  active?: boolean
  payload?: { payload: PePoint }[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const zone = PE_REFS.slice().reverse().find((r) => d.pe >= r.value)
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f172a] shadow-2xl p-3.5 text-xs min-w-[200px] space-y-2">
      <p className="text-slate-400 font-medium">{d.date}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">P/E Ratio</span>
          <span className="font-bold tabular-nums" style={{ color: zone?.color ?? "#94a3b8" }}>
            {d.pe.toFixed(2)}×
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Price</span>
          <span className="text-white font-medium tabular-nums">{formatCurrency(d.price)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">TTM EPS</span>
          <span className="text-white font-medium tabular-nums">{formatCurrency(d.ttmEps)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type EpsInterval = "annual" | "quarterly-ttm" | "quarterly"

const EPS_INTERVAL_OPTIONS: { value: EpsInterval; label: string }[] = [
  { value: "annual",        label: "Annual" },
  { value: "quarterly-ttm", label: "Quarterly TTM" },
  { value: "quarterly",     label: "Quarterly" },
]

export default function FairValuePage() {
  const [input, setInput]           = useState("")
  const [symbol, setSymbol]         = useState("")
  const [period, setPeriod]         = useState<Period>("1y")
  const [epsInterval, setEpsInterval] = useState<EpsInterval>("annual")
  const [token, setToken]           = useState<string | null>(null)
  const [session, setSession]       = useState<string | null>(null)

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY))
    setSession(localStorage.getItem(SESSION_KEY))
  }, [])

  const noCredentials = !token || !session

  // ── Income statement ──────────────────────────────────────────────────────
  const { data: incomeData, isLoading: incomeLoading, error: incomeError } = useQuery({
    queryKey: ["fair-value-income", symbol, epsInterval, token, session],
    queryFn: async () => {
      const apiInterval = epsInterval === "annual" ? "annual" : "quarterly"
      const res = await fetch(
        `/api/insights/company-statement?symbol=${encodeURIComponent(symbol)}&interval=${apiInterval}&type=income`,
        { headers: { "x-api-token": token!, "x-api-session": session! } }
      )
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Failed") }
      return res.json()
    },
    enabled: !!symbol && !noCredentials,
    staleTime: 30 * 60 * 1000,
    retry: false,
  })

  // ── Price history ─────────────────────────────────────────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["fair-value-history", symbol, period],
    queryFn: () => fetchStockHistory(symbol, period as HistoryPeriod),
    enabled: !!symbol,
    staleTime: 5 * 60 * 1000,
  })

  // ── EPS extraction ────────────────────────────────────────────────────────
  const ttmSeries = useMemo(() => {
    const payload = incomeData?.data
    if (!payload?.fields || !payload?.periods) return []

    type Field = { label: string; key: string | null; values: (number | null)[]; is_heading: boolean }
    const fields = payload.fields as Field[]

    const epsField = fields.find((f) => f.key === "eps")
      ?? fields.find((f) => /\beps\b/i.test(f.label))

    if (!epsField) return []

    // Build raw array sorted ascending, skipping the TTM stub period
    const raw = (payload.periods as { period_end: string; year: string }[])
      .map((p, i) => ({
        periodEndMs: new Date(p.period_end).getTime(),
        eps: epsField.values[i] as number,
        year: p.year,
      }))
      .filter((r) => r.year !== "TTM" && r.eps !== null && r.eps !== undefined && isFinite(r.eps))
      .sort((a, b) => a.periodEndMs - b.periodEndMs)

    if (epsInterval === "annual") {
      // Annual: each period is a full year — use directly, skip negatives
      return raw
        .filter((r) => r.eps > 0)
        .map((r) => ({ periodEndMs: r.periodEndMs, ttmEps: r.eps, year: r.year }))
    } else if (epsInterval === "quarterly-ttm") {
      // TTM: sum of last 4 quarters
      return raw
        .map((_, i) => {
          if (i < 3) return null
          const ttm = raw.slice(i - 3, i + 1).reduce((s, r) => s + r.eps, 0)
          if (ttm <= 0) return null
          return { periodEndMs: raw[i].periodEndMs, ttmEps: ttm, year: raw[i].year }
        })
        .filter(Boolean) as { periodEndMs: number; ttmEps: number; year: string }[]
    } else {
      // Raw quarterly EPS — use each quarter's EPS directly
      return raw
        .filter((r) => r.eps > 0)
        .map((r) => ({ periodEndMs: r.periodEndMs, ttmEps: r.eps, year: r.year }))
    }
  }, [incomeData, epsInterval])

  // ── Build P/E time series ─────────────────────────────────────────────────
  const peData: PePoint[] = useMemo(() => {
    if (!historyData?.data?.length || !ttmSeries.length) return []

    const result: PePoint[] = []

    for (const pt of historyData.data) {
      const priceMs = pt.timestamp * 1000

      // Find the most recent TTM EPS that was published on or before this date
      let ttmEps: number | null = null
      for (const t of ttmSeries) {
        if (t.periodEndMs <= priceMs) ttmEps = t.ttmEps
        else break
      }

      if (ttmEps === null || ttmEps <= 0) continue  // no EPS yet, or loss-making

      result.push({
        date:      pt.date,
        timestamp: pt.timestamp,
        price:     pt.close,
        ttmEps,
        pe:        pt.close / ttmEps,
      })
    }

    return result
  }, [historyData, ttmSeries])

  // ── EPS change markers (nearest price point to each period_end) ──────────
  const epsMarkers = useMemo(() => {
    if (!peData.length || !ttmSeries.length) return []
    return ttmSeries
      .map((t) => {
        // Find the nearest peData point to this period end
        let nearest = peData[0]
        let minDiff = Math.abs(peData[0].timestamp * 1000 - t.periodEndMs)
        for (const p of peData) {
          const diff = Math.abs(p.timestamp * 1000 - t.periodEndMs)
          if (diff < minDiff) { minDiff = diff; nearest = p }
        }
        // Only show if the period boundary falls within the visible range (allow 90 day slop)
        if (minDiff > 90 * 86400 * 1000) return null
        return { date: nearest.date, eps: t.ttmEps, year: t.year }
      })
      .filter(Boolean) as { date: string; eps: number; year: string }[]
  }, [peData, ttmSeries])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!peData.length) return null
    const values  = peData.map((p) => p.pe)
    const current = values[values.length - 1]
    const avg     = values.reduce((s, v) => s + v, 0) / values.length
    const min     = Math.min(...values)
    const max     = Math.max(...values)
    const vsAvg   = ((current - avg) / avg) * 100
    return { current, avg, min, max, vsAvg }
  }, [peData])

  const isLoading = incomeLoading || historyLoading

  // ── Gradient color based on current P/E ──────────────────────────────────
  const currentPe   = stats?.current ?? 0
  const lineColor   = currentPe > 25 ? "#ef4444" : currentPe > 15 ? "#f59e0b" : "#22c55e"

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input.trim()) setSymbol(input.trim().toUpperCase())
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fair Value"
        description="Price-to-Earnings ratio over time — spot when a stock is cheap or expensive"
      />

      {/* Credentials warning */}
      {noCredentials && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <KeyRound className="h-4 w-4 shrink-0" />
          <span>
            API credentials required.{" "}
            <Link href="/settings/configs" className="underline font-medium">Configure in Settings → Configs</Link>
          </span>
        </div>
      )}

      {/* Symbol search */}
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm">
        <Input
          placeholder="e.g. SAZEW"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          className="font-mono uppercase"
          disabled={noCredentials}
        />
        <Button type="submit" disabled={noCredentials || !input.trim()}>
          <Search className="h-4 w-4 mr-1.5" /> Analyse
        </Button>
      </form>

      {!symbol && (
        <div className="flex items-center justify-center h-64 rounded-xl border border-dashed border-border text-muted-foreground text-sm">
          Enter a stock symbol to view its P/E history
        </div>
      )}

      {symbol && (incomeError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500">
          Failed to load income statement. Check credentials or try a different symbol.
        </div>
      ) : (
        <>
          {/* Period + EPS interval tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-muted-foreground">{symbol} — P/E Ratio</p>
            <div className="flex items-center gap-2">
              {/* EPS interval toggle */}
              <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium">
                {EPS_INTERVAL_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setEpsInterval(value)}
                    className={cn(
                      "px-3 py-1 transition-colors",
                      epsInterval === value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Price period */}
              <div className="flex gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPeriod(p.value)}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                      period === p.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stats cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Current P/E",
                  value: `${stats.current.toFixed(2)}×`,
                  sub: stats.vsAvg >= 0
                    ? `+${stats.vsAvg.toFixed(1)}% vs avg`
                    : `${stats.vsAvg.toFixed(1)}% vs avg`,
                  icon: stats.vsAvg >= 0 ? TrendingUp : TrendingDown,
                  accent: currentPe > 25 ? "#ef4444" : currentPe > 15 ? "#f59e0b" : "#22c55e",
                },
                {
                  label: "Average P/E",
                  value: `${stats.avg.toFixed(2)}×`,
                  icon: Minus,
                  accent: "#6366f1",
                },
                {
                  label: "Min P/E",
                  value: `${stats.min.toFixed(2)}×`,
                  icon: TrendingDown,
                  accent: "#22c55e",
                },
                {
                  label: "Max P/E",
                  value: `${stats.max.toFixed(2)}×`,
                  icon: TrendingUp,
                  accent: "#ef4444",
                },
              ].map(({ label, value, sub, icon: Icon, accent }) => (
                <div key={label} className="rounded-xl border p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3 w-3" style={{ color: accent }} />
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                  </div>
                  <p className="text-lg font-bold tabular-nums" style={{ color: accent }}>{value}</p>
                  {sub && <p className="text-[10px] text-muted-foreground tabular-nums">{sub}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Price / {epsInterval === "annual" ? "Annual" : epsInterval === "quarterly-ttm" ? "TTM" : "Quarterly"} Earnings</span>
                {ttmSeries.length > 0 && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {ttmSeries.length} {EPS_INTERVAL_OPTIONS.find(o => o.value === epsInterval)?.label} EPS periods
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-72 rounded-xl bg-muted/40 animate-pulse" />
              ) : peData.length === 0 ? (
                <div className="flex flex-col gap-3 py-6 text-sm">
                  {ttmSeries.length === 0 ? (
                    <>
                      <p className="text-muted-foreground">Could not find EPS field automatically. Available income statement fields:</p>
                      <div className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
                        {incomeData?.data?.fields
                          ? (incomeData.data.fields as { label: string; key: string }[])
                              .map((f, i) => <div key={i} className="text-muted-foreground">{f.label} ({f.key})</div>)
                          : <div className="text-muted-foreground">No fields returned</div>
                        }
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center">No P/E data available for this period (EPS may be negative for part of the period).</p>
                  )}
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={340}>
                    <AreaChart data={peData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="peGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor={lineColor} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        minTickGap={60}
                      />
                      <YAxis
                        tickFormatter={(v: number) => `${v.toFixed(0)}×`}
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                      />
                      <Tooltip content={<PeTooltip />} cursor={{ stroke: "rgba(148,163,184,0.3)", strokeWidth: 1 }} />

                      {/* P/E reference bands */}
                      {PE_REFS.map((r) => (
                        <ReferenceLine
                          key={r.value}
                          y={r.value}
                          stroke={r.color}
                          strokeDasharray="4 3"
                          strokeWidth={1}
                          strokeOpacity={0.5}
                          label={{ value: r.label, position: "insideTopRight", fontSize: 9, fill: r.color, dy: -4 }}
                        />
                      ))}

                      {/* Average P/E reference */}
                      {stats && (
                        <ReferenceLine
                          y={stats.avg}
                          stroke="#6366f1"
                          strokeDasharray="6 3"
                          strokeWidth={1.5}
                          label={{ value: `Avg ${stats.avg.toFixed(1)}×`, position: "insideTopRight", fontSize: 9, fill: "#6366f1", dy: -4 }}
                        />
                      )}

                      {/* EPS change markers */}
                      {epsMarkers.map((m, i) => (
                        <ReferenceLine
                          key={i}
                          x={m.date}
                          stroke="#e2e8f0"
                          strokeDasharray="3 3"
                          strokeWidth={1}
                          strokeOpacity={0.5}
                          label={{
                            value: `EPS ${m.eps.toFixed(2)}`,
                            position: "insideTopLeft",
                            fontSize: 9,
                            fill: "#94a3b8",
                            angle: -90,
                            dy: 2,
                            dx: -2,
                          }}
                        />
                      ))}

                      <Area
                        type="monotone"
                        dataKey="pe"
                        stroke={lineColor}
                        strokeWidth={2}
                        fill="url(#peGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: lineColor, stroke: "white", strokeWidth: 2 }}
                        connectNulls={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* P/E band legend */}
                  <div className="flex flex-wrap items-center gap-3 mt-3 px-1">
                    {PE_REFS.map((r) => (
                      <div key={r.value} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="h-2 w-4 rounded-sm" style={{ background: r.color, opacity: 0.6 }} />
                        {r.label}
                      </div>
                    ))}
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="h-px w-4 bg-indigo-500" style={{ display: "inline-block" }} />
                      Average
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* EPS table */}
          {ttmSeries.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {EPS_INTERVAL_OPTIONS.find(o => o.value === epsInterval)?.label} EPS History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/50">
                  {[...ttmSeries].reverse().slice(0, 8).map((t, i) => (
                    <div key={i} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-muted-foreground">
                        {new Date(t.periodEndMs).toLocaleDateString("en-PK", { year: "numeric", month: "short" })}
                      </span>
                      <div className="flex items-center gap-6">
                        <span className={cn("font-semibold tabular-nums", t.ttmEps >= 0 ? "text-emerald-500" : "text-red-500")}>
                          EPS: {t.ttmEps.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ))}
    </div>
  )
}
