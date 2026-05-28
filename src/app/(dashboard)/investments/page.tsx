import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cn, formatCurrency } from "@/lib/utils"
import { totalStocksValue } from "@/lib/stocks"
import { PageHeader } from "@/components/shared/page-header"
import { Building2, BarChart3, Gem, Briefcase } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

function toNum(d: unknown): number {
  return d ? Number(d) : 0
}

export default async function InvestmentsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const [properties, stocks, commodities, sideInvestments] = await Promise.all([
    prisma.property.findMany({ where: { userId, archivedAt: null } }),
    prisma.stockHolding.findMany({ where: { userId, archivedAt: null }, include: { trades: true } }),
    prisma.commodityHolding.findMany({ where: { userId, archivedAt: null }, include: { trades: true } }),
    prisma.sideInvestment.findMany({ where: { userId, status: "active" } }),
  ])

  const realEstateValue = properties.reduce(
    (sum, p) => sum + toNum(p.currentValue ?? p.totalPrice),
    0
  )
  const stocksValue = totalStocksValue(stocks)
  const commoditiesValue = commodities.reduce(
    (sum, c) => {
      const buyQty = toNum(c.quantity)
      const soldQty = (c.trades ?? []).filter((t) => t.type === "sell").reduce((a, t) => a + toNum(t.quantity), 0)
      const netQty = Math.max(0, buyQty - soldQty)
      return sum + netQty * toNum(c.currentPrice ?? c.avgBuyPrice)
    },
    0
  )
  const sideValue = sideInvestments.reduce((sum, s) => sum + toNum(s.currentValue), 0)
  const totalValue = realEstateValue + stocksValue + commoditiesValue + sideValue

  const categories = [
    {
      title: "Real Estate",
      value: realEstateValue,
      count: properties.length,
      icon: Building2,
      href: "/investments/real-estate",
      description: "Properties, plots, and installment tracking",
      from: "from-orange-500/25",
      to: "to-red-500/5",
      ring: "ring-orange-500/40",
      accent: "text-orange-400",
      hover: "hover:ring-orange-400/70",
    },
    {
      title: "Stocks",
      value: stocksValue,
      count: stocks.length,
      icon: BarChart3,
      href: "/investments/stocks",
      description: "Stock portfolio and trade history",
      from: "from-purple-500/25",
      to: "to-fuchsia-500/5",
      ring: "ring-purple-500/40",
      accent: "text-purple-400",
      hover: "hover:ring-purple-400/70",
    },
    {
      title: "Commodities",
      value: commoditiesValue,
      count: commodities.length,
      icon: Gem,
      href: "/investments/commodities",
      description: "Gold, silver, oil, and other commodities",
      from: "from-yellow-500/25",
      to: "to-amber-500/5",
      ring: "ring-yellow-500/40",
      accent: "text-yellow-400",
      hover: "hover:ring-yellow-400/70",
    },
    {
      title: "Other Investments",
      value: sideValue,
      count: sideInvestments.length,
      icon: Briefcase,
      href: "/investments/other",
      description: "Crypto, lending, business ventures",
      from: "from-pink-500/25",
      to: "to-rose-500/5",
      ring: "ring-pink-500/40",
      accent: "text-pink-400",
      hover: "hover:ring-pink-400/70",
    },
  ]

  return (
    <div>
      <PageHeader
        title="Investments"
        description={`Total portfolio value: ${formatCurrency(totalValue)}`}
      />

      <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {categories.map((cat) => (
          <Link key={cat.href} href={cat.href}>
            <div className={cn(
              "relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 sm:p-4 ring-1 h-full transition-all cursor-pointer hover:ring-2",
              cat.from, cat.to, cat.ring, cat.hover,
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground font-medium">{cat.title}</p>
                  <p className="text-base sm:text-2xl font-bold tabular-nums truncate mt-0.5">{formatCurrency(cat.value)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{cat.count} holdings</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{cat.description}</p>
                </div>
                <div className={cn("rounded-full p-1.5 sm:p-2 bg-background/40 shrink-0", cat.accent)}>
                  <cat.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
