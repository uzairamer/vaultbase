"use client"

import { useState, useMemo } from "react"
import { useStocks, useCreateStock, useDeleteStock, useSellStock } from "@/modules/investments/hooks"
import { useWallets } from "@/modules/expenses/hooks"
import { useLivePrices } from "@/modules/insights/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Plus, BarChart3, Trash2, TrendingDown } from "lucide-react"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { type ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"

export default function StocksPage() {
  const { data: stocks = [], isLoading } = useStocks()
  const createStock = useCreateStock()
  const deleteStock = useDeleteStock()
  const sellStock = useSellStock()
  const { data: wallets = [] } = useWallets()

  const [addOpen, setAddOpen] = useState(false)
  const [sellOpen, setSellOpen] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState("")
  const [selectedWalletId, setSelectedWalletId] = useState("")

  const stockList = stocks as Record<string, unknown>[]
  const walletList = wallets as Record<string, unknown>[]

  const symbols = stockList.map((s) => s.symbol as string)
  const { data: livePrices } = useLivePrices(symbols)
  const livePriceMap = new Map((livePrices ?? []).map((lp) => [lp.symbol, lp.price]))

  const getPrice = (s: Record<string, unknown>) =>
    livePriceMap.get(s.symbol as string) ?? Number(s.currentPrice ?? s.avgBuyPrice)

  // Net portfolio value: uses original buy qty minus sold qty per lot
  const totalValue = useMemo(() => {
    return stockList.reduce((sum, s) => {
      const buyQty = Number(s.quantity)
      const soldQty = ((s.trades as Record<string, unknown>[]) ?? [])
        .filter((t) => t.type === "sell")
        .reduce((a, t) => a + Number(t.quantity), 0)
      const netQty = Math.max(0, buyQty - soldQty)
      return sum + netQty * getPrice(s)
    }, 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockList, livePriceMap])

  // Available qty per symbol (buy qty − sell trades), used in sell dialog
  const aggregatedQty = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of stockList) {
      const sym = s.symbol as string
      const buyQty = Number(s.quantity)
      const soldQty = ((s.trades as Record<string, unknown>[]) ?? [])
        .filter((t) => t.type === "sell")
        .reduce((a, t) => a + Number(t.quantity), 0)
      map.set(sym, (map.get(sym) ?? 0) + Math.max(0, buyQty - soldQty))
    }
    return map
  }, [stockList])

  const heldSymbols = useMemo(
    () => Array.from(aggregatedQty.entries()).filter(([, qty]) => qty > 0).map(([sym]) => sym).sort(),
    [aggregatedQty]
  )

  // All sell trades across all lots, enriched with the lot's avg buy price
  const sellHistory = useMemo((): Record<string, unknown>[] => {
    return stockList
      .flatMap((s) =>
        ((s.trades as Record<string, unknown>[]) ?? [])
          .filter((t) => t.type === "sell")
          .map((t): Record<string, unknown> => ({
            ...t,
            symbol: s.symbol as string,
            lotAvgBuyPrice: s.avgBuyPrice,
          }))
      )
      .sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime())
  }, [stockList])

  const selectedWallet = walletList.find((w) => w.id === selectedWalletId)
  const segments = (selectedWallet?.segments as Record<string, unknown>[] | undefined) ?? []
  const availableQty = selectedSymbol ? (aggregatedQty.get(selectedSymbol) ?? 0) : 0

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
      id: "qty",
      header: "Qty",
      cell: ({ row }) => {
        const s = row.original
        const buyQty = Number(s.quantity)
        const soldQty = ((s.trades as Record<string, unknown>[]) ?? [])
          .filter((t) => t.type === "sell")
          .reduce((a, t) => a + Number(t.quantity), 0)
        const net = Math.max(0, buyQty - soldQty)
        return (
          <span className={soldQty > 0 ? "text-muted-foreground" : ""}>
            {net.toFixed(2)}
            {soldQty > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground/60">({buyQty.toFixed(2)} bought)</span>
            )}
          </span>
        )
      },
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
      id: "pnl",
      header: "P&L",
      cell: ({ row }) => {
        const s = row.original as Record<string, unknown>
        const buyQty = Number(s.quantity)
        const soldQty = ((s.trades as Record<string, unknown>[]) ?? [])
          .filter((t) => t.type === "sell")
          .reduce((a, t) => a + Number(t.quantity), 0)
        const netQty = Math.max(0, buyQty - soldQty)
        const avg = Number(s.avgBuyPrice)
        const cur = getPrice(s)
        const pnl = (cur - avg) * netQty
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

  function handleAddSubmit(e: React.FormEvent<HTMLFormElement>) {
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
        onSuccess: () => { setAddOpen(false); toast.success("Stock added") },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  function handleSellSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const qty = Number(fd.get("quantity"))

    if (qty > availableQty) {
      toast.error(`Cannot sell more than available (${availableQty.toFixed(4)} shares)`)
      return
    }

    sellStock.mutate(
      {
        symbol: selectedSymbol,
        quantity: qty,
        price: Number(fd.get("price")),
        fee: Number(fd.get("fee") || 0),
        date: fd.get("date") as string,
        walletId: selectedWalletId,
        segmentId: (fd.get("segmentId") as string) || undefined,
        notes: (fd.get("notes") as string) || undefined,
      },
      {
        onSuccess: () => {
          setSellOpen(false)
          setSelectedSymbol("")
          setSelectedWalletId("")
          toast.success("Sale recorded")
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div className="space-y-6">
      <PageHeader title="Stocks" description={`Portfolio value: ${formatCurrency(totalValue)}`}>
        <div className="flex gap-2">
          {heldSymbols.length > 0 && (
            <Dialog open={sellOpen} onOpenChange={(o) => { setSellOpen(o); if (!o) { setSelectedSymbol(""); setSelectedWalletId("") } }}>
              <DialogTrigger asChild>
                <Button variant="outline"><TrendingDown className="mr-2 h-4 w-4" /> Sell Stock</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Sell Stock</DialogTitle></DialogHeader>
                <form onSubmit={handleSellSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Symbol</Label>
                    <Select value={selectedSymbol} onValueChange={setSelectedSymbol} required>
                      <SelectTrigger><SelectValue placeholder="Select symbol" /></SelectTrigger>
                      <SelectContent>
                        {heldSymbols.map((sym) => (
                          <SelectItem key={sym} value={sym}>
                            {sym} — {aggregatedQty.get(sym)?.toFixed(2)} available
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>
                        Quantity
                        {selectedSymbol && (
                          <span className="ml-1 text-xs text-muted-foreground">(max {availableQty.toFixed(2)})</span>
                        )}
                      </Label>
                      <Input name="quantity" type="number" step="0.0001" min="0.0001" max={availableQty || undefined} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Sell Price (PKR)</Label>
                      <Input name="price" type="number" step="0.0001" min="0" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Brokerage Fee (PKR)</Label>
                      <Input name="fee" type="number" step="0.01" min="0" defaultValue="0" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Deposit Proceeds To</Label>
                    <Select value={selectedWalletId} onValueChange={setSelectedWalletId} required>
                      <SelectTrigger><SelectValue placeholder="Select wallet" /></SelectTrigger>
                      <SelectContent>
                        {walletList.map((w) => (
                          <SelectItem key={w.id as string} value={w.id as string}>{w.name as string}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {segments.length > 0 && (
                    <div className="space-y-2">
                      <Label>Segment <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Select name="segmentId">
                        <SelectTrigger><SelectValue placeholder="No segment" /></SelectTrigger>
                        <SelectContent>
                          {segments.map((seg) => (
                            <SelectItem key={seg.id as string} value={seg.id as string}>{seg.name as string}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Input name="notes" placeholder="e.g. Target price reached" />
                  </div>
                  <Button type="submit" className="w-full" disabled={sellStock.isPending || !selectedSymbol || !selectedWalletId}>
                    {sellStock.isPending ? "Recording sale…" : "Record Sale"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Stock</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Stock Holding</DialogTitle></DialogHeader>
              <form onSubmit={handleAddSubmit} className="space-y-4">
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
                <p className="text-xs text-muted-foreground">Live price is fetched automatically.</p>
                <Button type="submit" className="w-full" disabled={createStock.isPending}>
                  {createStock.isPending ? "Adding..." : "Add Stock"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {stockList.length === 0 ? (
        <EmptyState icon={BarChart3} title="No stocks" description="Add your first stock holding." />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={stockList}
            searchKey="symbol"
            searchPlaceholder="Search by symbol..."
          />

          {sellHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Sell History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y text-sm">
                  <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/40">
                    <span>Date</span>
                    <span>Symbol</span>
                    <span className="text-right">Qty Sold</span>
                    <span className="text-right">Avg Buy</span>
                    <span className="text-right">Sell Price</span>
                    <span className="text-right">P&L</span>
                  </div>
                  {sellHistory.map((t) => {
                    const qty = Number(t.quantity)
                    const sellPrice = Number(t.price)
                    const avgBuy = Number(t.lotAvgBuyPrice)
                    const pnl = (sellPrice - avgBuy) * qty
                    const isProfit = pnl >= 0
                    return (
                      <div key={t.id as string} className="grid grid-cols-6 gap-2 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                        <span className="text-muted-foreground">
                          {format(new Date(t.date as string), "MMM dd, yyyy")}
                        </span>
                        <span>
                          <Badge variant="outline" className="text-xs font-medium">{t.symbol as string}</Badge>
                        </span>
                        <span className="text-right tabular-nums">{qty.toFixed(2)}</span>
                        <span className="text-right tabular-nums text-muted-foreground">{formatCurrency(avgBuy)}</span>
                        <span className="text-right tabular-nums">{formatCurrency(sellPrice)}</span>
                        <span className={`text-right tabular-nums font-medium ${isProfit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {isProfit ? "+" : ""}{formatCurrency(pnl)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
