"use client"

import { useInsightsData } from "@/modules/insights/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { cn, formatCurrency, formatCompact } from "@/lib/utils"
import { totalStocksValue } from "@/lib/stocks"
import { DollarSign, TrendingUp, TrendingDown, Wallet, BarChart3, Gem } from "lucide-react"
import Link from "next/link"

export default function InsightsPage() {
  const { data, isLoading } = useInsightsData()

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!data) return <div className="p-6">No data available</div>

  const d = data as Record<string, Record<string, unknown>[]>
  const wallets = (d.wallets || []) as Record<string, unknown>[]
  const properties = (d.properties || []) as Record<string, unknown>[]
  const stocks = (d.stocks || []) as Record<string, unknown>[]
  const commodities = (d.commodities || []) as Record<string, unknown>[]
  const sideInvestments = (d.sideInvestments || []) as Record<string, unknown>[]
  const receivables = (d.receivables || []) as Record<string, unknown>[]
  const liabilities = (d.liabilities || []) as Record<string, unknown>[]

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
  const realEstateDebtTotal = properties.reduce((sum, p) => {
    const insts = (p.installments as Record<string, unknown>[]) || []
    return sum + insts.filter((i) => i.status === "pending" || i.status === "unpaid").reduce((s: number, i) => s + Number(i.amount), 0)
  }, 0)
  const liabilitiesTotal = personalLiabilitiesTotal + realEstateDebtTotal

  const totalAssets = walletBalance + realEstateValue + stocksValue + commoditiesValue + sideValue + receivablesTotal
  const netWorth = totalAssets - liabilitiesTotal

  const txs = d.transactions || []
  const totalIncome = txs.filter((t: Record<string, unknown>) => t.type === "inflow").reduce((sum: number, t: Record<string, unknown>) => sum + Number(t.amount), 0)
  const totalExpenses = txs.filter((t: Record<string, unknown>) => t.type === "outflow").reduce((sum: number, t: Record<string, unknown>) => sum + Number(t.amount), 0)

  return (
    <div>
      <PageHeader title="Insights" description="Analytics and performance overview" />

      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Net Worth"
          value={formatCompact(netWorth)}
          icon={DollarSign}
          gradient={{ from: "from-indigo-500/25", to: "to-violet-500/5", ring: "ring-indigo-500/40", accent: "text-indigo-400" }}
        />
        <StatCard
          title="Total Income"
          value={formatCompact(totalIncome)}
          icon={TrendingUp}
          gradient={{ from: "from-emerald-500/25", to: "to-teal-500/5", ring: "ring-emerald-500/40", accent: "text-emerald-400" }}
        />
        <StatCard
          title="Total Expenses"
          value={formatCompact(totalExpenses)}
          icon={TrendingDown}
          gradient={{ from: "from-red-500/25", to: "to-rose-500/5", ring: "ring-red-500/40", accent: "text-red-400" }}
        />
        <StatCard
          title="Savings Rate"
          value={totalIncome > 0 ? `${(((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1)}%` : "0%"}
          icon={Wallet}
          gradient={{ from: "from-sky-500/25", to: "to-blue-500/5", ring: "ring-sky-500/40", accent: "text-sky-400" }}
        />
      </div>

      <h2 className="text-xl font-semibold mb-4">Explore</h2>
      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Stock Performance", href: "/insights/stocks", icon: BarChart3, desc: "Portfolio returns over time", from: "from-purple-500/25", to: "to-fuchsia-500/5", ring: "ring-purple-500/40", accent: "text-purple-400", hover: "hover:ring-purple-400/70" },
          { title: "Commodity Trends", href: "/insights/commodities", icon: Gem, desc: "Price movements & history", from: "from-yellow-500/25", to: "to-amber-500/5", ring: "ring-yellow-500/40", accent: "text-yellow-400", hover: "hover:ring-yellow-400/70" },
          { title: "Expense Analytics", href: "/insights/expenses", icon: TrendingDown, desc: "Breakdown of spending patterns", from: "from-red-500/25", to: "to-rose-500/5", ring: "ring-red-500/40", accent: "text-red-400", hover: "hover:ring-red-400/70" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <div className={cn(
              "relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 sm:p-4 ring-1 h-full transition-all cursor-pointer hover:ring-2",
              item.from, item.to, item.ring, item.hover,
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground font-medium">{item.title}</p>
                  <p className="text-[11px] sm:text-sm text-muted-foreground mt-1 leading-snug">{item.desc}</p>
                </div>
                <div className={cn("rounded-full p-1.5 sm:p-2 bg-background/40 shrink-0", item.accent)}>
                  <item.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
