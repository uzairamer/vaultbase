"use client"

import { useState, useMemo } from "react"
import { useTransactions, useDeleteTransaction, useWallets, useCategories } from "@/modules/expenses/hooks"
import { AddTransactionDialog } from "@/modules/expenses/components/add-transaction-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Receipt, Trash2, ArrowDownLeft, ArrowUpRight, X, Filter } from "lucide-react"
import { cn, formatCurrency, formatCompact } from "@/lib/utils"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { INFLOW_SUBTYPES, OUTFLOW_SUBTYPES } from "@/lib/constants"

const ALL_SUBTYPES = [...INFLOW_SUBTYPES, ...OUTFLOW_SUBTYPES]
const SUBTYPE_LABELS: Record<string, string> = Object.fromEntries(
  ALL_SUBTYPES.map((s) => [s.value, s.label])
)

export default function ExpensesPage() {
  const { data: transactions = [], isLoading } = useTransactions()
  const { data: wallets = [] } = useWallets()
  const { data: categories = [] } = useCategories()
  const deleteTx = useDeleteTransaction()
  const [open, setOpen] = useState(false)

  // Filter state
  const [filterType, setFilterType] = useState<"all" | "inflow" | "outflow">("all")
  const [filterSubType, setFilterSubType] = useState<string>("all")
  const [filterWallet, setFilterWallet] = useState<string>("all")
  const [filterCategories, setFilterCategories] = useState<string[]>([]) // empty = all; "none" = untagged
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)

  const txList = transactions as Record<string, unknown>[]

  function toggleCategory(id: string) {
    setFilterCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const filtered = useMemo(() => {
    return txList.filter((tx) => {
      if (filterType !== "all" && tx.type !== filterType) return false
      if (filterSubType !== "all" && tx.subType !== filterSubType) return false
      if (filterWallet !== "all" && tx.walletId !== filterWallet) return false
      if (filterCategories.length > 0) {
        const matchesNone = filterCategories.includes("none") && !tx.categoryId
        const matchesTag  = filterCategories.some((id) => id !== "none" && tx.categoryId === id)
        if (!matchesNone && !matchesTag) return false
      }
      if (filterDateFrom) {
        const txDate = new Date(tx.date as string)
        if (txDate < new Date(filterDateFrom)) return false
      }
      if (filterDateTo) {
        const txDate = new Date(tx.date as string)
        if (txDate > new Date(filterDateTo + "T23:59:59")) return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const desc = ((tx.description as string) || "").toLowerCase()
        const walletName = ((tx.wallet as Record<string, string>)?.name || "").toLowerCase()
        const catName = ((tx.category as Record<string, string>)?.name || "").toLowerCase()
        if (!desc.includes(q) && !walletName.includes(q) && !catName.includes(q)) return false
      }
      return true
    })
  }, [txList, filterType, filterSubType, filterWallet, filterCategories, filterDateFrom, filterDateTo, searchQuery])

  const activeFilterCount = [
    filterType !== "all",
    filterSubType !== "all",
    filterWallet !== "all",
    filterCategories.length > 0,
    !!filterDateFrom,
    !!filterDateTo,
  ].filter(Boolean).length

  const cashFiltered = filtered.filter((t) => t.source !== "reconciliation")
  const totalInflow = cashFiltered.filter((t) => t.type === "inflow").reduce((sum, t) => sum + Number(t.amount), 0)
  const totalOutflow = cashFiltered.filter((t) => t.type === "outflow").reduce((sum, t) => sum + Number(t.amount), 0)

  function clearFilters() {
    setFilterType("all")
    setFilterSubType("all")
    setFilterWallet("all")
    setFilterCategories([])
    setFilterDateFrom("")
    setFilterDateTo("")
    setSearchQuery("")
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Transaction Ledger" description="Complete record of all transactions">
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Transaction</Button>
        <AddTransactionDialog open={open} onOpenChange={setOpen} />
      </PageHeader>

      {txList.length === 0 ? (
        <EmptyState icon={Receipt} title="No transactions yet" description="Add your first transaction to start tracking your money." />
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid gap-2 sm:gap-3 grid-cols-3">
            {(() => {
              const net = totalInflow - totalOutflow
              const netPositive = net >= 0
              const netGrad = netPositive
                ? { from: "from-emerald-500/25", to: "to-teal-500/5", ring: "ring-emerald-500/40", accent: "text-emerald-400" }
                : { from: "from-red-500/25", to: "to-rose-500/5", ring: "ring-red-500/40", accent: "text-red-400" }
              return (
                <button onClick={() => setFilterType("all")} className={cn(
                  "relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 sm:p-4 ring-1 text-left transition-all hover:ring-2",
                  netGrad.from, netGrad.to, netGrad.ring,
                  filterType === "all" && "ring-2",
                )}>
                  <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground font-medium">Net</p>
                  <p className={cn("text-sm sm:text-lg font-bold tabular-nums leading-tight truncate mt-0.5", netPositive ? "text-emerald-400" : "text-red-400")}>
                    {netPositive ? "+" : ""}{formatCompact(net)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{filtered.length} transactions</p>
                </button>
              )
            })()}
            <button onClick={() => setFilterType(filterType === "inflow" ? "all" : "inflow")} className={cn(
              "relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-500/25 to-teal-500/5 p-3 sm:p-4 ring-1 ring-emerald-500/40 text-left transition-all hover:ring-2 hover:ring-emerald-400/70",
              filterType === "inflow" && "ring-2 ring-emerald-400",
            )}>
              <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground font-medium">Total Inflow</p>
              <p className="text-sm sm:text-lg font-bold text-emerald-400 tabular-nums leading-tight truncate mt-0.5">+{formatCompact(totalInflow)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{cashFiltered.filter((t) => t.type === "inflow").length} transactions</p>
            </button>
            <button onClick={() => setFilterType(filterType === "outflow" ? "all" : "outflow")} className={cn(
              "relative overflow-hidden rounded-xl border bg-gradient-to-br from-red-500/25 to-rose-500/5 p-3 sm:p-4 ring-1 ring-red-500/40 text-left transition-all hover:ring-2 hover:ring-red-400/70",
              filterType === "outflow" && "ring-2 ring-red-400",
            )}>
              <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground font-medium">Total Outflow</p>
              <p className="text-sm sm:text-lg font-bold text-red-400 tabular-nums leading-tight truncate mt-0.5">-{formatCompact(totalOutflow)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{cashFiltered.filter((t) => t.type === "outflow").length} transactions</p>
            </button>
          </div>

          {/* Search + filter toggle */}
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              placeholder="Search description, wallet, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Button variant={showFilters ? "default" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1">
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{activeFilterCount}</Badge>}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs">
                <X className="h-3 w-3" /> Clear all
              </Button>
            )}
          </div>

          {/* Filter panel */}
          {showFilters && (
            <Card>
              <CardContent className="p-4">
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Type</Label>
                    <Select value={filterType} onValueChange={(v) => { setFilterType(v as typeof filterType); if (v === "all") setFilterSubType("all") }}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="inflow">Inflow</SelectItem>
                        <SelectItem value="outflow">Outflow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sub-type</Label>
                    <Select value={filterSubType} onValueChange={(v) => setFilterSubType(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sub-types</SelectItem>
                        {filterType !== "outflow" && INFLOW_SUBTYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        {filterType !== "inflow" && OUTFLOW_SUBTYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Wallet</Label>
                    <Select value={filterWallet} onValueChange={(v) => setFilterWallet(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Wallets</SelectItem>
                        {(wallets as Record<string, string>[]).map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Tags</Label>
                      {filterCategories.length > 0 && (
                        <button onClick={() => setFilterCategories([])} className="text-[10px] text-muted-foreground hover:text-foreground">
                          Clear ({filterCategories.length})
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {/* Untagged chip */}
                      <button
                        onClick={() => toggleCategory("none")}
                        className={cn(
                          "h-7 rounded-full border px-2.5 text-xs transition-colors",
                          filterCategories.includes("none")
                            ? "bg-foreground text-background border-foreground"
                            : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                        )}
                      >
                        Untagged
                      </button>
                      {(categories as Record<string, string>[]).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => toggleCategory(c.id)}
                          className={cn(
                            "h-7 rounded-full border px-2.5 text-xs transition-colors",
                            filterCategories.includes(c.id)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                          )}
                        >
                          {c.name}
                        </button>
                      ))}
                      {(categories as Record<string, string>[]).length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No tags yet</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Date Range</Label>
                    <div className="flex gap-1">
                      <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-9 text-xs" />
                      <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-9 text-xs" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction list */}
          <Card>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No transactions match the current filters.</div>
              ) : (
                <div className="divide-y">
                  {filtered.map((tx) => (
                    <div key={tx.id as string} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${tx.type === "inflow" ? "bg-green-100 dark:bg-green-950" : "bg-red-100 dark:bg-red-950"}`}>
                          {tx.type === "inflow"
                            ? <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                            : <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {(tx.description as string) || SUBTYPE_LABELS[tx.subType as string] || (tx.type === "inflow" ? "Inflow" : "Outflow")}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                            <span>{format(new Date(tx.date as string), "MMM dd, yyyy")}</span>
                            <span>·</span>
                            <span>{(tx.wallet as Record<string, string>)?.name || ""}</span>
                            {tx.subType ? (
                              <>
                                <span>·</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{SUBTYPE_LABELS[tx.subType as string] || (tx.subType as string)}</Badge>
                              </>
                            ) : null}
                            {(tx.category as Record<string, string>)?.name ? (
                              <>
                                <span>·</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{(tx.category as Record<string, string>).name}</Badge>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                        <span className={`text-sm font-semibold ${tx.type === "inflow" ? "text-green-600" : "text-red-600"}`}>
                          {tx.type === "inflow" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                        </span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          deleteTx.mutate(tx.id as string, { onSuccess: () => toast.success("Transaction deleted") })
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
