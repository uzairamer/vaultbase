"use client"

import { useState, useMemo } from "react"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Plus, Gem, Trash2, Archive, TrendingDown, TrendingUp, CheckCircle2,
  Coins, Droplet, ChevronDown, ChevronUp, MoreVertical, Wallet as WalletIcon, Activity,
} from "lucide-react"
import { cn, formatCurrency, formatCompact, formatPercent } from "@/lib/utils"
import { COMMODITY_UNITS } from "@/lib/constants"
import { toast } from "sonner"

const TYPE_ICONS: Record<string, typeof Coins> = {
  gold: Coins,
  silver: Coins,
  platinum: Coins,
  oil: Droplet,
}

const TYPE_ICON_COLORS: Record<string, string> = {
  gold: "bg-amber-500/15 text-amber-400",
  silver: "bg-slate-400/15 text-slate-300",
  platinum: "bg-purple-500/15 text-purple-300",
  oil: "bg-orange-500/15 text-orange-300",
  other: "bg-teal-500/15 text-teal-300",
}

function typeIcon(type: string) {
  return TYPE_ICONS[type.toLowerCase()] ?? Gem
}
function typeIconColor(type: string) {
  return TYPE_ICON_COLORS[type.toLowerCase()] ?? TYPE_ICON_COLORS.other
}

// Full amount with the compact form in brackets, e.g. "Rs 900,000 (9L)"
function withCompact(amount: number) {
  const compact = formatCompact(amount).replace("Rs ", "")
  return `${formatCurrency(amount)} (${compact})`
}

interface EnrichedLot {
  id: string
  type: string
  unit: string
  purchaseDate: string
  buyQty: number
  qty: number
  isSold: boolean
  totalCostPaid: number
  currentPrice: number
  currentValue: number
  totalReceived: number | null
  pnl: number
  returnPct: number
}

interface TypeGroup {
  type: string
  unit: string
  lots: EnrichedLot[]
  totalQty: number
  totalCostPaid: number
  investedAmount: number
  totalCurrentValue: number
  totalPnl: number
  returnPct: number
  lastBought: Date
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

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const walletList = wallets as Record<string, unknown>[]
  const staticPriceList = staticPrices as Record<string, unknown>[]
  const commodityList = commodities as Record<string, unknown>[]

  const groups = useMemo((): TypeGroup[] => {
    const byType = new Map<string, Record<string, unknown>[]>()
    for (const c of commodityList) {
      const type = (c.type as string).toLowerCase()
      if (!byType.has(type)) byType.set(type, [])
      byType.get(type)!.push(c)
    }

    return Array.from(byType.entries())
      .map(([type, rows]) => {
        const lots: EnrichedLot[] = rows.map((c) => {
          const buyQty = Number(c.quantity)
          const trades = (c.trades as Record<string, unknown>[]) ?? []
          const soldQty = trades.filter((t) => t.type === "sell").reduce((a: number, t) => a + Number(t.quantity), 0)
          const qty = Math.max(0, buyQty - soldQty)
          const isSold = qty <= 0
          const totalCostPaid = c.totalCostPaid != null ? Number(c.totalCostPaid) : buyQty * Number(c.avgBuyPrice)
          const currentPrice = c.resolvedPrice != null ? Number(c.resolvedPrice) : Number(c.currentPrice ?? c.avgBuyPrice)
          const currentValue = qty * currentPrice
          const totalReceived = isSold
            ? trades.filter((t) => t.type === "sell").reduce((a: number, t) => a + Number(t.quantity) * Number(t.price), 0)
            : null
          const pnl = totalReceived != null ? totalReceived - totalCostPaid : currentValue - totalCostPaid
          return {
            id: c.id as string,
            type,
            unit: c.unit as string,
            purchaseDate: c.purchaseDate as string,
            buyQty,
            qty,
            isSold,
            totalCostPaid,
            currentPrice,
            currentValue,
            totalReceived,
            pnl,
            returnPct: totalCostPaid > 0 ? (pnl / totalCostPaid) * 100 : 0,
          }
        })

        const openLots = lots.filter((l) => !l.isSold)
        const totalQty = openLots.reduce((s, l) => s + l.qty, 0)
        const totalCostPaid = lots.reduce((s, l) => s + l.totalCostPaid, 0)
        const openCostPaid = openLots.reduce((s, l) => s + l.totalCostPaid, 0)
        const totalCurrentValue = openLots.reduce((s, l) => s + l.currentValue, 0)
        const totalPnl = lots.reduce((s, l) => s + l.pnl, 0)
        const lastBought = lots.reduce((max, l) => {
          const d = new Date(l.purchaseDate)
          return d > max ? d : max
        }, new Date(0))

        return {
          type,
          unit: rows[0].unit as string,
          lots: lots.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()),
          totalQty,
          totalCostPaid,
          investedAmount: openCostPaid,
          totalCurrentValue,
          totalPnl,
          returnPct: openCostPaid > 0 ? (totalPnl / openCostPaid) * 100 : 0,
          lastBought,
        }
      })
      .sort((a, b) => b.totalCurrentValue - a.totalCurrentValue)
  }, [commodityList])

  const { totalValue, totalInvested, totalPnl, totalReturnPct } = useMemo(() => {
    let invested = 0
    let value = 0
    for (const g of groups) {
      invested += g.lots.filter((l) => !l.isSold).reduce((s, l) => s + l.totalCostPaid, 0)
      value += g.totalCurrentValue
    }
    const pnl = value - invested
    return { totalValue: value, totalInvested: invested, totalPnl: pnl, totalReturnPct: invested > 0 ? (pnl / invested) * 100 : 0 }
  }, [groups])

  function toggleExpanded(type: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

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
      <PageHeader title="Commodities" description="Track your investments in precious metals">
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
              <Button
                variant="outline"
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 dark:border-amber-500/50 dark:hover:bg-amber-500/10"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Commodity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Commodity Holding</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
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
        <div className="space-y-6">
          {/* ── Stats bar ───────────────────────────────────────────── */}
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:gap-0 sm:divide-x sm:p-5">
            <div className="flex items-center gap-3 sm:flex-1 sm:pr-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                <WalletIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Value</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold tabular-nums">{formatCompact(totalValue)}</p>
                  <span className={cn("flex items-center gap-0.5 text-xs font-medium tabular-nums", totalReturnPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {totalReturnPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatPercent(Math.abs(totalReturnPct))}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:flex-1 sm:px-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Invested</p>
                <p className="text-xl font-bold tabular-nums">{formatCompact(totalInvested)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:flex-1 sm:pl-6">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", totalPnl >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
                {totalPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total P/L</p>
                <div className="flex items-baseline gap-2">
                  <p className={cn("text-xl font-bold tabular-nums", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {totalPnl >= 0 ? "+" : ""}{formatCompact(totalPnl)}
                  </p>
                  <span className={cn("flex items-center gap-0.5 text-xs font-medium tabular-nums", totalReturnPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {totalReturnPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatPercent(Math.abs(totalReturnPct))}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Holdings ────────────────────────────────────────────── */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">Holdings</h2>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border sm:block">
              <div className="grid grid-cols-[1.7fr_0.8fr_1.7fr_1.7fr_1.3fr_0.9fr_0.9fr_40px] gap-3 border-b bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                <span>Commodity</span>
                <span>Quantity</span>
                <span>Purchase Price</span>
                <span>Current Value</span>
                <span>P/L</span>
                <span>Return</span>
                <span>Last Bought</span>
                <span />
              </div>
              <div className="divide-y">
                {groups.map((g) => {
                  const Icon = typeIcon(g.type)
                  const isExpanded = expanded.has(g.type)
                  const multiLot = g.lots.length > 1
                  const singleLot = g.lots[0]
                  return (
                    <div key={g.type}>
                      <div
                        className={cn("grid grid-cols-[1.7fr_0.8fr_1.7fr_1.7fr_1.3fr_0.9fr_0.9fr_40px] items-center gap-3 px-4 py-3.5", multiLot && "cursor-pointer hover:bg-muted/20")}
                        onClick={multiLot ? () => toggleExpanded(g.type) : undefined}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", typeIconColor(g.type))}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold capitalize">{g.type}</p>
                            <p className="truncate text-xs text-muted-foreground tabular-nums">
                              {g.totalQty} {g.unit} held{multiLot ? ` · ${g.lots.length} lots` : ""}
                            </p>
                          </div>
                        </div>
                        <span className="font-medium tabular-nums">{g.totalQty} {g.unit}</span>
                        <span className="tabular-nums">{withCompact(g.investedAmount)}</span>
                        <span className="font-medium tabular-nums">{withCompact(g.totalCurrentValue)}</span>
                        <span className={cn("font-medium tabular-nums", g.totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {g.totalPnl >= 0 ? "+" : ""}{withCompact(g.totalPnl)}
                        </span>
                        <span className={cn("font-medium tabular-nums", g.returnPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {g.returnPct >= 0 ? "+" : ""}{formatPercent(g.returnPct)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {g.lastBought.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                        <div onClick={(e) => e.stopPropagation()}>
                          {multiLot ? (
                            <button
                              onClick={() => toggleExpanded(g.type)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!singleLot.isSold && (
                                  <DropdownMenuItem onClick={() => { setSellId(singleLot.id); setSellAmount("") }}>
                                    <TrendingDown className="mr-2 h-3.5 w-3.5" /> Sell
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => { setDeleteId(singleLot.id); setDeleteName(g.type) }}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>

                      {multiLot && isExpanded && (
                        <div className="bg-muted/10 px-4 pb-4">
                          <p className="pb-2 pt-1 text-sm font-semibold">Purchase Lots</p>
                          <div className="overflow-hidden rounded-lg border">
                            <div className="grid grid-cols-[1.4fr_0.8fr_1.1fr_1.7fr_1.7fr_1.2fr_0.9fr_40px] gap-3 border-b bg-background px-3 py-2 text-[11px] font-medium text-muted-foreground">
                              <span>Lot</span>
                              <span>Quantity</span>
                              <span>Purchase Date</span>
                              <span>Paid Amount</span>
                              <span>Current Value</span>
                              <span>P/L</span>
                              <span>Return</span>
                              <span />
                            </div>
                            <div className="divide-y">
                              {g.lots.map((lot, i) => (
                                <div key={lot.id} className={cn("grid grid-cols-[1.4fr_0.8fr_1.1fr_1.7fr_1.7fr_1.2fr_0.9fr_40px] items-center gap-3 px-3 py-3 text-sm", lot.isSold && "opacity-60")}>
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                      <Icon className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate font-medium">Lot {g.lots.length - i}{lot.isSold ? " (sold)" : ""}</p>
                                      <p className="text-xs text-muted-foreground tabular-nums">{lot.buyQty} {lot.unit}</p>
                                    </div>
                                  </div>
                                  <span className="tabular-nums">{lot.isSold ? lot.buyQty : lot.qty} {lot.unit}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(lot.purchaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                  <span className="tabular-nums">{withCompact(lot.totalCostPaid)}</span>
                                  <span className="tabular-nums">{withCompact(lot.isSold ? (lot.totalReceived ?? 0) : lot.currentValue)}</span>
                                  <span className={cn("font-medium tabular-nums", lot.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                                    {lot.pnl >= 0 ? "+" : ""}{withCompact(lot.pnl)}
                                  </span>
                                  <span className={cn("font-medium tabular-nums", lot.returnPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                                    {lot.returnPct >= 0 ? "+" : ""}{formatPercent(lot.returnPct)}
                                  </span>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                                        <MoreVertical className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {!lot.isSold && (
                                        <DropdownMenuItem onClick={() => { setSellId(lot.id); setSellAmount("") }}>
                                          <TrendingDown className="mr-2 h-3.5 w-3.5" /> Sell
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => { setDeleteId(lot.id); setDeleteName(g.type) }}
                                      >
                                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              ))}
                              <div className="grid grid-cols-[1.4fr_0.8fr_1.1fr_1.7fr_1.7fr_1.2fr_0.9fr_40px] items-center gap-3 bg-background px-3 py-3 text-sm font-semibold">
                                <span className="flex items-center gap-2.5">
                                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                                  Total ({g.type})
                                </span>
                                <span />
                                <span />
                                <span className="tabular-nums">{withCompact(g.investedAmount)}</span>
                                <span className="tabular-nums">{withCompact(g.totalCurrentValue)}</span>
                                <span className={cn("tabular-nums", g.totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                                  {g.totalPnl >= 0 ? "+" : ""}{withCompact(g.totalPnl)}
                                </span>
                                <span className={cn("tabular-nums", g.returnPct >= 0 ? "text-emerald-400" : "text-red-400")}>
                                  {g.returnPct >= 0 ? "+" : ""}{formatPercent(g.returnPct)}
                                </span>
                                <span />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 sm:hidden">
              {groups.map((g) => {
                const Icon = typeIcon(g.type)
                const isExpanded = expanded.has(g.type)
                const multiLot = g.lots.length > 1
                const singleLot = g.lots[0]
                return (
                  <div key={g.type} className="overflow-hidden rounded-xl border">
                    <div
                      className="flex items-center gap-3 p-3"
                      onClick={multiLot ? () => toggleExpanded(g.type) : undefined}
                    >
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", typeIconColor(g.type))}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold capitalize">{g.type}</p>
                        <p className="truncate text-xs text-muted-foreground tabular-nums">
                          {g.totalQty} {g.unit} held{multiLot ? ` · ${g.lots.length} lots` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{formatCompact(g.totalCurrentValue)}</p>
                        <p className={cn("text-xs font-medium tabular-nums", g.totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {g.totalPnl >= 0 ? "+" : ""}{formatCompact(g.totalPnl)} ({g.returnPct >= 0 ? "+" : ""}{formatPercent(g.returnPct)})
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        {multiLot ? (
                          <button onClick={() => toggleExpanded(g.type)} className="flex h-7 w-7 items-center justify-center text-muted-foreground">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex h-7 w-7 items-center justify-center text-muted-foreground">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!singleLot.isSold && (
                                <DropdownMenuItem onClick={() => { setSellId(singleLot.id); setSellAmount("") }}>
                                  <TrendingDown className="mr-2 h-3.5 w-3.5" /> Sell
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => { setDeleteId(singleLot.id); setDeleteName(g.type) }}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {multiLot && isExpanded && (
                      <div className="divide-y border-t bg-muted/10">
                        {g.lots.map((lot, i) => (
                          <div key={lot.id} className={cn("flex items-center gap-2.5 p-3", lot.isSold && "opacity-60")}>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">Lot {g.lots.length - i}{lot.isSold ? " (sold)" : ""} — {lot.isSold ? lot.buyQty : lot.qty} {lot.unit}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(lot.purchaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · Paid {formatCompact(lot.totalCostPaid)}
                              </p>
                            </div>
                            <p className={cn("shrink-0 text-xs font-semibold tabular-nums", lot.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                              {lot.pnl >= 0 ? "+" : ""}{formatCompact(lot.pnl)}
                            </p>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground">
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!lot.isSold && (
                                  <DropdownMenuItem onClick={() => { setSellId(lot.id); setSellAmount("") }}>
                                    <TrendingDown className="mr-2 h-3.5 w-3.5" /> Sell
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => { setDeleteId(lot.id); setDeleteName(g.type) }}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
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
        note="Any wallet transactions created when buying or selling this commodity will be kept as-is — they represent real cash flows. Delete them manually from the Cash Flow ledger if needed."
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
