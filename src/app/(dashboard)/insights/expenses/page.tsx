"use client"

import { useInsightsData } from "@/modules/insights/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { EmptyState } from "@/components/shared/empty-state"
import { Receipt } from "lucide-react"
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts"

const COLORS = ["#6366f1", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#10b981"]

export default function ExpenseInsightsPage() {
  const { data, isLoading } = useInsightsData()

  if (isLoading) return <div className="p-6">Loading...</div>

  const txs = ((data as Record<string, unknown[]>)?.transactions || []) as Record<string, unknown>[]

  if (txs.length === 0) {
    return (
      <div>
        <PageHeader title="Expense Analytics" description="Spending patterns and trends" />
        <EmptyState icon={Receipt} title="No transactions" description="Add transactions to see expense analytics." />
      </div>
    )
  }

  // Category breakdown for expenses
  const expenseTxs = txs.filter((t) => t.type === "outflow")
  const categoryMap = new Map<string, number>()
  for (const t of expenseTxs) {
    const cat = (t.category as Record<string, string>)?.name || "Uncategorized"
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + Number(t.amount))
  }
  const categoryData = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Monthly income vs expense
  const now = new Date()
  const months = eachMonthOfInterval({ start: subMonths(now, 11), end: now })
  const monthlyData = months.map((month) => {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    const monthTxs = txs.filter((t) => {
      const d = new Date(t.date as string)
      return d >= start && d <= end
    })
    const income = monthTxs.filter((t) => t.type === "inflow").reduce((sum, t) => sum + Number(t.amount), 0)
    const expense = monthTxs.filter((t) => t.type === "outflow").reduce((sum, t) => sum + Number(t.amount), 0)
    return {
      month: format(month, "MMM yy"),
      income,
      expense,
      net: income - expense,
    }
  })

  const totalIncome = txs.filter((t) => t.type === "inflow").reduce((sum, t) => sum + Number(t.amount), 0)
  const totalExpense = expenseTxs.reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <div>
      <PageHeader
        title="Expense Analytics"
        description={`Total income: ${formatCurrency(totalIncome)} · Total expenses: ${formatCurrency(totalExpense)}`}
      />

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {categoryData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="income" fill="#22c55e" name="Inflow" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" name="Outflow" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net Savings Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line type="monotone" dataKey="net" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Net Savings" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
