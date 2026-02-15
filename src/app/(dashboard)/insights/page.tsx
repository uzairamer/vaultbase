"use client"

import { useInsightsData } from "@/modules/insights/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { DollarSign, TrendingUp, TrendingDown, Wallet, Building2, BarChart3, Gem, Briefcase } from "lucide-react"
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
  const stocksValue = stocks.reduce((sum, s) => sum + Number(s.quantity) * Number(s.currentPrice ?? s.avgBuyPrice), 0)
  const commoditiesValue = commodities.reduce((sum, c) => sum + Number(c.quantity) * Number(c.currentPrice ?? c.avgBuyPrice), 0)
  const sideValue = sideInvestments.filter((s) => s.status === "active").reduce((sum, s) => sum + Number(s.currentValue), 0)
  const receivablesTotal = receivables.filter((r) => r.status !== "settled").reduce((sum, r) => sum + Number(r.amount) - Number(r.amountPaid), 0)
  const liabilitiesTotal = liabilities.filter((l) => l.status !== "settled").reduce((sum, l) => sum + Number(l.amount) - Number(l.amountPaid), 0)

  const totalAssets = walletBalance + realEstateValue + stocksValue + commoditiesValue + sideValue + receivablesTotal
  const netWorth = totalAssets - liabilitiesTotal

  const txs = d.transactions || []
  const totalIncome = txs.filter((t: Record<string, unknown>) => t.type === "inflow").reduce((sum: number, t: Record<string, unknown>) => sum + Number(t.amount), 0)
  const totalExpenses = txs.filter((t: Record<string, unknown>) => t.type === "outflow").reduce((sum: number, t: Record<string, unknown>) => sum + Number(t.amount), 0)

  return (
    <div>
      <PageHeader title="Insights" description="Analytics and performance overview" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Net Worth" value={formatCurrency(netWorth)} icon={DollarSign} />
        <StatCard title="Total Income" value={formatCurrency(totalIncome)} icon={TrendingUp} />
        <StatCard title="Total Expenses" value={formatCurrency(totalExpenses)} icon={TrendingDown} />
        <StatCard title="Savings Rate" value={totalIncome > 0 ? `${(((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1)}%` : "0%"} icon={Wallet} />
      </div>

      <h2 className="text-xl font-semibold mb-4">Explore</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Stock Performance", href: "/insights/stocks", icon: BarChart3, desc: "Analyze your stock portfolio returns" },
          { title: "Commodity Trends", href: "/insights/commodities", icon: Gem, desc: "Track commodity price movements" },
          { title: "Expense Analytics", href: "/insights/expenses", icon: TrendingDown, desc: "Breakdown of spending patterns" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <item.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
