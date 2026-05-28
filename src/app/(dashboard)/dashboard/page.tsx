"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { formatCurrency } from "@/lib/utils"
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
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import Link from "next/link"
import { INFLOW_SUBTYPES, OUTFLOW_SUBTYPES } from "@/lib/constants"

const SUBTYPE_LABELS: Record<string, string> = Object.fromEntries(
  [...INFLOW_SUBTYPES, ...OUTFLOW_SUBTYPES].map((s) => [s.value, s.label])
)

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

type LedgerFilter = "all" | "inflow" | "outflow" | "receivable_collection" | "lending"

export default function DashboardPage() {
  const { data: session } = useSession()
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all")
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { data: txData } = useQuery({ queryKey: ["transactions"], queryFn: () => fetcher("/api/expenses/transactions") })
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
  const transactions = (txData || []) as Record<string, unknown>[]

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

  // Filter transactions for ledger
  const filteredTxs = transactions.filter((tx) => {
    if (ledgerFilter === "all") return true
    if (ledgerFilter === "inflow") return tx.type === "inflow"
    if (ledgerFilter === "outflow") return tx.type === "outflow"
    if (ledgerFilter === "receivable_collection") return tx.subType === "receivable_collection"
    if (ledgerFilter === "lending") return tx.subType === "lending"
    return true
  })

  const filterLabel: Record<LedgerFilter, string> = {
    all: "All Transactions",
    inflow: "Inflows",
    outflow: "Outflows",
    receivable_collection: "Receivable Collections",
    lending: "Lending / Receivables Created",
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session?.user?.name || "there"}!`}
      />

      <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Net Worth"
          value={formatCurrency(animNetWorth)}
          icon={DollarSign}
          gradient={{ from: "from-indigo-500/25", to: "to-violet-500/5", ring: "ring-indigo-500/40", accent: "text-indigo-400" }}
        />
        <button className="text-left" onClick={() => setLedgerFilter("all")}>
          <StatCard
            title="Wallet Balance"
            value={formatCurrency(animWalletBalance)}
            subtitle={`${wallets.length} wallet(s)`}
            icon={Wallet}
            gradient={{ from: "from-sky-500/25", to: "to-blue-500/5", ring: "ring-sky-500/40", accent: "text-sky-400" }}
            className={ledgerFilter === "all" ? "ring-2 ring-sky-400" : "hover:ring-2 hover:ring-sky-400/60 transition-all"}
          />
        </button>
        <button className="text-left" onClick={() => setLedgerFilter(ledgerFilter === "receivable_collection" ? "all" : "receivable_collection")}>
          <StatCard
            title="Receivables"
            value={formatCurrency(animReceivablesTotal)}
            subtitle={`${receivables.filter((r) => r.status !== "settled").length} active`}
            icon={TrendingUp}
            gradient={{ from: "from-emerald-500/25", to: "to-teal-500/5", ring: "ring-emerald-500/40", accent: "text-emerald-400" }}
            className={ledgerFilter === "receivable_collection" ? "ring-2 ring-emerald-400" : "hover:ring-2 hover:ring-emerald-400/60 transition-all cursor-pointer"}
          />
        </button>
        <button className="text-left" onClick={() => setLedgerFilter(ledgerFilter === "lending" ? "all" : "lending")}>
          <StatCard
            title="Liabilities"
            value={formatCurrency(animLiabilitiesTotal)}
            subtitle={`${liabilities.filter((l) => l.status !== "settled").length} active`}
            icon={TrendingDown}
            gradient={{ from: "from-red-500/25", to: "to-rose-500/5", ring: "ring-red-500/40", accent: "text-red-400" }}
            className={ledgerFilter === "lending" ? "ring-2 ring-red-400" : "hover:ring-2 hover:ring-red-400/60 transition-all cursor-pointer"}
          />
        </button>
      </div>

      <h2 className="text-xl font-semibold mb-4">Investment Breakdown</h2>
      <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Real Estate"
          value={formatCurrency(animRealEstateValue)}
          subtitle={`${properties.length} properties`}
          icon={Building2}
          gradient={{ from: "from-orange-500/25", to: "to-red-500/5", ring: "ring-orange-500/40", accent: "text-orange-400" }}
        />
        <StatCard
          title="Stocks"
          value={formatCurrency(animStocksValue)}
          subtitle={`${stocks.length} holdings`}
          icon={BarChart3}
          gradient={{ from: "from-purple-500/25", to: "to-fuchsia-500/5", ring: "ring-purple-500/40", accent: "text-purple-400" }}
        />
        <StatCard
          title="Commodities"
          value={formatCurrency(animCommoditiesValue)}
          subtitle={`${commodities.length} holdings`}
          icon={Gem}
          gradient={{ from: "from-yellow-500/25", to: "to-amber-500/5", ring: "ring-yellow-500/40", accent: "text-yellow-400" }}
        />
        <StatCard
          title="Side Investments"
          value={formatCurrency(animSideValue)}
          subtitle={`${sideInvestments.filter((s) => s.status === "active").length} active`}
          icon={Briefcase}
          gradient={{ from: "from-pink-500/25", to: "to-rose-500/5", ring: "ring-pink-500/40", accent: "text-pink-400" }}
        />
      </div>

      {/* Transactions Ledger */}
      <Card className="mb-8">
        <CardHeader className="flex flex-col gap-3 pb-3">
          <div>
            <CardTitle className="text-base">{filterLabel[ledgerFilter]}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{filteredTxs.length} transaction(s)</p>
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {(["all", "inflow", "outflow"] as LedgerFilter[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={ledgerFilter === f ? "default" : "outline"}
                  onClick={() => setLedgerFilter(f)}
                  className="text-xs h-7 px-2.5"
                >
                  {f === "all" ? "All" : f === "inflow" ? "Inflows" : "Outflows"}
                </Button>
              ))}
              {ledgerFilter !== "all" && ledgerFilter !== "inflow" && ledgerFilter !== "outflow" && (
                <Button variant="ghost" size="sm" onClick={() => setLedgerFilter("all")} className="text-xs h-7 px-2.5">
                  Clear filter
                </Button>
              )}
            </div>
            <Link href="/expenses">
              <Button variant="outline" size="sm" className="text-xs h-7 px-2.5">Full view</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTxs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {transactions.length === 0
                ? <>No transactions yet. <Link href="/expenses/wallets" className="text-primary hover:underline">Add a wallet</Link> to start tracking.</>
                : "No transactions match the current filter."
              }
            </p>
          ) : (
            <div className="space-y-2">
              {filteredTxs.slice(0, 10).map((tx) => (
                <div key={tx.id as string} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${tx.type === "inflow" ? "bg-green-100 dark:bg-green-950" : "bg-red-100 dark:bg-red-950"}`}>
                      {tx.type === "inflow" ? (
                        <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {(tx.description as string) || SUBTYPE_LABELS[tx.subType as string] || (tx.type === "inflow" ? "Inflow" : "Outflow")}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">{(tx.wallet as Record<string, string>)?.name || ""}</span>
                        <span>·</span>
                        <span className="whitespace-nowrap">{format(new Date(tx.date as string), "MMM dd, yyyy")}</span>
                        {tx.subType ? (
                          <>
                            <span>·</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{SUBTYPE_LABELS[tx.subType as string] || (tx.subType as string)}</Badge>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <span className={`text-sm font-medium shrink-0 ${tx.type === "inflow" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type === "inflow" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                  </span>
                </div>
              ))}
              {filteredTxs.length > 10 && (
                <div className="text-center pt-2">
                  <Link href="/expenses" className="text-xs text-primary hover:underline">
                    View all {filteredTxs.length} transactions
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="text-xl font-semibold mb-4">Asset Allocation</h2>
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { label: "Wallets", value: walletBalance, color: "bg-blue-500" },
              { label: "Real Estate", value: realEstateValue, color: "bg-green-500" },
              { label: "Stocks", value: stocksValue, color: "bg-purple-500" },
              { label: "Commodities", value: commoditiesValue, color: "bg-yellow-500" },
              { label: "Side Investments", value: sideValue, color: "bg-orange-500" },
            ].map((item, index) => {
              const pct = totalAssets > 0 ? (item.value / totalAssets) * 100 : 0
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${item.color}`} />
                    <span className="text-sm flex-1 truncate">{item.label}</span>
                    <span className="text-sm font-semibold tabular-nums shrink-0">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-4">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`}
                        style={{ width: mounted ? `${pct}%` : "0%", transitionDelay: `${index * 150}ms` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-12 text-right">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
