"use client"

import { useState, useMemo } from "react"
import { useWallets, useMonthlyClosings, useCloseMonth } from "@/modules/expenses/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/shared/empty-state"
import { CalendarCheck, TrendingDown, TrendingUp, CheckCircle2, LineChart as LineChartIcon } from "lucide-react"
import { formatCurrency, formatCompact, cn } from "@/lib/utils"
import { toast } from "sonner"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// Validated categorical order (dataviz skill) — passes CVD-separation and
// normal-vision-floor checks for up to 8 series; the contrast WARN on a few
// slots is covered by the legend + tooltip labels this chart always ships.
const WALLET_TREND_COLORS = [
  "#2a78d6", "#eb6834", "#1baf7a", "#eda100",
  "#e87ba4", "#008300", "#4a3aa7", "#e34948",
]
const TOTAL_LINE_COLOR = "#64748b"

interface WalletData {
  id: string
  name: string
  type: string
  balance: number | string
}

interface ClosingData {
  id: string
  walletId: string
  year: number
  month: number
  openingBalance: number | string
  closingBalance: number | string
  income: number | string
  transfersIn: number | string
  transfersOut: number | string
  trackedSpend: number | string
  residual: number | string
  wallet: { id: string; name: string; type: string }
}

function monthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function SpendFigure({ residual, trackedSpend }: { residual: number; trackedSpend: number }) {
  if (residual < -0.01) {
    return (
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Net Inflow (unexplained)</p>
        <p className="text-base font-semibold tabular-nums text-blue-500">+{formatCurrency(Math.abs(residual))}</p>
      </div>
    )
  }
  const totalSpend = trackedSpend + Math.max(residual, 0)
  return (
    <div className="text-right">
      <p className="text-xs text-muted-foreground">Spend</p>
      <p className="text-base font-semibold tabular-nums text-red-500">{formatCurrency(totalSpend)}</p>
    </div>
  )
}

function ClosingRow({ c }: { c: ClosingData }) {
  const opening = Number(c.openingBalance)
  const closing = Number(c.closingBalance)
  const income = Number(c.income)
  const transfersIn = Number(c.transfersIn)
  const transfersOut = Number(c.transfersOut)
  const trackedSpend = Number(c.trackedSpend)
  const residual = Number(c.residual)
  const netTransfer = transfersIn - transfersOut

  return (
    <div className="flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{c.wallet.name}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>Opening <span className="tabular-nums text-foreground">{formatCurrency(opening)}</span></span>
          {income > 0 && <span className="text-green-500">+Income <span className="tabular-nums">{formatCurrency(income)}</span></span>}
          {netTransfer !== 0 && (
            <span>{netTransfer > 0 ? "+" : ""}Transfer <span className="tabular-nums">{formatCurrency(netTransfer)}</span></span>
          )}
          {trackedSpend > 0 && <span>Tracked <span className="tabular-nums">{formatCurrency(trackedSpend)}</span></span>}
          <span>Closing <span className="tabular-nums text-foreground">{formatCurrency(closing)}</span></span>
        </div>
      </div>
      <SpendFigure residual={residual} trackedSpend={trackedSpend} />
    </div>
  )
}

export default function MonthlyClosingPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [inputs, setInputs] = useState<Record<string, string>>({})

  const { data: wallets = [] } = useWallets()
  const { data: monthClosings = [], isLoading } = useMonthlyClosings({ year, month })
  const { data: allClosings = [] } = useMonthlyClosings()
  const closeMonth = useCloseMonth()

  const walletList = wallets as WalletData[]
  const closingsThisMonth = monthClosings as ClosingData[]
  const closedWalletIds = new Set(closingsThisMonth.map((c) => c.walletId))
  const openWallets = walletList.filter((w) => !closedWalletIds.has(w.id))

  const history = useMemo(() => {
    const groups = new Map<string, ClosingData[]>()
    for (const c of allClosings as ClosingData[]) {
      const key = `${c.year}-${c.month}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(c)
    }
    return Array.from(groups.entries())
      .map(([key, items]) => {
        const [y, m] = key.split("-").map(Number)
        return { year: y, month: m, items }
      })
      .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))
  }, [allClosings])

  const trend = useMemo(() => {
    const byMonth = new Map<string, { label: string; sortKey: number; values: Record<string, number> }>()
    const walletsSeen = new Map<string, string>()
    for (const c of allClosings as ClosingData[]) {
      const key = `${c.year}-${c.month}`
      if (!byMonth.has(key)) {
        byMonth.set(key, { label: `${MONTH_NAMES[c.month - 1].slice(0, 3)} ${c.year}`, sortKey: c.year * 12 + c.month, values: {} })
      }
      byMonth.get(key)!.values[c.walletId] = Number(c.closingBalance)
      walletsSeen.set(c.walletId, c.wallet.name)
    }
    const rows = Array.from(byMonth.values()).sort((a, b) => a.sortKey - b.sortKey)
    const data = rows.map((r) => ({
      month: r.label,
      __total: Object.values(r.values).reduce((s, v) => s + v, 0),
      ...r.values,
    }))
    const wallets = Array.from(walletsSeen.entries()).map(([id, name]) => ({ id, name }))
    return { data, wallets }
  }, [allClosings])

  function combinedResidual(items: ClosingData[]) {
    return items.reduce((sum, c) => sum + Number(c.residual), 0)
  }
  function combinedTracked(items: ClosingData[]) {
    return items.reduce((sum, c) => sum + Number(c.trackedSpend), 0)
  }

  function monthOptions() {
    const opts: { year: number; month: number }[] = []
    let y = now.getFullYear()
    let m = now.getMonth() + 1
    for (let i = 0; i < 13; i++) {
      opts.push({ year: y, month: m })
      m -= 1
      if (m === 0) { m = 12; y -= 1 }
    }
    return opts
  }

  function handleClose(walletId: string) {
    const raw = inputs[walletId]
    const closingBalance = Number(raw)
    if (raw === undefined || raw === "" || isNaN(closingBalance)) {
      toast.error("Enter a closing balance")
      return
    }
    closeMonth.mutate(
      { walletId, year, month, closingBalance },
      {
        onSuccess: () => {
          setInputs((prev) => { const next = { ...prev }; delete next[walletId]; return next })
          toast.success("Month closed")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Closing"
        description="Enter each wallet's real balance once a month — spend gets worked out for you."
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarCheck className="h-4 w-4" />
                {monthLabel(year, month)}
              </CardTitle>
              <CardDescription>Close each wallet for this month</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {monthOptions().slice(0, 6).map((opt) => (
                <Button
                  key={`${opt.year}-${opt.month}`}
                  size="sm"
                  variant={opt.year === year && opt.month === month ? "default" : "outline"}
                  onClick={() => { setYear(opt.year); setMonth(opt.month) }}
                >
                  {MONTH_NAMES[opt.month - 1].slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : walletList.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No wallets yet" description="Add a wallet first to start closing months." />
          ) : (
            <>
              {openWallets.map((w) => (
                <div key={w.id} className="flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-muted-foreground">Current on record: {formatCurrency(Number(w.balance))}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Closing balance"
                      className="h-9 w-40"
                      value={inputs[w.id] ?? ""}
                      onChange={(e) => setInputs((prev) => ({ ...prev, [w.id]: e.target.value }))}
                    />
                    <Button size="sm" disabled={closeMonth.isPending} onClick={() => handleClose(w.id)}>
                      Close
                    </Button>
                  </div>
                </div>
              ))}
              {closingsThisMonth.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0 gap-1 text-green-600 border-green-500/30 bg-green-500/5">
                    <CheckCircle2 className="h-3 w-3" /> Closed
                  </Badge>
                  <div className="flex-1"><ClosingRow c={c} /></div>
                </div>
              ))}
              {openWallets.length === 0 && closingsThisMonth.length > 0 && (
                <p className="text-sm text-muted-foreground">All wallets closed for {monthLabel(year, month)}.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChartIcon className="h-4 w-4" />
            Balance Trend
          </CardTitle>
          <CardDescription>Closing balance per wallet, by month</CardDescription>
        </CardHeader>
        <CardContent>
          {trend.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Close your first month to start seeing a trend here.</p>
          ) : (
            <div className="min-w-0">
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={trend.data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-xs" />
                  <YAxis tick={{ fontSize: 11 }} className="text-xs" width={60} tickFormatter={(v: number) => formatCompact(v)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {trend.wallets.map((w, i) => (
                    <Line
                      key={w.id}
                      type="monotone"
                      dataKey={w.id}
                      name={w.name}
                      stroke={WALLET_TREND_COLORS[i % WALLET_TREND_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="__total"
                    name="Total"
                    stroke={TOTAL_LINE_COLOR}
                    strokeWidth={2.5}
                    strokeDasharray="4 3"
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">History</CardTitle>
          <CardDescription>Past closed months, combined across wallets</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No months closed yet.</p>
          ) : (
            <div className="space-y-5">
              {history.map(({ year: y, month: m, items }) => {
                const residual = combinedResidual(items)
                const tracked = combinedTracked(items)
                const isInflow = residual < -0.01
                return (
                  <div key={`${y}-${m}`} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{monthLabel(y, m)}</h3>
                      <div className="flex items-center gap-1.5">
                        {isInflow ? (
                          <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                        )}
                        <span className={cn("text-sm font-semibold tabular-nums", isInflow ? "text-blue-500" : "text-red-500")}>
                          {isInflow ? "+" : ""}{formatCurrency(isInflow ? Math.abs(residual) : tracked + Math.max(residual, 0))}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((c) => <ClosingRow key={c.id} c={c} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
