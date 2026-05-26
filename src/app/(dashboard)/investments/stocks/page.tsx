"use client"

import { useState, useMemo } from "react"
import { useStocks, useCreateStock, useDeleteStock, useSellStock } from "@/modules/investments/hooks"
import { InvestmentArchiveDialog } from "@/modules/investments/components/archive-dialog"
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
import { Plus, BarChart3, Trash2, TrendingDown, Archive } from "lucide-react"
import { formatCurrency, formatPercent } from "@/lib/utils"
import { type ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"

type UnifiedRow = {
  _kind: "buy" | "sell"
  id: string
  date: string
  symbol: string
  name: string
  qty: number
  buyQty: number
  soldQty: number
  avgBuyPrice: number
  sellPrice: number
  fee: number
  lotAvgBuyPrice: number
  _holdingId: string
}

export default function StocksPage() {
  const { data: stocks = [], isLoading } = useStocks()
  const createStock = useCreateStock()
  const deleteStock = useDeleteStock()
  const sellStock = useSellStock()
  const { data: wallets = [] } = useWallets()

  const [addOpen, setAddOpen] = useState(false)
  const [sellOpen, setSellOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [selectedSymbol, setSelectedSymbol] = useState("")
  const [selectedWalletId, setSelectedWalletId] = useState("")
  const [addWalletId, setAddWalletId] = useState("")

  const stockList = stocks as Record<string, unknown>[]
  const walletList = wallets as Record<string, unknown>[]

  const symbols = stockList.map((s) => s.symbol as string)
  const { data: livePrices } = useLivePrices(symbols)
  const livePriceMap = new Map((livePrices ?? []).map((lp) => [lp.symbol, lp.price]))

  const getPrice = (s: Record<string, unknown>) =>
    livePriceMap.get(s.symbol as string) ?? Number(s.currentPrice ?? s.avgBuyPrice)

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

  const unifiedData = useMemo((): UnifiedRow[] => {
    const rows: UnifiedRow[] = []
    for (const s of stockList) {
      const trades = (s.trades as Record<string, unknown>[]) ?? []
      const soldQty = trades
        .filter((t) => t.type === "sell")
        .reduce((a, t) => a + Number(t.quantity), 0)

      rows.push({
        _kind: "buy",
        id: s.id as string,
        date: (s.purchaseDate ?? s.createdAt) as string,
        symbol: s.symbol as string,
        name: s.name as string,
        qty: Math.max(0, Number(s.quantity) - soldQty),
        buyQty: Number(s.quantity),
        soldQty,
        avgBuyPrice: Number(s.avgBuyPrice),
        sellPrice: 0,
        fee: 0,
        lotAvgBuyPrice: 0,
        _holdingId: s.id as string,
      })

      for (const t of trades) {
        if (t.type !== "sell") continue
        rows.push({
          _kind: "sell",
          id: t.id as string,
          date: t.date as string,
          symbol: s.symbol as string,
          name: s.name as string,
          qty: Number(t.quantity),
          buyQty: 0,
          soldQty: 0,
          avgBuyPrice: Number(s.avgBuyPrice),
          sellPrice: Number(t.price),
          fee: Number(t.fee ?? 0),
          lotAvgBuyPrice: Number(s.avgBuyPrice),
          _holdingId: s.id as string,
        })
      }
    }
    return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [stockList])

  const selectedWallet = walletList.find((w) => w.id === selectedWalletId)
  const segments = (selectedWallet?.segments as Record<string, unknown>[] | undefined) ?? []
  const availableQty = selectedSymbol ? (aggregatedQty.get(selectedSymbol) ?? 0) : 0

  const columns: ColumnDef<UnifiedRow>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums text-xs whitespace-nowrap">
          {format(new Date(row.original.date), "MMM dd, yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "_kind",
      header: "Type",
      cell: ({ row }) =>
        row.original._kind === "buy" ? (
          <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-xs">Buy</Badge>
        ) : (
          <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 text-xs">Sell</Badge>
        ),
    },
    {
      accessorKey: "symbol",
      header: "Symbol",
      cell: ({ row }) => {
        const r = row.original
        return r._kind === "buy" ? (
          <Link
            href={`/investments/stocks/${r._holdingId}`}
            className="font-medium text-primary hover:underline"
          >
            {r.symbol}
          </Link>
        ) : (
          <span className="font-medium">{r.symbol}</span>
        )
      },
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: "qty",
      header: "Qty",
      cell: ({ row }) => {
        const r = row.original
        if (r._kind === "sell") return <span className="tabular-nums">{r.qty.toFixed(2)}</span>
        return (
          <span className={r.soldQty > 0 ? "text-muted-foreground" : ""}>
            {r.qty.toFixed(2)}
            {r.soldQty > 0 && (
              <span className="ml-1 text-[10px] text-muted-foreground/60">({r.buyQty.toFixed(2)} bought)</span>
            )}
          </span>
        )
      },
    },
    {
      id: "price",
      header: "Price",
      cell: ({ row }) => {
        const r = row.original
        return (
          <span className="tabular-nums">
            {formatCurrency(r._kind === "buy" ? r.avgBuyPrice : r.sellPrice)}
          </span>
        )
      },
    },
    {
      id: "livePrice",
      header: "Live Price",
      cell: ({ row }) => {
        const r = row.original
        if (r._kind === "sell") return <span className="text-muted-foreground/40">—</span>
        const live = livePriceMap.get(r.symbol)
        return live
          ? <span className="tabular-nums">{formatCurrency(live)}</span>
          : <span className="text-muted-foreground/50">—</span>
      },
    },
    {
      id: "pnl",
      header: "P&L",
      cell: ({ row }) => {
        const r = row.original
        if (r._kind === "buy") {
          const cur = livePriceMap.get(r.symbol) ?? r.avgBuyPrice
          const pnl = (cur - r.avgBuyPrice) * r.qty
          const pct = r.avgBuyPrice > 0 ? ((cur - r.avgBuyPrice) / r.avgBuyPrice) * 100 : 0
          return (
            <span className={pnl >= 0 ? "text-green-500" : "text-red-500"}>
              {formatCurrency(pnl)} ({formatPercent(pct)})
            </span>
          )
        } else {
          const pnl = (r.sellPrice - r.lotAvgBuyPrice) * r.qty - r.fee
          return (
            <span className={pnl >= 0 ? "text-green-500" : "text-red-500"}>
              {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
            </span>
          )
        }
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const r = row.original
        if (r._kind === "sell") return null
        return (
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              deleteStock.mutate(r._holdingId, {
                onSuccess: () => toast.success("Deleted"),
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )
      },
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
        purchaseDate: fd.get("purchaseDate") as string,
        walletId: addWalletId || undefined,
        segmentId: (fd.get("addSegmentId") as string) || undefined,
      },
      {
        onSuccess: () => { setAddOpen(false); setAddWalletId(""); toast.success("Stock added") },
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
          {(stocks as Record<string, unknown>[]).length > 0 && (
            <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950" onClick={() => setArchiveOpen(true)}>
              <Archive className="mr-2 h-4 w-4" /> Archive All
            </Button>
          )}
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
                <div className="space-y-2">
                  <Label>Date of Purchase</Label>
                  <Input name="purchaseDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
                </div>
                <div className="space-y-2">
                  <Label>Deduct from Wallet <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Select value={addWalletId} onValueChange={setAddWalletId}>
                    <SelectTrigger><SelectValue placeholder="No wallet deduction" /></SelectTrigger>
                    <SelectContent>
                      {walletList.map((w) => (
                        <SelectItem key={w.id as string} value={w.id as string}>{w.name as string}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {addWalletId && (() => {
                  const segs = (walletList.find((w) => w.id === addWalletId)?.segments as Record<string, unknown>[] | undefined) ?? []
                  return segs.length > 0 ? (
                    <div className="space-y-2">
                      <Label>Segment <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <Select name="addSegmentId">
                        <SelectTrigger><SelectValue placeholder="No segment" /></SelectTrigger>
                        <SelectContent>
                          {segs.map((seg) => (
                            <SelectItem key={seg.id as string} value={seg.id as string}>{seg.name as string}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null
                })()}
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <DataTable
              columns={columns}
              data={unifiedData}
              searchKey="symbol"
              searchPlaceholder="Search by symbol..."
            />
          </CardContent>
        </Card>
      )}
      <InvestmentArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        type="stocks"
        itemCount={(stocks as Record<string, unknown>[]).length}
      />
    </div>
  )
}
