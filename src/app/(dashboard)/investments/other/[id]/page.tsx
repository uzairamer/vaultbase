"use client"

import { use } from "react"
import { useSideInvestment } from "@/modules/investments/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingUp, Calendar, Briefcase } from "lucide-react"
import { formatCurrency, formatCompact, formatPercent } from "@/lib/utils"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"

export default function SideInvestmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: investment, isLoading } = useSideInvestment(id)

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!investment) return <div className="p-6">Investment not found</div>

  const inv = investment as Record<string, unknown>
  const invested = Number(inv.investedAmount)
  const current = Number(inv.currentValue)
  const pnl = current - invested
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0

  return (
    <div>
      <PageHeader title={inv.name as string} description={inv.type as string} />

      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Invested"
          value={formatCompact(invested)}
          icon={DollarSign}
          gradient={{ from: "from-indigo-500/25", to: "to-violet-500/5", ring: "ring-indigo-500/40", accent: "text-indigo-400" }}
        />
        <StatCard
          title="Current Value"
          value={formatCompact(current)}
          icon={Briefcase}
          gradient={{ from: "from-pink-500/25", to: "to-rose-500/5", ring: "ring-pink-500/40", accent: "text-pink-400" }}
        />
        <StatCard
          title="P&L"
          value={`${formatCompact(pnl)} (${formatPercent(pnlPct)})`}
          icon={TrendingUp}
          gradient={pnl >= 0
            ? { from: "from-emerald-500/25", to: "to-teal-500/5", ring: "ring-emerald-500/40", accent: "text-emerald-400" }
            : { from: "from-red-500/25", to: "to-rose-500/5", ring: "ring-red-500/40", accent: "text-red-400" }}
        />
        <StatCard
          title="Started"
          value={format(new Date(inv.startDate as string), "MMM dd, yyyy")}
          icon={Calendar}
          gradient={{ from: "from-sky-500/25", to: "to-blue-500/5", ring: "ring-sky-500/40", accent: "text-sky-400" }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <Badge>{inv.status as string}</Badge>
          </div>
          {inv.notes ? (
            <div>
              <span className="text-sm font-medium">Notes:</span>
              <p className="text-sm text-muted-foreground mt-1">{inv.notes as string}</p>
            </div>
          ) : null}
          {inv.endDate ? (
            <div>
              <span className="text-sm font-medium">End Date:</span>
              <p className="text-sm text-muted-foreground">{format(new Date(inv.endDate as string), "MMM dd, yyyy")}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
