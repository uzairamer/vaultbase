import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { Building2, BarChart3, Gem, Briefcase } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    prisma.property.findMany({ where: { userId } }),
    prisma.stockHolding.findMany({ where: { userId } }),
    prisma.commodityHolding.findMany({ where: { userId } }),
    prisma.sideInvestment.findMany({ where: { userId, status: "active" } }),
  ])

  const realEstateValue = properties.reduce(
    (sum, p) => sum + toNum(p.currentValue ?? p.totalPrice),
    0
  )
  const stocksValue = stocks.reduce(
    (sum, s) => sum + toNum(s.quantity) * toNum(s.currentPrice ?? s.avgBuyPrice),
    0
  )
  const commoditiesValue = commodities.reduce(
    (sum, c) => sum + toNum(c.quantity) * toNum(c.currentPrice ?? c.avgBuyPrice),
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
    },
    {
      title: "Stocks",
      value: stocksValue,
      count: stocks.length,
      icon: BarChart3,
      href: "/investments/stocks",
      description: "Stock portfolio and trade history",
    },
    {
      title: "Commodities",
      value: commoditiesValue,
      count: commodities.length,
      icon: Gem,
      href: "/investments/commodities",
      description: "Gold, silver, oil, and other commodities",
    },
    {
      title: "Other Investments",
      value: sideValue,
      count: sideInvestments.length,
      icon: Briefcase,
      href: "/investments/other",
      description: "Crypto, lending, business ventures",
    },
  ]

  return (
    <div>
      <PageHeader
        title="Investments"
        description={`Total portfolio value: ${formatCurrency(totalValue)}`}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {categories.map((cat) => (
          <Link key={cat.href} href={cat.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{cat.title}</CardTitle>
                <cat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(cat.value)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {cat.count} holdings &middot; {cat.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
