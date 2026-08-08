"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { formatCurrency, formatCompact, formatPercent, cn } from "@/lib/utils"
import { totalStocksValue } from "@/lib/stocks"
import { StatCard } from "@/components/shared/stat-card"
import {
  Wallet,
  Building2,
  BarChart3,
  Gem,
  Briefcase,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/shared/page-header"
import Link from "next/link"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"

function useCountUp(target: number, duration = 900) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (target === 0) { setCurrent(0); return }
    const startTime = performance.now()
    const step = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCurrent(Math.round(target * eased))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration])
  return current
}

async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { data: receivablesData } = useQuery({ queryKey: ["receivables"], queryFn: () => fetcher("/api/expenses/receivables") })
  const { data: liabilitiesData } = useQuery({ queryKey: ["liabilities"], queryFn: () => fetcher("/api/expenses/liabilities") })
  const { data: insightsData, isLoading } = useQuery({ queryKey: ["insights"], queryFn: () => fetcher("/api/insights") })

  const d = (insightsData || {}) as Record<string, Record<string, unknown>[]>
  const wallets = (d.wallets || []) as Record<string, unknown>[]
  const properties = (d.properties || []) as Record<string, unknown>[]
  const stocks = (d.stocks || []) as Record<string, unknown>[]
  const commodities = (d.commodities || []) as Record<string, unknown>[]
  const sideInvestments = (d.sideInvestments || []) as Record<string, unknown>[]
  const receivables = (receivablesData || []) as Record<string, unknown>[]
  const liabilities = (liabilitiesData || []) as Record<string, unknown>[]

  const walletBalance = wallets.reduce((sum, w) => sum + Number(w.balance), 0)
  const realEstateValue = properties.reduce((sum, p) => sum + Number(p.currentValue ?? p.totalPrice), 0)
  const stocksValue = totalStocksValue(stocks as unknown as Parameters<typeof totalStocksValue>[0])
  const commoditiesValue = commodities.reduce((sum, c) => {
    const buyQty = Number(c.quantity)
    const soldQty = ((c.trades as Record<string, unknown>[] | undefined) ?? [])
      .filter((t) => t.type === "sell")
      .reduce((a, t) => a + Number(t.quantity), 0)
    const netQty = Math.max(0, buyQty - soldQty)
    return sum + netQty * Number(c.currentPrice ?? c.avgBuyPrice)
  }, 0)
  const sideValue = sideInvestments.filter((s) => s.status === "active").reduce((sum, s) => sum + Number(s.currentValue), 0)
  const receivablesTotal = receivables.filter((r) => r.status !== "settled").reduce((sum, r) => sum + Number(r.amount) - Number(r.amountPaid), 0)
  const personalLiabilitiesTotal = liabilities.filter((l) => l.status !== "settled").reduce((sum, l) => sum + Number(l.amount) - Number(l.amountPaid), 0)
  // Real-estate contractual debt: all remaining (pending + unpaid) installments across properties
  const realEstateDebtTotal = properties.reduce((sum, p) => {
    const insts = (p.installments as Record<string, unknown>[]) || []
    return sum + insts.filter((i) => i.status === "pending" || i.status === "unpaid").reduce((s, i) => s + Number(i.amount), 0)
  }, 0)
  const liabilitiesTotal = personalLiabilitiesTotal + realEstateDebtTotal

  const totalAssets = walletBalance + realEstateValue + stocksValue + commoditiesValue + sideValue + receivablesTotal
  const netWorth = totalAssets - liabilitiesTotal

  const stocksInvested = stocks.reduce((sum, s) => {
    const buyQty = Number(s.quantity)
    const soldQty = ((s.trades as Record<string, unknown>[] | undefined) ?? []).filter((t) => t.type === "sell").reduce((a, t) => a + Number(t.quantity), 0)
    return sum + Math.max(0, buyQty - soldQty) * Number(s.avgBuyPrice)
  }, 0)
  const commoditiesInvested = commodities.reduce((sum, c) => {
    return sum + (c.totalCostPaid != null ? Number(c.totalCostPaid) : Number(c.quantity) * Number(c.avgBuyPrice))
  }, 0)
  const realEstateInvested = properties.reduce((sum, p) => {
    const insts = (p.installments as Record<string, unknown>[]) || []
    const hasDP = insts.some((i) => i.type === "downpayment")
    const paid = insts.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0)
    return sum + paid + (hasDP ? 0 : Number(p.downPayment))
  }, 0)
  const sideInvested = sideInvestments.filter((s) => s.status === "active").reduce((sum, s) => sum + Number(s.investedAmount), 0)

  // Count-up hooks — must be called before any early return
  const animNetWorth = useCountUp(netWorth)
  const animWalletBalance = useCountUp(walletBalance)
  const animReceivablesTotal = useCountUp(receivablesTotal)
  const animLiabilitiesTotal = useCountUp(liabilitiesTotal)
  const animRealEstateValue = useCountUp(realEstateValue)
  const animStocksValue = useCountUp(stocksValue)
  const animCommoditiesValue = useCountUp(commoditiesValue)
  const animSideValue = useCountUp(sideValue)

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session?.user?.name || "there"}!`}
      />

      <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Net Worth"
          value={formatCompact(animNetWorth)}
          numericValue={animNetWorth}
          icon={DollarSign}
          gradient={{ from: "from-indigo-500/25", to: "to-violet-500/5", ring: "ring-indigo-500/40", accent: "text-indigo-400" }}
        />
        <StatCard
          title="Wallet Balance"
          value={formatCompact(animWalletBalance)}
          numericValue={animWalletBalance}
          subtitle={`${wallets.length} wallet(s)`}
          icon={Wallet}
          gradient={{ from: "from-sky-500/25", to: "to-blue-500/5", ring: "ring-sky-500/40", accent: "text-sky-400" }}
        />
        <StatCard
          title="Receivables"
          value={formatCompact(animReceivablesTotal)}
          numericValue={animReceivablesTotal}
          subtitle={`${receivables.filter((r) => r.status !== "settled").length} active`}
          icon={TrendingUp}
          gradient={{ from: "from-emerald-500/25", to: "to-teal-500/5", ring: "ring-emerald-500/40", accent: "text-emerald-400" }}
        />
        <StatCard
          title="Liabilities"
          value={formatCompact(animLiabilitiesTotal)}
          numericValue={animLiabilitiesTotal}
          subtitle={`${liabilities.filter((l) => l.status !== "settled").length} active`}
          icon={TrendingDown}
          gradient={{ from: "from-red-500/25", to: "to-rose-500/5", ring: "ring-red-500/40", accent: "text-red-400" }}
        />
      </div>

      <h2 className="text-xl font-semibold mb-4">Investment Breakdown</h2>
      <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {[
          { title: "Real Estate",     href: "/investments/real-estate", icon: Building2, market: animRealEstateValue,  invested: realEstateInvested,  count: `${properties.length} properties`,                                            from: "from-orange-500/25", to: "to-red-500/5",     ring: "ring-orange-500/40", accent: "text-orange-400", noMarket: true },
          { title: "Stocks",          href: "/investments/stocks",      icon: BarChart3, market: animStocksValue,      invested: stocksInvested,      count: `${stocks.length} holdings`,                                                      from: "from-purple-500/25", to: "to-fuchsia-500/5", ring: "ring-purple-500/40", accent: "text-purple-400", noMarket: false },
          { title: "Commodities",     href: "/investments/commodities", icon: Gem,       market: animCommoditiesValue, invested: commoditiesInvested, count: `${commodities.length} holdings`,                                                  from: "from-yellow-500/25", to: "to-amber-500/5",   ring: "ring-yellow-500/40", accent: "text-yellow-400", noMarket: false },
          { title: "Side Investments",href: "/investments/other",       icon: Briefcase, market: animSideValue,        invested: sideInvested,        count: `${sideInvestments.filter((s) => s.status === "active").length} active`,          from: "from-pink-500/25",   to: "to-rose-500/5",    ring: "ring-pink-500/40",   accent: "text-pink-400",  noMarket: false },
        ].map((item) => {
          const pnl = item.noMarket ? 0 : item.market - item.invested
          const pnlPct = item.invested > 0 && !item.noMarket ? (pnl / item.invested) * 100 : 0
          const gain = pnl >= 0
          return (
            <Link key={item.title} href={item.href}>
            <div className={cn(
              "relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 sm:p-4 ring-1 cursor-pointer hover:ring-2 transition-all h-full",
              item.from, item.to, item.ring,
            )}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.count}</p>
                </div>
                <div className={cn("rounded-full p-1.5 bg-background/40 shrink-0", item.accent)}>
                  <item.icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap mb-1">
                <p className="text-xl font-bold tabular-nums">{formatCompact(item.market)}</p>
                {!item.noMarket && item.invested > 0 && (
                  <span className={cn("text-xs font-semibold tabular-nums", gain ? "text-emerald-400" : "text-red-400")}>
                    {gain ? "+" : ""}{pnlPct.toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/70 tabular-nums mb-2">{formatCurrency(item.market)}</p>
              <div className="space-y-0.5 pt-2 border-t border-white/5 text-[11px] tabular-nums">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Invested</span>
                  <span>{formatCompact(item.invested)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Market</span>
                  {item.noMarket
                    ? <span className="text-muted-foreground/50">–</span>
                    : <span className={cn(gain ? "text-emerald-400" : "text-red-400")}>{formatCompact(item.market)}</span>
                  }
                </div>
              </div>
            </div>
            </Link>
          )
        })}
      </div>

      <h2 className="text-xl font-semibold mb-4">Net Worth Breakdown</h2>
      <Card className="mb-8">
        <CardContent className="p-4 sm:p-6">
          <NetWorthDonut
            data={[
              { name: "Cash & Wallets",   value: walletBalance,    color: "#3b82f6" },
              { name: "Real Estate",      value: realEstateValue,  color: "#f97316" },
              { name: "Stocks",           value: stocksValue,      color: "#a855f7" },
              { name: "Commodities",      value: commoditiesValue, color: "#eab308" },
              { name: "Side Investments", value: sideValue,        color: "#ec4899" },
              { name: "Receivables",      value: receivablesTotal, color: "#22c55e" },
            ].filter((d) => d.value > 0)}
            total={totalAssets}
            netWorth={netWorth}
            liabilities={liabilitiesTotal}
            mounted={mounted}
          />
        </CardContent>
      </Card>
    </div>
  )
}

interface DonutProps {
  data: Array<{ name: string; value: number; color: string }>
  total: number
  netWorth: number
  liabilities: number
  mounted: boolean
}

function NetWorthDonut({ data, total, netWorth, liabilities, mounted }: DonutProps) {
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) => {
    if (!active || !payload?.length) return null
    const item = payload[0]
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0"
    return (
      <div className="rounded-lg border bg-background/95 backdrop-blur px-3 py-2 text-xs shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: item.payload.color }} />
          <span className="font-medium">{item.name}</span>
        </div>
        <div className="tabular-nums space-y-0.5 pl-4">
          <p>{formatCompact(item.value)}</p>
          <p className="text-muted-foreground">{formatCurrency(item.value)}</p>
          <p className="text-muted-foreground">{pct}% of assets</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col lg:flex-row gap-6 items-center">
      <div className="relative w-full max-w-[280px] mx-auto lg:mx-0 shrink-0" style={{ height: 280 }}>
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={75} outerRadius={115} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                {data.map((entry, i) => <Cell key={i} fill={entry.color} opacity={0.9} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Net Worth</p>
          <p className="text-lg font-bold tabular-nums leading-tight">{formatCompact(netWorth)}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums">{formatCurrency(netWorth)}</p>
        </div>
      </div>
      <div className="flex-1 w-full space-y-2">
        {data.map((item) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0
          return (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-sm flex-1 truncate">{item.name}</span>
                <span className="text-sm font-semibold tabular-nums">{formatCompact(item.value)}</span>
              </div>
              <div className="flex items-center gap-2 pl-4">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: mounted ? `${pct}%` : "0%", background: item.color }} />
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-10 text-right">{pct.toFixed(1)}%</span>
              </div>
            </div>
          )
        })}
        <div className="pt-2 border-t space-y-1 text-xs tabular-nums">
          <div className="flex justify-between text-muted-foreground"><span>Total Assets</span><span className="text-foreground font-medium">{formatCompact(total)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Liabilities</span><span className="text-red-400 font-medium">−{formatCompact(liabilities)}</span></div>
          <div className="flex justify-between font-semibold pt-1 border-t"><span>Net Worth</span><span className={netWorth >= 0 ? "text-emerald-400" : "text-red-400"}>{formatCompact(netWorth)}</span></div>
        </div>
      </div>
    </div>
  )
}
