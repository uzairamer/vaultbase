"use client"

import { useState, useMemo, use } from "react"
import { BusinessSummaryCard } from "@/components/shared/business-summary-card"
import {
  useLedger,
  useCreateEntry,
  useUpdateEntry,
  useDeleteEntry,
  useInventory,
  useBusinesses,
} from "@/modules/businesses/hooks"
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  PAYMENT_METHODS,
} from "@/lib/business-constants"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog"
import { cn, formatCurrency, formatCompact } from "@/lib/utils"
import {
  Plus,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Package,
} from "lucide-react"
import { toast } from "sonner"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"

// ── Types ──────────────────────────────────────────────────────────────────────

interface LedgerEntry {
  id: string
  type: "income" | "expense"
  category: string
  subcategory?: string | null
  description?: string | null
  amount: string | number
  date: string
  paymentMethod?: string | null
  linkedInventoryId?: string | null
  linkedInventory?: {
    id: string
    name: string
    unit?: string | null
  } | null
  quantitySold?: number | null
}

interface InventoryItem {
  id: string
  name: string
  unit?: string | null
  quantity: number
  sellingPrice: string | number
}

interface Business {
  id: string
  name: string
}

type DatePreset = "this-month" | "last-month" | "last-3-months" | "all-time"
type TypeFilter = "all" | "income" | "expense"

interface Filters {
  dateFrom: string
  dateTo: string
  preset: DatePreset
  type: TypeFilter
  category: string
}

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  type: "income" | "expense"
  category: string
  customCategory: string
  subcategory: string
  amount: string
  date: string
  description: string
  paymentMethod: string
  linkedInventoryId: string
  quantitySold: string
}

const DEFAULT_FORM: FormState = {
  type: "income",
  category: "",
  customCategory: "",
  subcategory: "",
  amount: "",
  date: format(new Date(), "yyyy-MM-dd"),
  description: "",
  paymentMethod: "",
  linkedInventoryId: "",
  quantitySold: "",
}

// ── Date preset helpers ────────────────────────────────────────────────────────

function getPresetDates(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const today = new Date()
  if (preset === "this-month") {
    return {
      dateFrom: format(startOfMonth(today), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(today), "yyyy-MM-dd"),
    }
  }
  if (preset === "last-month") {
    const last = subMonths(today, 1)
    return {
      dateFrom: format(startOfMonth(last), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(last), "yyyy-MM-dd"),
    }
  }
  if (preset === "last-3-months") {
    return {
      dateFrom: format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd"),
      dateTo: format(endOfMonth(today), "yyyy-MM-dd"),
    }
  }
  // all-time
  return { dateFrom: "", dateTo: "" }
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function LedgerPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params)

  // ── Businesses (for name) ──────────────────────────────────────────────────
  const { data: rawBusinesses = [] } = useBusinesses()
  const businesses = rawBusinesses as Business[]
  const business = businesses.find((b) => b.id === businessId)

  // ── Filters ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Filters>(() => {
    const dates = getPresetDates("this-month")
    return { ...dates, preset: "this-month", type: "all", category: "" }
  })

  // Mobile filter panel toggle
  const [showMobileFilter, setShowMobileFilter] = useState(false)

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {}
    if (filters.dateFrom) p.dateFrom = filters.dateFrom
    if (filters.dateTo) p.dateTo = filters.dateTo
    if (filters.type !== "all") p.type = filters.type
    if (filters.category) p.category = filters.category
    return p
  }, [filters])

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: rawLedger = [], isLoading: ledgerLoading } = useLedger(businessId, queryParams)
  const { data: rawInventory = [] } = useInventory(businessId)

  const entries = rawLedger as LedgerEntry[]
  const inventory = rawInventory as InventoryItem[]

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createEntry = useCreateEntry(businessId)
  const updateEntry = useUpdateEntry(businessId)
  const deleteEntry = useDeleteEntry(businessId)

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LedgerEntry | null>(null)

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [stockError, setStockError] = useState("")

  // ── Summary tiles ──────────────────────────────────────────────────────────
  const { totalIncome, totalExpenses, netProfit } = useMemo(() => {
    let inc = 0
    let exp = 0
    for (const e of entries) {
      const amt = typeof e.amount === "string" ? parseFloat(e.amount) : e.amount
      if (e.type === "income") inc += amt
      else exp += amt
    }
    return { totalIncome: inc, totalExpenses: exp, netProfit: inc - exp }
  }, [entries])

  // ── All unique categories from entries (for filter dropdown) ───────────────
  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const e of entries) cats.add(e.category)
    DEFAULT_INCOME_CATEGORIES.forEach((c) => cats.add(c))
    DEFAULT_EXPENSE_CATEGORIES.forEach((c) => cats.add(c))
    return Array.from(cats).sort()
  }, [entries])

  // ── Linked inventory product details for sales ─────────────────────────────
  const linkedItem = useMemo(() => {
    if (!form.linkedInventoryId) return null
    return inventory.find((i) => i.id === form.linkedInventoryId) ?? null
  }, [form.linkedInventoryId, inventory])

  // ── Auto-fill amount when qty × price ─────────────────────────────────────
  function handleQtyChange(qty: string) {
    setForm((prev) => {
      const newForm = { ...prev, quantitySold: qty }
      if (linkedItem && qty) {
        const price =
          typeof linkedItem.sellingPrice === "string"
            ? parseFloat(linkedItem.sellingPrice)
            : linkedItem.sellingPrice
        const computed = parseFloat(qty) * price
        if (!isNaN(computed)) newForm.amount = computed.toFixed(2)
      }
      return newForm
    })
    setStockError("")
  }

  function handleInventoryChange(id: string) {
    setForm((prev) => ({ ...prev, linkedInventoryId: id, quantitySold: "", amount: "" }))
    setStockError("")
  }

  // ── Open dialog ────────────────────────────────────────────────────────────
  function openCreate() {
    setEditingEntry(null)
    setForm(DEFAULT_FORM)
    setStockError("")
    setDialogOpen(true)
  }

  function openEdit(entry: LedgerEntry) {
    setEditingEntry(entry)
    setForm({
      type: entry.type,
      category: entry.category,
      customCategory: "",
      subcategory: entry.subcategory ?? "",
      amount: String(entry.amount),
      date: format(new Date(entry.date), "yyyy-MM-dd"),
      description: entry.description ?? "",
      paymentMethod: entry.paymentMethod ?? "",
      linkedInventoryId: entry.linkedInventoryId ?? "",
      quantitySold: entry.quantitySold ? String(entry.quantitySold) : "",
    })
    setStockError("")
    setDialogOpen(true)
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const finalCategory = form.customCategory || form.category
    if (!finalCategory) {
      toast.error("Please select or enter a category")
      return
    }

    // Validate stock
    if (form.type === "income" && form.category === "Sales Revenue" && form.linkedInventoryId) {
      const qty = parseFloat(form.quantitySold)
      if (isNaN(qty) || qty <= 0) {
        setStockError("Please enter a valid quantity")
        return
      }
      if (linkedItem) {
        const available = editingEntry?.linkedInventoryId === form.linkedInventoryId
          ? linkedItem.quantity + (editingEntry.quantitySold ?? 0)
          : linkedItem.quantity
        if (qty > available) {
          setStockError(`Only ${available} units available in stock`)
          return
        }
      }
    }

    const payload: Record<string, unknown> = {
      type: form.type,
      category: finalCategory,
      subcategory: form.subcategory || undefined,
      amount: parseFloat(form.amount),
      date: form.date,
      description: form.description || undefined,
      paymentMethod: form.paymentMethod || undefined,
      linkedInventoryId:
        form.type === "income" && form.category === "Sales Revenue" && form.linkedInventoryId
          ? form.linkedInventoryId
          : undefined,
      quantitySold:
        form.type === "income" && form.category === "Sales Revenue" && form.linkedInventoryId && form.quantitySold
          ? parseFloat(form.quantitySold)
          : undefined,
    }

    if (editingEntry) {
      updateEntry.mutate(
        { id: editingEntry.id, ...payload },
        {
          onSuccess: () => {
            toast.success("Entry updated")
            setDialogOpen(false)
          },
          onError: (err) => toast.error(err.message),
        }
      )
    } else {
      createEntry.mutate(payload, {
        onSuccess: () => {
          toast.success("Entry added")
          setDialogOpen(false)
        },
        onError: (err) => toast.error(err.message),
      })
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  function handleDeleteConfirm() {
    if (!deleteTarget) return
    deleteEntry.mutate(deleteTarget.id, {
      onSuccess: () => toast.success("Entry deleted"),
      onError: (err) => toast.error(err.message),
    })
    setDeleteTarget(null)
  }

  // ── Preset handler ─────────────────────────────────────────────────────────
  function applyPreset(preset: DatePreset) {
    const dates = getPresetDates(preset)
    setFilters((prev) => ({ ...prev, ...dates, preset }))
  }

  const isPending = createEntry.isPending || updateEntry.isPending

  // ── Category options for the form ─────────────────────────────────────────
  const categoryOptions =
    form.type === "income"
      ? DEFAULT_INCOME_CATEGORIES
      : DEFAULT_EXPENSE_CATEGORIES

  const showSalesSection =
    form.type === "income" && form.category === "Sales Revenue"

  // ── Preset label helper ────────────────────────────────────────────────────
  function presetLabel(preset: DatePreset) {
    if (preset === "this-month") return "This Month"
    if (preset === "last-month") return "Last Month"
    if (preset === "last-3-months") return "Last 3M"
    return "All Time"
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <PageHeader
        title={business ? `${business.name} — Ledger` : "Ledger"}
        description="Track income and expenses for this business"
      >
        {/* Desktop: Add Transaction button in header */}
        <Button className="hidden sm:flex" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </PageHeader>

      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      {/* Mobile: single unified summary card */}
      <BusinessSummaryCard
        rows={[
          { label: "Income",   value: totalIncome,   color: "emerald" },
          { label: "Expenses", value: totalExpenses, color: "red" },
        ]}
        net={netProfit}
      />

      {/* Desktop: grid tiles */}
      <div className="hidden sm:grid grid-cols-3 gap-3 mb-6">
        {/* Total Income */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-500/20 to-teal-500/5 ring-1 ring-emerald-500/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-emerald-500/15 p-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Income</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-400">{formatCompact(totalIncome)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(totalIncome)}</p>
        </div>

        {/* Total Expenses */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-red-500/20 to-rose-500/5 ring-1 ring-red-500/30 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-red-500/15 p-1.5">
              <TrendingDown className="h-4 w-4 text-red-400" />
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Expenses</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-red-400">{formatCompact(totalExpenses)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(totalExpenses)}</p>
        </div>

        {/* Net Profit/Loss */}
        <div
          className={cn(
            "relative overflow-hidden rounded-xl border ring-1 p-4",
            netProfit >= 0
              ? "bg-gradient-to-br from-indigo-500/20 to-violet-500/5 ring-indigo-500/30"
              : "bg-gradient-to-br from-red-500/20 to-rose-500/5 ring-red-500/30"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("rounded-lg p-1.5", netProfit >= 0 ? "bg-indigo-500/15" : "bg-red-500/15")}>
              {netProfit >= 0 ? (
                <ArrowUpRight className={cn("h-4 w-4", netProfit >= 0 ? "text-indigo-400" : "text-red-400")} />
              ) : (
                <ArrowDownLeft className="h-4 w-4 text-red-400" />
              )}
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {netProfit >= 0 ? "Net Profit" : "Net Loss"}
            </p>
          </div>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              netProfit >= 0 ? "text-indigo-400" : "text-red-400"
            )}
          >
            {formatCompact(Math.abs(netProfit))}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(netProfit)}</p>
        </div>
      </div>

      {/* ── Filter row — Mobile ────────────────────────────────────────────── */}
      <div className="sm:hidden mb-4 space-y-2">
        {/* Date preset pills — horizontally scrollable */}
        <div className="flex overflow-x-auto gap-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["this-month", "last-month", "last-3-months", "all-time"] as DatePreset[]).map((preset) => (
            <button
              key={preset}
              onClick={() => applyPreset(preset)}
              className={cn(
                "flex-shrink-0 h-7 px-3 text-xs rounded-full border font-medium transition-colors",
                filters.preset === preset
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border"
              )}
            >
              {presetLabel(preset)}
            </button>
          ))}
        </div>

        {/* Type toggles + Filter icon */}
        <div className="flex items-center gap-2">
          {(["all", "income", "expense"] as TypeFilter[]).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={filters.type === t ? "default" : "outline"}
              className="h-7 text-xs px-3 rounded-full capitalize flex-1"
              onClick={() => setFilters((prev) => ({ ...prev, type: t }))}
            >
              {t === "all" ? "All" : t === "income" ? "Income" : "Expense"}
            </Button>
          ))}
          {/* Filter icon button — toggles category select */}
          <button
            onClick={() => setShowMobileFilter((v) => !v)}
            className={cn(
              "flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-full border transition-colors",
              showMobileFilter || filters.category
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Category select — shown when filter icon tapped */}
        {showMobileFilter && (
          <Select
            value={filters.category || "__all__"}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, category: v === "__all__" ? "" : v }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {allCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Filter row — Desktop ───────────────────────────────────────────── */}
      <div className="hidden sm:flex flex-wrap items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* Date presets */}
        {(["this-month", "last-month", "last-3-months", "all-time"] as DatePreset[]).map((preset) => (
          <Button
            key={preset}
            size="sm"
            variant={filters.preset === preset ? "default" : "outline"}
            className="h-7 text-xs px-2.5"
            onClick={() => applyPreset(preset)}
          >
            {preset === "this-month"
              ? "This Month"
              : preset === "last-month"
              ? "Last Month"
              : preset === "last-3-months"
              ? "Last 3 Months"
              : "All Time"}
          </Button>
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        {/* Type toggle */}
        {(["all", "income", "expense"] as TypeFilter[]).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={filters.type === t ? "default" : "outline"}
            className="h-7 text-xs px-2.5 capitalize"
            onClick={() => setFilters((prev) => ({ ...prev, type: t }))}
          >
            {t === "all" ? "All" : t === "income" ? "Income" : "Expense"}
          </Button>
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        {/* Category filter */}
        <Select
          value={filters.category || "__all__"}
          onValueChange={(v) => setFilters((prev) => ({ ...prev, category: v === "__all__" ? "" : v }))}
        >
          <SelectTrigger className="h-7 text-xs w-[160px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Categories</SelectItem>
            {allCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Transactions ───────────────────────────────────────────────────── */}
      {ledgerLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
      ) : entries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-5 mb-5">
              <ArrowUpRight className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No transactions yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Start by recording your first income or expense entry.
            </p>
            {/* CTA hidden on mobile — FAB handles it */}
            <Button className="hidden sm:flex" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile card list */}
          <Card className="sm:hidden p-0">
            <CardContent className="p-0">
              {entries.map((entry) => {
                const amt = typeof entry.amount === "string" ? parseFloat(entry.amount) : entry.amount
                const isIncome = entry.type === "income"
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-4 py-3 border-b last:border-0 min-h-[64px]"
                  >
                    {/* Left: colored circle icon */}
                    <div
                      className={cn(
                        "flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center",
                        isIncome ? "bg-emerald-500/15" : "bg-red-500/15"
                      )}
                    >
                      {isIncome ? (
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-400" />
                      )}
                    </div>

                    {/* Center: category, description, date */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-sm leading-tight">{entry.category}</span>
                        {entry.linkedInventory && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 flex items-center gap-0.5">
                            <Package className="h-2.5 w-2.5" />
                            {entry.linkedInventory.name}
                          </Badge>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-xs text-muted-foreground truncate leading-tight">{entry.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground leading-tight">
                        {format(new Date(entry.date), "MMM d, yyyy")}
                      </p>
                    </div>

                    {/* Right: amount, payment method badge, actions */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1">
                      <span
                        className={cn(
                          "font-bold text-sm tabular-nums",
                          isIncome ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {formatCurrency(amt)}
                      </span>
                      {entry.paymentMethod && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                          {entry.paymentMethod}
                        </Badge>
                      )}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => openEdit(entry)}
                          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(entry)}
                          className="rounded-md p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Desktop table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Description</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Payment</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Linked Product</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => {
                    const amt = typeof entry.amount === "string" ? parseFloat(entry.amount) : entry.amount
                    return (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                          {format(new Date(entry.date), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0 font-normal",
                              entry.type === "income"
                                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                : "border-red-500/40 text-red-400 bg-red-500/10"
                            )}
                          >
                            {entry.type === "income" ? "Income" : "Expense"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-xs">{entry.category}</span>
                          {entry.subcategory && (
                            <p className="text-[10px] text-muted-foreground">{entry.subcategory}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">
                          {entry.description ?? "—"}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right font-semibold tabular-nums text-sm whitespace-nowrap",
                            entry.type === "income" ? "text-emerald-400" : "text-red-400"
                          )}
                        >
                          {formatCurrency(amt)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {entry.paymentMethod ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {entry.linkedInventory ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-medium">{entry.linkedInventory.name}</span>
                              {entry.quantitySold != null && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-fit">
                                  qty: {entry.quantitySold}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(entry)}
                              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(entry)}
                              className="rounded-md p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── FAB — mobile only ──────────────────────────────────────────────── */}
      <button
        onClick={openCreate}
        className="sm:hidden fixed bottom-24 right-5 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Add Transaction"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* ── Add/Edit Dialog ────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, type: "income", category: "", customCategory: "", linkedInventoryId: "", quantitySold: "" }))}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-all",
                  form.type === "income"
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
                    : "border-border text-muted-foreground hover:border-border hover:bg-muted/40"
                )}
              >
                <ArrowDownLeft className="h-4 w-4" />
                Income
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, type: "expense", category: "", customCategory: "", linkedInventoryId: "", quantitySold: "" }))}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-all",
                  form.type === "expense"
                    ? "border-red-500 bg-red-500/15 text-red-400"
                    : "border-border text-muted-foreground hover:border-border hover:bg-muted/40"
                )}
              >
                <ArrowUpRight className="h-4 w-4" />
                Expense
              </button>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((prev) => ({ ...prev, category: v, customCategory: "", linkedInventoryId: "", quantitySold: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {form.category === "__custom__" && (
                <Input
                  placeholder="Enter custom category"
                  value={form.customCategory}
                  onChange={(e) => setForm((prev) => ({ ...prev, customCategory: e.target.value }))}
                  required
                />
              )}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>
                Description{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                placeholder="Notes about this transaction..."
                rows={2}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={form.paymentMethod || "__none__"}
                onValueChange={(v) => setForm((prev) => ({ ...prev, paymentMethod: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategory */}
            <div className="space-y-2">
              <Label>
                Subcategory{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. Facebook Ads, Amazon FBA..."
                value={form.subcategory}
                onChange={(e) => setForm((prev) => ({ ...prev, subcategory: e.target.value }))}
              />
            </div>

            {/* Sales Revenue — inventory link */}
            {showSalesSection && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4">
                <p className="text-xs font-medium text-emerald-400">Link to Inventory Product</p>

                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select
                    value={form.linkedInventoryId || "__none__"}
                    onValueChange={(v) => handleInventoryChange(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {inventory.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {linkedItem && (
                  <>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Selling price: {formatCurrency(typeof linkedItem.sellingPrice === "string" ? parseFloat(linkedItem.sellingPrice) : linkedItem.sellingPrice)}</span>
                      <span className={cn("font-medium", linkedItem.quantity === 0 ? "text-red-400" : "text-emerald-400")}>
                        Stock: {linkedItem.quantity} {linkedItem.unit ?? "units"} available
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label>Quantity Sold</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="0"
                        value={form.quantitySold}
                        onChange={(e) => handleQtyChange(e.target.value)}
                      />
                      {stockError && (
                        <p className="text-xs text-red-400">{stockError}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending
                ? editingEntry
                  ? "Saving..."
                  : "Adding..."
                : editingEntry
                ? "Save Changes"
                : "Add Transaction"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete Transaction"
        description={`Are you sure you want to delete this ${deleteTarget?.type ?? "entry"}? This action cannot be undone.`}
        note={
          deleteTarget?.linkedInventory
            ? "Deleting this sale will restore the linked inventory quantity back to stock."
            : undefined
        }
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
