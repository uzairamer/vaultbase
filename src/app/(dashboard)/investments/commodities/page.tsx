"use client"

import { useState } from "react"
import { useCommodities, useCreateCommodity, useDeleteCommodity, useStaticPrices } from "@/modules/investments/hooks"
import { useWallets } from "@/modules/expenses/hooks"
import { InvestmentArchiveDialog } from "@/modules/investments/components/archive-dialog"
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Gem, Trash2, Archive, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency, formatCompact, formatPercent } from "@/lib/utils"
import { COMMODITY_UNITS } from "@/lib/constants"
import { toast } from "sonner"
import { format } from "date-fns"

// Per-type accent colors — distinct for each commodity class
const TYPE_ACCENTS: Record<string, {
  from: string; to: string; ring: string; ringHover: string
  badge: string; soldBg: string
}> = {
  gold:     { from: "from-yellow-500/25",  to: "to-amber-500/5",   ring: "ring-yellow-500/40",  ringHover: "hover:ring-yellow-400/70",  badge: "bg-yellow-500/10 border-yellow-500/40 text-yellow-300",  soldBg: "from-yellow-500/8 to-amber-500/3" },
  silver:   { from: "from-slate-400/25",   to: "to-zinc-500/5",    ring: "ring-slate-400/40",   ringHover: "hover:ring-slate-300/70",   badge: "bg-slate-400/10 border-slate-400/40 text-slate-300",     soldBg: "from-slate-500/8 to-zinc-500/3" },
  platinum: { from: "from-purple-500/25",  to: "to-violet-500/5",  ring: "ring-purple-500/40",  ringHover: "hover:ring-purple-400/70",  badge: "bg-purple-500/10 border-purple-500/40 text-purple-300",  soldBg: "from-purple-500/8 to-violet-500/3" },
  oil:      { from: "from-orange-600/25",  to: "to-red-600/5",     ring: "ring-orange-600/40",  ringHover: "hover:ring-orange-500/70",  badge: "bg-orange-500/10 border-orange-600/40 text-orange-300",  soldBg: "from-orange-600/8 to-red-600/3" },
  other:    { from: "from-teal-500/25",    to: "to-cyan-500/5",    ring: "ring-teal-500/40",    ringHover: "hover:ring-teal-400/70",    badge: "bg-teal-500/10 border-teal-500/40 text-teal-300",        soldBg: "from-teal-500/8 to-cyan-500/3" },
}

function typeAccent(type: string) {
  return TYPE_ACCENTS[type.toLowerCase()] ?? TYPE_ACCENTS.other
}

export default function CommoditiesPage() {
  const { data: commodities = [], isLoading } = useCommodities()
  const { data: staticPrices = [] } = useStaticPrices()
  const { data: wallets = [] } = useWallets()
  const addTrade = useCreateCommodity()
  const deleteCommodity = useDeleteCommodity()

  // Add dialog state
  const [open, setOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [selectedStaticPrice, setSelectedStaticPrice] = useState("none")
  const [formUnit, setFormUnit] = useState("")
  const [formQty, setFormQty] = useState("")
  const [formPrice, setFormPrice] = useState("")
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [buyWalletId, setBuyWalletId] = useState("none")

  // Sell dialog state
  const [sellId, setSellId] = useState<string | null>(null)
  const [sellAmount, setSellAmount] = useState("")
  const [sellDate, setSellDate] = useState(new Date().toISOString().slice(0, 10))
  const [sellWalletId, setSellWalletId] = useState("none")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState("")

  const walletList = wallets as Record<string, unknown>[]

  const staticPriceList = staticPrices as Record<string, unknown>[]
  const commodityList = commodities as Record<string, unknown>[]

  const totalValue = commodityList.reduce((sum, c) => {
    const buyQty = Number(c.quantity)
    const soldQty = ((c.trades as Record<string, unknown>[] | undefined) ?? [])
      .filter((t) => t.type === "sell")
      .reduce((a: number, t) => a + Number(t.quantity), 0)
    const qty = Math.max(0, buyQty - soldQty)
    const cur = c.resolvedPrice != null ? Number(c.resolvedPrice) : Number(c.currentPrice ?? c.avgBuyPrice)
    return sum + qty * cur
  }, 0)

  function resetAddForm() {
    setSelectedStaticPrice("none")
    setFormUnit("")
    setFormQty("")
    setFormPrice("")
    setFormDate(new Date().toISOString().slice(0, 10))
    setBuyWalletId("none")
  }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const sp = staticPriceList.find((s) => s.id === selectedStaticPrice)
    if (!sp) { toast.error("Select a commodity type (static price)"); return }
    const type = (sp.name as string).toLowerCase()
    addTrade.mutate(
      {
        type,
        unit: formUnit,
        quantity: Number(formQty),
        totalCostPaid: Number(formPrice),
        purchaseDate: formDate,
        staticPriceId: selectedStaticPrice,
        walletId: buyWalletId !== "none" ? buyWalletId : null,
      },
      {
        onSuccess: () => {
          setOpen(false)
          resetAddForm()
          toast.success(buyWalletId !== "none" ? "Commodity added & wallet debited" : "Commodity added")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handleSell() {
    if (!sellId) return
    const c = commodityList.find((x) => x.id === sellId)
    if (!c) return
    const buyQty = Number(c.quantity)
    const soldQty = ((c.trades as Record<string, unknown>[] | undefined) ?? [])
      .filter((t) => t.type === "sell")
      .reduce((a: number, t) => a + Number(t.quantity), 0)
    const remainingQty = Math.max(0, buyQty - soldQty)
    if (remainingQty <= 0) { toast.error("No remaining quantity to sell"); return }
    const totalReceived = Number(sellAmount)
    if (!totalReceived || totalReceived <= 0) { toast.error("Enter a valid sale amount"); return }
    addTrade.mutate(
      {
        holdingId: sellId,
        type: "sell",
        quantity: remainingQty,
        price: totalReceived / remainingQty,
        date: sellDate,
        walletId: sellWalletId !== "none" ? sellWalletId : null,
        totalReceived,
      },
      {
        onSuccess: () => {
          setSellId(null)
          setSellAmount("")
          setSellDate(new Date().toISOString().slice(0, 10))
          setSellWalletId("none")
          toast.success(sellWalletId !== "none" ? "Sold! Proceeds added to wallet." : "Sold! P&L recorded.")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  const sellingCommodity = commodityList.find((c) => c.id === sellId)
  const sellingRemainingQty = sellingCommodity ? (() => {
    const buyQty = Number(sellingCommodity.quantity)
    const soldQty = ((sellingCommodity.trades as Record<string, unknown>[] | undefined) ?? [])
      .filter((t) => t.type === "sell")
      .reduce((a: number, t) => a + Number(t.quantity), 0)
    return Math.max(0, buyQty - soldQty)
  })() : 0

  return (
    <div>
      <PageHeader title="Commodities" description={`Active value: ${formatCompact(totalValue)}`}>
        <div className="flex flex-wrap gap-2">
          {commodityList.length > 0 && (
            <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950" onClick={() => setArchiveOpen(true)}>
              <Archive className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Archive All</span>
              <span className="sm:hidden">Archive</span>
            </Button>
          )}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetAddForm() }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Commodity</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Commodity Holding</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                {/* Commodity type = static price selection */}
                <div className="space-y-2">
                  <Label>Commodity</Label>
                  {staticPriceList.length === 0 ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                      Set up prices first in{" "}
                      <a href="/settings/static-prices" className="underline font-medium">Settings → Static Prices</a>.
                      Each price series (Gold, Silver…) becomes a commodity type.
                    </div>
                  ) : (
                    <Select value={selectedStaticPrice} onValueChange={setSelectedStaticPrice} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select commodity" />
                      </SelectTrigger>
                      <SelectContent>
                        {staticPriceList.map((sp) => (
                          <SelectItem key={sp.id as string} value={sp.id as string}>{sp.name as string}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={formUnit} onValueChange={setFormUnit} required>
                      <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent>
                        {COMMODITY_UNITS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number" step="0.0001" min="0" required
                      value={formQty} onChange={(e) => setFormQty(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Purchase Date</Label>
                  <Input
                    type="date" required
                    value={formDate} onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total Amount Paid <span className="text-muted-foreground font-normal text-xs">(incl. tax &amp; charges)</span></Label>
                  <Input
                    type="number" step="0.01" min="0" placeholder="e.g. 204000" required
                    value={formPrice} onChange={(e) => setFormPrice(e.target.value)}
                  />
                </div>

                {formQty && formPrice && Number(formQty) > 0 && Number(formPrice) > 0 && (
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs space-y-0.5">
                    <div className="flex items-center justify-between tabular-nums">
                      <span className="text-muted-foreground">Total paid</span>
                      <span className="font-semibold text-sky-400">{formatCurrency(Number(formPrice))}</span>
                    </div>
                    <div className="flex items-center justify-between tabular-nums text-muted-foreground">
                      <span>Effective cost per {formUnit || "unit"}</span>
                      <span>{formatCurrency(Number(formPrice) / Number(formQty))}</span>
                    </div>
                  </div>
                )}

                {/* Optional wallet deduction */}
                <div className="space-y-2">
                  <Label>Deduct from wallet <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Select value={buyWalletId} onValueChange={setBuyWalletId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No wallet — skip" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No wallet — skip</SelectItem>
                      {walletList.map((w) => (
                        <SelectItem key={w.id as string} value={w.id as string}>{w.name as string}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={addTrade.isPending || staticPriceList.length === 0}>
                  {addTrade.isPending ? "Adding..." : "Add Commodity"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {commodityList.length === 0 ? (
        <EmptyState icon={Gem} title="No commodities" description="Track gold, silver, and other commodity holdings." />
      ) : (
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {commodityList.map((c) => {
            const type = (c.type as string).toLowerCase()
            const accent = typeAccent(type)
            const buyQty = Number(c.quantity)
            const trades = (c.trades as Record<string, unknown>[]) ?? []
            const soldQty = trades.filter((t) => t.type === "sell").reduce((a: number, t) => a + Number(t.quantity), 0)
            const qty = Math.max(0, buyQty - soldQty)
            const isSold = qty <= 0
            const totalCostPaid = c.totalCostPaid != null ? Number(c.totalCostPaid) : buyQty * Number(c.avgBuyPrice)
            const cur = c.resolvedPrice != null ? Number(c.resolvedPrice) : Number(c.currentPrice ?? c.avgBuyPrice)
            const currentValue = qty * cur

            // For sold items: total received from sell trades
            const totalReceived = isSold
              ? trades.filter((t) => t.type === "sell").reduce((a: number, t) => a + Number(t.quantity) * Number(t.price), 0)
              : null
            const displayPnl = totalReceived != null ? totalReceived - totalCostPaid : currentValue - totalCostPaid
            const pnlPositive = displayPnl >= 0

            return (
              <div
                key={c.id as string}
                className={cn(
                  "relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 sm:p-4 ring-1 transition-all h-full flex flex-col",
                  isSold
                    ? cn("opacity-60 bg-muted/30 border-muted ring-muted/30", accent.soldBg)
                    : cn(accent.from, accent.to, accent.ring)
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-base font-semibold capitalize">{c.type as string}</p>
                      {isSold && <Badge className="bg-muted text-muted-foreground border-0 text-[10px] h-4 px-1.5">Sold</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                      {isSold ? `${buyQty} ${c.unit as string} sold` : `${qty} ${c.unit as string} held`}
                      {c.purchaseDate ? ` · ${new Date(c.purchaseDate as string).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                      {c.unit as string === "gram" || c.unit as string === "tola" || c.unit as string === "oz" ? "" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {!isSold && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] px-2 text-red-400 hover:bg-red-500/10"
                        onClick={() => { setSellId(c.id as string); setSellAmount("") }}
                      >
                        <TrendingDown className="h-3 w-3 mr-1" />
                        Sell
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setDeleteId(c.id as string); setDeleteName(c.type as string) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Values */}
                {isSold ? (
                  <div className="space-y-1 mt-auto">
                    <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                      <span>Received</span>
                      <span className="font-medium text-foreground">{formatCompact(totalReceived ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                      <span>Paid</span>
                      <span>{formatCompact(totalCostPaid)}</span>
                    </div>
                    <div className={cn("flex items-center justify-between text-sm font-semibold tabular-nums pt-1 border-t border-border/30", pnlPositive ? "text-emerald-400" : "text-red-400")}>
                      <span className="flex items-center gap-1">
                        {pnlPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                        {pnlPositive ? "Gain" : "Loss"}
                      </span>
                      <span>{pnlPositive ? "+" : ""}{formatCompact(displayPnl)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 mt-auto">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">Market value</span>
                      <p className="text-xl font-bold tabular-nums">{formatCompact(currentValue)}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                      <span>Paid</span>
                      <span className="text-foreground/70">{formatCompact(totalCostPaid)}</span>
                    </div>
                    <div className={cn(
                      "flex items-center justify-between text-sm font-semibold tabular-nums pt-1 border-t border-white/5",
                      pnlPositive ? "text-emerald-400" : "text-red-400"
                    )}>
                      <span>{pnlPositive ? "+" : ""}{formatCompact(displayPnl)}</span>
                      <span className="text-xs font-normal opacity-75">{formatPercent(totalCostPaid > 0 ? (displayPnl / totalCostPaid) * 100 : 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Sell Dialog */}
      <Dialog open={!!sellId} onOpenChange={(v) => { if (!v) { setSellId(null); setSellAmount("") } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              Sell {sellingCommodity ? (sellingCommodity.type as string) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs space-y-1">
              <div className="flex justify-between tabular-nums">
                <span className="text-muted-foreground">Selling qty</span>
                <span className="font-medium">{sellingRemainingQty} {sellingCommodity?.unit as string}</span>
              </div>
              <div className="flex justify-between tabular-nums">
                <span className="text-muted-foreground">Originally paid</span>
                <span className="font-medium">{sellingCommodity ? formatCurrency(sellingCommodity.totalCostPaid != null ? Number(sellingCommodity.totalCostPaid) : sellingRemainingQty * Number(sellingCommodity.avgBuyPrice)) : "—"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Total Amount Received</Label>
              <Input
                type="number" step="0.01" min="0" placeholder="e.g. 250000" autoFocus
                value={sellAmount} onChange={(e) => setSellAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sale Date</Label>
              <Input type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Credit proceeds to wallet <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Select value={sellWalletId} onValueChange={setSellWalletId}>
                <SelectTrigger>
                  <SelectValue placeholder="No wallet — skip" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No wallet — skip</SelectItem>
                  {walletList.map((w) => (
                    <SelectItem key={w.id as string} value={w.id as string}>{w.name as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sellAmount && Number(sellAmount) > 0 && sellingCommodity && (() => {
              const paid = sellingCommodity.totalCostPaid != null
                ? Number(sellingCommodity.totalCostPaid)
                : sellingRemainingQty * Number(sellingCommodity.avgBuyPrice)
              const received = Number(sellAmount)
              const gain = received - paid
              return (
                <div className={cn("rounded-lg border px-3 py-2 text-xs flex items-center justify-between tabular-nums", gain >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {gain >= 0 ? "Profit" : "Loss"}
                  </span>
                  <span className={cn("font-semibold", gain >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {gain >= 0 ? "+" : ""}{formatCurrency(gain)}
                  </span>
                </div>
              )
            })()}
            <Button
              className="w-full"
              variant="destructive"
              disabled={!sellAmount || Number(sellAmount) <= 0 || addTrade.isPending}
              onClick={handleSell}
            >
              {addTrade.isPending ? "Recording sale..." : "Confirm Sale"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null) }}
        title={`Delete ${deleteName}?`}
        description={`This will permanently delete this ${deleteName} holding and all its trade history. This cannot be undone.`}
        note="Any wallet transactions created when buying or selling this commodity will be kept as-is — they represent real cash flows. Delete them manually from the Expenses ledger if needed."
        onConfirm={() => deleteCommodity.mutate(deleteId!, {
          onSuccess: () => toast.success("Deleted"),
          onError: (err) => toast.error(err.message),
        })}
        isPending={deleteCommodity.isPending}
      />
      <InvestmentArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        type="commodities"
        itemCount={commodityList.length}
      />
    </div>
  )
}
