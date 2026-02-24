"use client"

import { useState } from "react"
import { useStocks, useCreateStock, useDeleteStock } from "@/modules/investments/hooks"
import { useLivePrices } from "@/modules/insights/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable } from "@/components/shared/data-table"
import { Plus, BarChart3, Trash2 } from "lucide-react"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import Link from "next/link"

export default function StocksPage() {
  const { data: stocks = [], isLoading } = useStocks()
  const createStock = useCreateStock()
  const deleteStock = useDeleteStock()
  const [open, setOpen] = useState(false)

  const symbols = (stocks as Record<string, unknown>[]).map((s) => s.symbol as string)
  const { data: livePrices } = useLivePrices(symbols)
  const livePriceMap = new Map((livePrices ?? []).map((lp) => [lp.symbol, lp.price]))

  const getPrice = (s: Record<string, unknown>) =>
    livePriceMap.get(s.symbol as string) ?? Number(s.currentPrice ?? s.avgBuyPrice)

  const totalValue = (stocks as Record<string, unknown>[]).reduce(
    (sum, s) => sum + Number(s.quantity) * getPrice(s),
    0,
  )

  const columns: ColumnDef<Record<string, unknown>>[] = [
    {
      accessorKey: "symbol",
      header: "Symbol",
      cell: ({ row }) => (
        <Link
          href={`/investments/stocks/${(row.original as Record<string, string>).id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.getValue("symbol") as string}
        </Link>
      ),
    },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "quantity",
      header: "Qty",
      cell: ({ row }) => Number(row.getValue("quantity")).toFixed(2),
    },
    {
      accessorKey: "avgBuyPrice",
      header: "Avg Buy",
      cell: ({ row }) => formatCurrency(Number(row.getValue("avgBuyPrice"))),
    },
    {
      id: "currentPrice",
      header: "Live Price",
      cell: ({ row }) => {
        const sym = (row.original as Record<string, unknown>).symbol as string
        const live = livePriceMap.get(sym)
        return live ? formatCurrency(live) : <span className="text-muted-foreground/50">—</span>
      },
    },
    {
      id: "value",
      header: "Value",
      cell: ({ row }) => {
        const qty = Number((row.original as Record<string, unknown>).quantity)
        return formatCurrency(qty * getPrice(row.original as Record<string, unknown>))
      },
    },
    {
      id: "pnl",
      header: "P&L",
      cell: ({ row }) => {
        const s = row.original as Record<string, unknown>
        const qty = Number(s.quantity)
        const avg = Number(s.avgBuyPrice)
        const cur = getPrice(s)
        const pnl = (cur - avg) * qty
        const pct = avg > 0 ? ((cur - avg) / avg) * 100 : 0
        return (
          <span className={pnl >= 0 ? "text-green-500" : "text-red-500"}>
            {formatCurrency(pnl)} ({formatPercent(pct)})
          </span>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            deleteStock.mutate((row.original as Record<string, string>).id, {
              onSuccess: () => toast.success("Deleted"),
            })
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createStock.mutate(
      {
        symbol: (fd.get("symbol") as string).trim().toUpperCase(),
        name: fd.get("name") as string,
        quantity: Number(fd.get("quantity")),
        avgBuyPrice: Number(fd.get("avgBuyPrice")),
      },
      {
        onSuccess: () => { setOpen(false); toast.success("Stock added") },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Stocks" description={`Portfolio value: ${formatCurrency(totalValue)}`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Stock</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Stock Holding</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input name="symbol" placeholder="e.g. MEBL" required />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input name="name" placeholder="e.g. Meezan Bank" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input name="quantity" type="number" step="0.0001" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Avg Buy Price (PKR)</Label>
                  <Input name="avgBuyPrice" type="number" step="0.0001" min="0" required />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Live price is fetched automatically — no need to enter it manually.
              </p>
              <Button type="submit" className="w-full" disabled={createStock.isPending}>
                {createStock.isPending ? "Adding..." : "Add Stock"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {(stocks as Record<string, unknown>[]).length === 0 ? (
        <EmptyState icon={BarChart3} title="No stocks" description="Add your first stock holding." />
      ) : (
        <DataTable
          columns={columns}
          data={stocks as Record<string, unknown>[]}
          searchKey="symbol"
          searchPlaceholder="Search by symbol..."
        />
      )}
    </div>
  )
}
