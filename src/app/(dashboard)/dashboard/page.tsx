"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { formatCurrency } from "@/lib/utils"
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

async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

type LedgerFilter = "all" | "inflow" | "outflow" | "receivable_collection" | "lending"

export default function DashboardPage() {
  const { data: session } = useSession()
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("all")

  const { data: txData } = useQuery({ queryKey: ["transactions"], queryFn: () => fetcher("/api/expenses/transactions") })
  const { data: receivablesData } = useQuery({ queryKey: ["receivables"], queryFn: () => fetcher("/api/expenses/receivables") })
  const { data: liabilitiesData } = useQuery({ queryKey: ["liabilities"], queryFn: () => fetcher("/api/expenses/liabilities") })
  const { data: insightsData, isLoading } = useQuery({ queryKey: ["insights"], queryFn: () => fetcher("/api/insights") })

  if (isLoading) return <div className="p-6">Loading...</div>

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
  const stocksValue = stocks.reduce((sum, s) => sum + Number(s.quantity) * Number(s.currentPrice ?? s.avgBuyPrice), 0)
  const commoditiesValue = commodities.reduce((sum, c) => sum + Number(c.quantity) * Number(c.currentPrice ?? c.avgBuyPrice), 0)
  const sideValue = sideInvestments.filter((s) => s.status === "active").reduce((sum, s) => sum + Number(s.currentValue), 0)
  const receivablesTotal = receivables.filter((r) => r.status !== "settled").reduce((sum, r) => sum + Number(r.amount) - Number(r.amountPaid), 0)
  const liabilitiesTotal = liabilities.filter((l) => l.status !== "settled").reduce((sum, l) => sum + Number(l.amount) - Number(l.amountPaid), 0)

  const totalAssets = walletBalance + realEstateValue + stocksValue + commoditiesValue + sideValue + receivablesTotal
  const netWorth = totalAssets - liabilitiesTotal

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Net Worth"
          value={formatCurrency(netWorth)}
          icon={DollarSign}
          className="border-primary/20"
        />
        <button className="text-left" onClick={() => setLedgerFilter("all")}>
          <StatCard
            title="Wallet Balance"
            value={formatCurrency(walletBalance)}
            subtitle={`${wallets.length} wallet(s)`}
            icon={Wallet}
            className={ledgerFilter === "all" ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/50 transition-shadow"}
          />
        </button>
        <button className="text-left" onClick={() => setLedgerFilter(ledgerFilter === "receivable_collection" ? "all" : "receivable_collection")}>
          <StatCard
            title="Receivables"
            value={formatCurrency(receivablesTotal)}
            subtitle={`${receivables.filter((r) => r.status !== "settled").length} active`}
            icon={TrendingUp}
            className={ledgerFilter === "receivable_collection" ? "ring-2 ring-green-500" : "hover:ring-1 hover:ring-green-500/50 transition-shadow cursor-pointer"}
          />
        </button>
        <button className="text-left" onClick={() => setLedgerFilter(ledgerFilter === "lending" ? "all" : "lending")}>
          <StatCard
            title="Liabilities"
            value={formatCurrency(liabilitiesTotal)}
            subtitle={`${liabilities.filter((l) => l.status !== "settled").length} active`}
            icon={TrendingDown}
            className={ledgerFilter === "lending" ? "ring-2 ring-red-500" : "hover:ring-1 hover:ring-red-500/50 transition-shadow cursor-pointer"}
          />
        </button>
      </div>

      <h2 className="text-xl font-semibold mb-4">Investment Breakdown</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Real Estate" value={formatCurrency(realEstateValue)} subtitle={`${properties.length} properties`} icon={Building2} />
        <StatCard title="Stocks" value={formatCurrency(stocksValue)} subtitle={`${stocks.length} holdings`} icon={BarChart3} />
        <StatCard title="Commodities" value={formatCurrency(commoditiesValue)} subtitle={`${commodities.length} holdings`} icon={Gem} />
        <StatCard title="Side Investments" value={formatCurrency(sideValue)} subtitle={`${sideInvestments.filter((s) => s.status === "active").length} active`} icon={Briefcase} />
      </div>

      {/* Transactions Ledger */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{filterLabel[ledgerFilter]}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{filteredTxs.length} transaction(s)</p>
          </div>
          <div className="flex items-center gap-2">
            {ledgerFilter !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setLedgerFilter("all")}>
                Clear filter
              </Button>
            )}
            <div className="flex gap-1">
              {(["all", "inflow", "outflow"] as LedgerFilter[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={ledgerFilter === f ? "default" : "outline"}
                  onClick={() => setLedgerFilter(f)}
                  className="text-xs"
                >
                  {f === "all" ? "All" : f === "inflow" ? "Inflows" : "Outflows"}
                </Button>
              ))}
            </div>
            <Link href="/expenses">
              <Button variant="outline" size="sm" className="text-xs">Full view</Button>
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
              {filteredTxs.slice(0, 20).map((tx) => (
                <div key={tx.id as string} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{(tx.wallet as Record<string, string>)?.name || ""}</span>
                        <span>·</span>
                        <span>{format(new Date(tx.date as string), "MMM dd, yyyy")}</span>
                        {tx.subType ? (
                          <>
                            <span>·</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{SUBTYPE_LABELS[tx.subType as string] || (tx.subType as string)}</Badge>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <span className={`text-sm font-medium shrink-0 ml-4 ${tx.type === "inflow" ? "text-green-600" : "text-red-600"}`}>
                    {tx.type === "inflow" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                  </span>
                </div>
              ))}
              {filteredTxs.length > 20 && (
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
          <div className="space-y-3">
            {[
              { label: "Wallets", value: walletBalance, color: "bg-blue-500" },
              { label: "Real Estate", value: realEstateValue, color: "bg-green-500" },
              { label: "Stocks", value: stocksValue, color: "bg-purple-500" },
              { label: "Commodities", value: commoditiesValue, color: "bg-yellow-500" },
              { label: "Side Investments", value: sideValue, color: "bg-orange-500" },
            ].map((item) => {
              const pct = totalAssets > 0 ? (item.value / totalAssets) * 100 : 0
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${item.color}`} />
                  <span className="text-sm w-32">{item.label}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-16 text-right">
                    {pct.toFixed(1)}%
                  </span>
                  <span className="text-sm font-medium w-28 text-right">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
