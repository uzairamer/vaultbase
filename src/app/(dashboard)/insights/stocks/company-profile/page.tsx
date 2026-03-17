"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, AlertCircle, KeyRound, BarChart2 } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts"

const TOKEN_KEY   = "ahltd-token"
const SESSION_KEY = "ahltd-session"

type StatementType = "profile" | "income" | "balance" | "other" | "shareholders" | "fundamentals"
type Interval = "annual" | "quarterly"

const TYPES: { value: StatementType; label: string }[] = [
  { value: "profile",       label: "Profile" },
  { value: "fundamentals",  label: "Fundamentals" },
  { value: "income",        label: "Income" },
  { value: "balance",       label: "Balance Sheet" },
  { value: "other",         label: "Other" },
  { value: "shareholders",  label: "Shareholders" },
]

// Types that support quarterly interval
const INTERVAL_TYPES: StatementType[] = ["income", "balance", "other", "fundamentals"]

// ─── API types ───────────────────────────────────────────────────────────────

interface Period {
  year: string
  quarter?: string
  period_end: string
}

interface Field {
  label: string
  key: string | null
  values: (number | null)[]
  is_heading: boolean
}

interface StatementData {
  symbol: string
  type: string
  interval: string
  periods: Period[]
  fields: Field[]
}

interface ProfileData {
  symbol: string
  name: string
  sector_name: string
  description: string
  website?: string
  employees?: number
  year_end?: string
  par_value?: number
  auditors?: string
  people?: { position: string; name: string }[]
  offices?: string[]
  factories?: string[]
  registrar?: string[]
  capacity?: string[]
  capacity_util?: string[]
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtPeriod(p: Period): string {
  return p.quarter ? `${p.year} ${p.quarter}` : p.year
}

// Financial statement types report values in PKR thousands — scale up before formatting
const THOUSANDS_TYPES: StatementType[] = ["income", "balance", "other"]

function fmtNumber(v: number | null | undefined, type: StatementType): string {
  if (v === null || v === undefined || !isFinite(v)) return "—"
  if (type === "shareholders") {
    return `${(v * 100).toFixed(2)}%`
  }
  if (type === "fundamentals") {
    // Ratio-like values (margin, yield, etc.)
    if (Math.abs(v) < 10 && v !== 0 && !Number.isInteger(v)) {
      return v.toFixed(2)
    }
  }
  // Scale PKR thousands → actual rupees so B/M/K thresholds are correct
  const scaled = THOUSANDS_TYPES.includes(type) ? v * 1_000 : v
  const abs = Math.abs(scaled)
  if (abs >= 1_000_000_000) return `${(scaled / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000)     return `${(scaled / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)         return `${(scaled / 1_000).toFixed(1)}K`
  return scaled.toLocaleString("en-PK", { maximumFractionDigits: 2 })
}

function isPositive(v: number | null | undefined): boolean | null {
  if (v === null || v === undefined || v === 0) return null
  return v > 0
}

// ─── Chart Dialog ─────────────────────────────────────────────────────────────

interface ChartEntry {
  label: string
  periods: Period[]
  values: (number | null)[]
  type: StatementType
}

const CHART_POS  = "#4ade80"   // green-400 — vibrant, visible in dark + light
const CHART_NEG  = "#f87171"   // red-400
const CHART_LINE = "#60a5fa"   // blue-400
const CHART_GRID = "rgba(148,163,184,0.15)"  // slate-400/15
const CHART_TICK = "#94a3b8"   // slate-400

function FieldChart({ entry, open, onClose }: {
  entry: ChartEntry
  open: boolean
  onClose: () => void
}) {
  // Reverse so oldest period is on the left (natural time direction)
  const chartData = [...entry.periods].reverse().map((p, i) => ({
    period: fmtPeriod(p),
    value: entry.values[entry.periods.length - 1 - i] ?? null,
  })).filter((d) => d.value !== null)

  const values = chartData.map((d) => d.value as number)
  const hasNeg = values.some((v) => v < 0)
  const allRatio = entry.type === "shareholders" || (entry.type === "fundamentals" && values.every((v) => Math.abs(v) <= 10))

  const fmt = (v: number) => fmtNumber(v, entry.type)

  const positiveCount = values.filter((v) => v >= 0).length
  const negativeCount = values.length - positiveCount

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[90vw] p-0 overflow-hidden">
        {/* Header with gradient accent */}
        <div className="px-6 pt-5 pb-4 border-b border-border/50 bg-gradient-to-r from-blue-500/5 to-transparent">
          <DialogTitle className="text-sm font-semibold text-foreground">{entry.label}</DialogTitle>
          <div className="flex gap-4 mt-2">
            <span className="text-xs text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-[#4ade80] mr-1.5" />
              {positiveCount} positive
            </span>
            <span className="text-xs text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-[#f87171] mr-1.5" />
              {negativeCount} negative
            </span>
            <span className="text-xs text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-[#60a5fa] mr-1.5" />
              Trend
            </span>
          </div>
        </div>
        <div className="h-[420px] px-4 py-5">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 36, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 11, fill: CHART_TICK }}
                angle={-40}
                textAnchor="end"
                interval="preserveStartEnd"
                axisLine={{ stroke: CHART_GRID }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={allRatio ? (v) => `${(v * (entry.type === "shareholders" ? 100 : 1)).toFixed(1)}` : fmt}
                tick={{ fontSize: 11, fill: CHART_TICK }}
                width={72}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: number) => [fmt(v), entry.label]}
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: "8px",
                  fontSize: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  padding: "8px 12px",
                }}
                labelStyle={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}
                itemStyle={{ color: "#94a3b8" }}
                cursor={{ fill: "rgba(148,163,184,0.06)" }}
              />
              {hasNeg && (
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.4)" strokeWidth={1} strokeDasharray="4 2" />
              )}
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={(d.value as number) >= 0 ? CHART_POS : CHART_NEG}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
              <Line
                dataKey="value"
                type="monotone"
                stroke={CHART_LINE}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: CHART_LINE, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Statement Table ─────────────────────────────────────────────────────────

function StatementTable({ data, type }: { data: StatementData; type: StatementType }) {
  const { periods, fields } = data
  const [activeChart, setActiveChart] = useState<ChartEntry | null>(null)

  if (!fields?.length || !periods?.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No data available.</p>
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/80 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground min-w-[220px]">
                Metric
              </th>
              {periods.map((p, i) => (
                <th
                  key={i}
                  className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap min-w-[90px]"
                >
                  <div>{fmtPeriod(p)}</div>
                  <div className="font-normal opacity-60">{p.period_end?.slice(0, 7)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field, fi) => {
              if (field.is_heading) {
                return (
                  <tr key={fi} className="border-t-2 border-border/60">
                    <td
                      colSpan={periods.length + 1}
                      className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/30"
                    >
                      {field.label}
                    </td>
                  </tr>
                )
              }

              const hasData = field.values?.some((v) => v !== null && v !== undefined)

              return (
                <tr key={fi} className="border-b border-border/30 hover:bg-muted/20 transition-colors group">
                  {/* Label + chart button */}
                  <td className="sticky left-0 z-10 bg-card px-3 py-2 border-r border-border/20">
                    <div className="flex items-center gap-1.5 min-w-[200px] max-w-[260px]">
                      <span className="text-sm font-medium truncate flex-1">{field.label}</span>
                      {hasData && (
                        <button
                          onClick={() => setActiveChart({ label: field.label, periods, values: field.values, type })}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                          title={`Chart: ${field.label}`}
                        >
                          <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </td>
                  {periods.map((_, pi) => {
                    const val = field.values?.[pi] ?? null
                    const pos = isPositive(val)
                    return (
                      <td
                        key={pi}
                        className={cn(
                          "px-3 py-2 text-right tabular-nums text-sm",
                          pos === true  && "text-green-600 dark:text-green-400",
                          pos === false && "text-red-600 dark:text-red-400",
                          pos === null  && "text-muted-foreground"
                        )}
                      >
                        {fmtNumber(val, type)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {activeChart && (
        <FieldChart
          entry={activeChart}
          open={!!activeChart}
          onClose={() => setActiveChart(null)}
        />
      )}
    </>
  )
}

// ─── Profile Layout ──────────────────────────────────────────────────────────

function ProfileView({ data }: { data: ProfileData }) {
  const infoFields: [string, string | number | undefined][] = [
    ["Sector",     data.sector_name],
    ["Year End",   data.year_end],
    ["Par Value",  data.par_value != null ? `PKR ${data.par_value}` : undefined],
    ["Employees",  data.employees?.toLocaleString("en-PK")],
    ["Auditors",   data.auditors],
    ["Website",    data.website],
  ]

  return (
    <div className="space-y-6">
      {/* About */}
      {data.description && (
        <div className="rounded-lg border p-4 bg-muted/10">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">About</p>
          <p className="text-sm leading-relaxed">{data.description}</p>
        </div>
      )}

      {/* Key info grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {infoFields.filter(([, v]) => v != null && v !== "").map(([label, value]) => (
          <div key={label} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* People */}
      {data.people && data.people.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Management</p>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Position</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Name</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.people.map((p, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground">{p.position}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Offices / Factories / Registrar */}
      {[
        ["Offices",    data.offices],
        ["Factories",  data.factories],
        ["Registrar",  data.registrar],
        ["Capacity",   data.capacity],
        ["Utilisation",data.capacity_util],
      ].map(([title, items]) =>
        items && (items as string[]).length > 0 ? (
          <div key={title as string}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title as string}</p>
            <ul className="space-y-1">
              {(items as string[]).map((item, i) => (
                <li key={i} className="text-sm rounded-lg border px-3 py-2 bg-muted/10 whitespace-pre-line">{item}</li>
              ))}
            </ul>
          </div>
        ) : null
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CompanyProfilePage() {
  const [symbolInput, setSymbolInput]   = useState("")
  const [activeSymbol, setActiveSymbol] = useState("")
  const [activeType, setActiveType]     = useState<StatementType>("profile")
  const [interval, setInterval]         = useState<Interval>("annual")
  const [token, setToken]               = useState<string | null>(null)
  const [sessionCookie, setSessionCookie] = useState<string | null>(null)

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY))
    setSessionCookie(localStorage.getItem(SESSION_KEY))
  }, [])

  const hasCredentials  = !!token && !!sessionCookie
  const showInterval    = INTERVAL_TYPES.includes(activeType)

  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ["company-statement", activeSymbol, activeType, showInterval ? interval : "annual"],
    queryFn: async () => {
      const iv = showInterval ? interval : "annual"
      const res = await fetch(
        `/api/insights/company-statement?symbol=${encodeURIComponent(activeSymbol)}&type=${activeType}&interval=${iv}`,
        { headers: { "x-api-token": token!, "x-api-session": sessionCookie! } }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error || `Error ${res.status}`)
      }
      return res.json()
    },
    enabled: !!activeSymbol && hasCredentials,
    staleTime: 5 * 60 * 1000,
  })

  // Unwrap { status, data: { ... } }
  const payload = rawData?.data ?? rawData

  function handleSearch() {
    const sym = symbolInput.trim().toUpperCase()
    if (!sym) return
    setActiveSymbol(sym)
  }

  return (
    <div>
      <PageHeader
        title="Company Profile"
        description="Financial statements and company data from Arif Habib Securities"
      />

      {!hasCredentials && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm">
          <KeyRound className="h-4 w-4 mt-0.5 shrink-0 text-yellow-500" />
          <div>
            <p className="font-medium text-yellow-600 dark:text-yellow-400">Credentials not configured</p>
            <p className="text-muted-foreground mt-0.5">
              Add your Bearer token and session cookie in{" "}
              <Link href="/settings/configs" className="text-primary underline-offset-2 hover:underline">
                Settings → Configs
              </Link>.
            </p>
          </div>
        </div>
      )}

      {/* Symbol search */}
      <div className="flex gap-2 mb-6 max-w-sm">
        <Input
          placeholder="Symbol, e.g. SAZEW"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch() }}
          className="font-mono"
        />
        <Button onClick={handleSearch} disabled={!symbolInput.trim() || !hasCredentials}>
          <Search className="h-4 w-4 mr-1.5" />
          Search
        </Button>
      </div>

      {activeSymbol && (
        <Card>
          <CardHeader className="pb-3 space-y-3">
            {/* Title + interval toggle row */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base font-mono text-primary">{activeSymbol}</CardTitle>

              {showInterval && (
                <div className="flex rounded-lg border overflow-hidden text-sm shrink-0">
                  {(["annual", "quarterly"] as Interval[]).map((iv) => (
                    <button
                      key={iv}
                      onClick={() => setInterval(iv)}
                      className={cn(
                        "px-3 py-1.5 capitalize transition-colors",
                        interval === iv
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {iv}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type tabs */}
            <div className="flex gap-1 flex-wrap">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setActiveType(t.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    activeType === t.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent>
            {isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">Failed to load data</p>
                  <p className="text-muted-foreground mt-0.5">{(error as Error).message}</p>
                </div>
              </div>
            )}

            {!isLoading && !error && payload && (
              activeType === "profile"
                ? <ProfileView data={payload as ProfileData} />
                : <StatementTable data={payload as StatementData} type={activeType} />
            )}

            {!isLoading && !error && !payload && (
              <p className="text-sm text-muted-foreground text-center py-8">No data returned.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
