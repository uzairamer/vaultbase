"use client"

import { useState } from "react"
import { useFinancialReport } from "@/modules/expenses/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { Printer, TrendingUp, TrendingDown, Minus, Building2, BarChart3, Gem, Briefcase, Wallet, Users, HandCoins } from "lucide-react"

const QUARTERS = [
  { value: "1", label: "Q1 (Jan – Mar)" },
  { value: "2", label: "Q2 (Apr – Jun)" },
  { value: "3", label: "Q3 (Jul – Sep)" },
  { value: "4", label: "Q4 (Oct – Dec)" },
]

const SUBTYPES: Record<string, string> = {
  earned_income: "Earned Income",
  passive_income: "Passive Income",
  receivable_collection: "Receivable Collection",
  other_inflow: "Other Inflow",
  fixed_expense: "Fixed Expense",
  variable_expense: "Variable Expense",
  lending: "Lending",
  debt_repayment: "Debt Repayment",
  savings_investment: "Savings / Investment",
}

function AssetRow({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <div>
        <span className="text-sm">{label}</span>
        {sub && <span className="ml-2 text-xs text-muted-foreground">{sub}</span>}
      </div>
      <span className="text-sm font-medium tabular-nums">{formatCurrency(value)}</span>
    </div>
  )
}

function SectionCard({ title, icon: Icon, children, total, totalLabel = "Total" }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  total: number
  totalLabel?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
      </div>
      {children}
      <Separator className="my-1" />
      <div className="flex justify-between py-1">
        <span className="text-sm font-semibold">{totalLabel}</span>
        <span className="text-sm font-semibold tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportData = any

export default function GenerateReportPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3))

  const { data: report, isLoading, isError } = useFinancialReport(year, quarter) as { data: ReportData; isLoading: boolean; isError: boolean }

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i)

  function handlePrint() {
    window.print()
  }

  return (
    <div>
      <PageHeader
        title="Financial Position"
        description="Quarterly balance sheet of your complete financial position"
      >
        <div className="flex items-center gap-2 print:hidden">
          <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTERS.map((q) => (
                <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </PageHeader>

      {isLoading && (
        <div className="p-6 text-center text-muted-foreground">Generating report…</div>
      )}

      {isError && (
        <div className="p-6 text-center text-destructive">Failed to load report data.</div>
      )}

      {report && (
        <div className="space-y-6 pb-10">

          {/* Report header for print */}
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-2xl font-bold">Financial Report — {report.period.label}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Generated on {new Date().toLocaleDateString("en-PK", { dateStyle: "long" })}
            </p>
          </div>

          {/* ── Net Worth Summary ─────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1 bg-primary text-primary-foreground">
              <CardContent className="pt-6">
                <p className="text-sm font-medium opacity-80">Net Worth</p>
                <p className="text-3xl font-bold mt-1 tabular-nums">{formatCurrency(report.netWorth)}</p>
                <p className="text-xs opacity-70 mt-2">As of end of {report.period.label}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-sm font-medium">Total Assets</p>
                </div>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(report.assets.totalAssets)}</p>
                <p className="text-xs text-muted-foreground mt-1">Across all asset classes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <TrendingDown className="h-4 w-4" />
                  <p className="text-sm font-medium">Total Liabilities</p>
                </div>
                <p className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(report.liabilities.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">Outstanding debts</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Assets & Liabilities ──────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">

            {/* ASSETS */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Assets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Wallets */}
                <SectionCard title="Cash & Wallets" icon={Wallet} total={report.assets.wallets.total}>
                  {report.assets.wallets.items.length === 0
                    ? <p className="text-xs text-muted-foreground py-1">No wallets</p>
                    : report.assets.wallets.items.map((w: ReportData) => (
                      <AssetRow key={w.id} label={w.name} value={w.balance} sub={w.type.replace("_", " ")} />
                    ))
                  }
                </SectionCard>

                {/* Stocks */}
                {report.assets.stocks.items.length > 0 && (
                  <SectionCard title="Stocks" icon={BarChart3} total={report.assets.stocks.total}>
                    {report.assets.stocks.items.map((s: ReportData) => (
                      <AssetRow
                        key={s.symbol}
                        label={`${s.symbol} — ${s.name}`}
                        value={s.value}
                        sub={`${s.quantity} units`}
                      />
                    ))}
                  </SectionCard>
                )}

                {/* Commodities */}
                {report.assets.commodities.items.length > 0 && (
                  <SectionCard title="Commodities" icon={Gem} total={report.assets.commodities.total}>
                    {report.assets.commodities.items.map((c: ReportData, i: number) => (
                      <AssetRow
                        key={i}
                        label={c.type.charAt(0).toUpperCase() + c.type.slice(1)}
                        value={c.value}
                        sub={`${c.quantity} ${c.unit}`}
                      />
                    ))}
                  </SectionCard>
                )}

                {/* Real Estate */}
                {report.assets.realEstate.items.length > 0 && (
                  <SectionCard title="Real Estate" icon={Building2} total={report.assets.realEstate.total}>
                    {report.assets.realEstate.items.map((p: ReportData) => (
                      <AssetRow
                        key={p.id}
                        label={p.name}
                        value={p.value}
                        sub={p.location ?? undefined}
                      />
                    ))}
                  </SectionCard>
                )}

                {/* Side Investments */}
                {report.assets.sideInvestments.items.length > 0 && (
                  <SectionCard title="Side Investments" icon={Briefcase} total={report.assets.sideInvestments.total}>
                    {report.assets.sideInvestments.items.map((s: ReportData) => (
                      <AssetRow key={s.id} label={s.name} value={s.currentValue} sub={s.type} />
                    ))}
                  </SectionCard>
                )}

                {/* Receivables */}
                {report.assets.receivables.items.length > 0 && (
                  <SectionCard title="Receivables (Owed to You)" icon={Users} total={report.assets.receivables.total}>
                    {report.assets.receivables.items.map((r: ReportData) => (
                      <div key={r.id} className="flex items-baseline justify-between py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{r.personName}</span>
                          <Badge variant="outline" className="text-[10px] py-0">{r.status}</Badge>
                        </div>
                        <span className="text-sm font-medium tabular-nums">{formatCurrency(r.remaining)}</span>
                      </div>
                    ))}
                  </SectionCard>
                )}

                {/* Grand Total */}
                <div className="flex justify-between pt-2 border-t-2 border-foreground">
                  <span className="font-bold">Total Assets</span>
                  <span className="font-bold tabular-nums text-green-600 dark:text-green-400">
                    {formatCurrency(report.assets.totalAssets)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* LIABILITIES + EQUITY */}
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Liabilities</CardTitle>
                </CardHeader>
                <CardContent>
                  <SectionCard title="Outstanding Debts" icon={HandCoins} total={report.liabilities.total} totalLabel="Total Liabilities">
                    {report.liabilities.items.length === 0
                      ? <p className="text-xs text-muted-foreground py-2">No outstanding liabilities</p>
                      : report.liabilities.items.map((l: ReportData) => (
                        <div key={l.id} className="flex items-baseline justify-between py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{l.personName}</span>
                            <Badge variant="outline" className="text-[10px] py-0">{l.status}</Badge>
                          </div>
                          <span className="text-sm font-medium tabular-nums text-red-600 dark:text-red-400">
                            {formatCurrency(l.remaining)}
                          </span>
                        </div>
                      ))
                    }
                  </SectionCard>
                </CardContent>
              </Card>

              {/* Owner's Equity */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Owner&apos;s Equity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between py-1.5">
                    <span className="text-sm">Total Assets</span>
                    <span className="text-sm tabular-nums">{formatCurrency(report.assets.totalAssets)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-sm">Less: Total Liabilities</span>
                    <span className="text-sm tabular-nums text-red-600 dark:text-red-400">
                      ({formatCurrency(report.liabilities.total)})
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between py-1.5 font-bold">
                    <span>Net Worth</span>
                    <span className={`tabular-nums ${report.netWorth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(report.netWorth)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Asset Allocation */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Asset Allocation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "Cash & Wallets", value: report.assets.wallets.total },
                    { label: "Stocks", value: report.assets.stocks.total },
                    { label: "Commodities", value: report.assets.commodities.total },
                    { label: "Real Estate", value: report.assets.realEstate.total },
                    { label: "Side Investments", value: report.assets.sideInvestments.total },
                    { label: "Receivables", value: report.assets.receivables.total },
                  ]
                    .filter((a) => a.value > 0)
                    .map((a) => {
                      const pct = report.assets.totalAssets > 0
                        ? ((a.value / report.assets.totalAssets) * 100).toFixed(1)
                        : "0.0"
                      return (
                        <div key={a.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{a.label}</span>
                            <span className="tabular-nums">{pct}% · {formatCurrency(a.value)}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Cash Flow (Quarter) ───────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Cash Flow — {report.period.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">Total Inflow</span>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{formatCurrency(report.cashFlow.inflow)}</p>
                </div>
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-4">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-1">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm font-medium">Total Outflow</span>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{formatCurrency(report.cashFlow.outflow)}</p>
                </div>
                <div className={`rounded-lg p-4 ${report.cashFlow.net >= 0 ? "bg-blue-50 dark:bg-blue-950/30" : "bg-orange-50 dark:bg-orange-950/30"}`}>
                  <div className={`flex items-center gap-2 mb-1 ${report.cashFlow.net >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-700 dark:text-orange-400"}`}>
                    <Minus className="h-4 w-4" />
                    <span className="text-sm font-medium">Net Cash Flow</span>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{formatCurrency(report.cashFlow.net)}</p>
                </div>
              </div>

              {report.cashFlow.categories.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Breakdown by Category</p>
                  <div className="space-y-1">
                    <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground pb-1 border-b">
                      <span>Category</span>
                      <span className="text-center">Type</span>
                      <span className="text-right">Amount</span>
                    </div>
                    {report.cashFlow.categories.map((c: ReportData, i: number) => (
                      <div key={i} className="grid grid-cols-3 text-sm py-1.5 border-b border-border/40 last:border-0">
                        <span>{SUBTYPES[c.name] ?? c.name}</span>
                        <span className="text-center">
                          <Badge
                            variant={c.type === "inflow" ? "default" : "secondary"}
                            className="text-[10px] py-0"
                          >
                            {c.type}
                          </Badge>
                        </span>
                        <span className={`text-right tabular-nums font-medium ${c.type === "inflow" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {formatCurrency(c.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No transactions recorded in {report.period.label}
                </p>
              )}
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  )
}
