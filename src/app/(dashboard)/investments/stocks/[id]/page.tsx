"use client"

import { use, useState } from "react"
import { useStock, useCreateStock } from "@/modules/investments/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatCard } from "@/components/shared/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, TrendingUp, DollarSign, BarChart3, Hash } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { format } from "date-fns"
import { toast } from "sonner"

export default function StockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: stock, isLoading } = useStock(id)
  const addTrade = useCreateStock()
  const [open, setOpen] = useState(false)

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!stock) return <div className="p-6">Stock not found</div>

  const s = stock as Record<string, unknown>
  const trades = (s.trades as Record<string, unknown>[]) || []
  const qty = Number(s.quantity)
  const avg = Number(s.avgBuyPrice)
  const cur = Number(s.currentPrice ?? avg)
  const value = qty * cur
  const cost = qty * avg
  const pnl = value - cost
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    addTrade.mutate(
      {
        holdingId: id,
        type: fd.get("type") as string,
        quantity: Number(fd.get("quantity")),
        price: Number(fd.get("price")),
        fee: Number(fd.get("fee") || 0),
        date: fd.get("date") as string,
        notes: (fd.get("notes") as string) || undefined,
      },
      {
        onSuccess: () => { setOpen(false); toast.success("Trade recorded") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  return (
    <div>
      <PageHeader title={`${s.symbol} — ${s.name}`} description="Stock holding details" />

      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Quantity"
          value={qty.toFixed(2)}
          icon={Hash}
          gradient={{ from: "from-sky-500/25", to: "to-blue-500/5", ring: "ring-sky-500/40", accent: "text-sky-400" }}
        />
        <StatCard
          title="Avg Buy Price"
          value={formatCurrency(avg)}
          icon={DollarSign}
          gradient={{ from: "from-indigo-500/25", to: "to-violet-500/5", ring: "ring-indigo-500/40", accent: "text-indigo-400" }}
        />
        <StatCard
          title="Current Value"
          value={formatCurrency(value)}
          icon={BarChart3}
          gradient={{ from: "from-purple-500/25", to: "to-fuchsia-500/5", ring: "ring-purple-500/40", accent: "text-purple-400" }}
        />
        <StatCard
          title="P&L"
          value={`${formatCurrency(pnl)} (${formatPercent(pnlPct)})`}
          icon={TrendingUp}
          gradient={pnl >= 0
            ? { from: "from-emerald-500/25", to: "to-teal-500/5", ring: "ring-emerald-500/40", accent: "text-emerald-400" }
            : { from: "from-red-500/25", to: "to-rose-500/5", ring: "ring-red-500/40", accent: "text-red-400" }}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Trade History</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Trade</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record Trade</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="type" required>
                  <SelectTrigger><SelectValue placeholder="Buy or Sell" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input name="quantity" type="number" step="0.0001" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input name="price" type="number" step="0.0001" min="0" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fee</Label>
                  <Input name="fee" type="number" step="0.01" min="0" defaultValue="0" />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input name="notes" />
              </div>
              <Button type="submit" className="w-full">Record Trade</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((t) => (
                <TableRow key={t.id as string}>
                  <TableCell>{format(new Date(t.date as string), "MMM dd, yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === "buy" ? "default" : "destructive"}>{t.type as string}</Badge>
                  </TableCell>
                  <TableCell>{Number(t.quantity).toFixed(2)}</TableCell>
                  <TableCell>{formatCurrency(Number(t.price))}</TableCell>
                  <TableCell>{formatCurrency(Number(t.fee))}</TableCell>
                  <TableCell>{formatCurrency(Number(t.quantity) * Number(t.price))}</TableCell>
                  <TableCell>{(t.notes as string) || "-"}</TableCell>
                </TableRow>
              ))}
              {trades.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-20 text-muted-foreground">No trades yet</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
