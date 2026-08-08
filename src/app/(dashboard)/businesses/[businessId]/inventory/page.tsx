"use client"

import { useState, useMemo, use, useRef, useCallback } from "react"
import {
  useInventory,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useBusinesses,
} from "@/modules/businesses/hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog"
import { cn, formatCurrency, formatCompact } from "@/lib/utils"
import { BusinessSummaryCard } from "@/components/shared/business-summary-card"
import { Plus, Pencil, Trash2, AlertTriangle, Package, Search, Upload, X, ImageIcon } from "lucide-react"
import { toast } from "sonner"

// ── Types ──────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string
  name: string
  sku?: string | null
  category?: string | null
  quantity: number
  lowStockThreshold: number
  purchasePrice: string | number
  sellingPrice?: string | number | null
  vendor?: string | null
  description?: string | null
  productUrl?: string | null
  imageUrl?: string | null
}

interface Business { id: string; name: string }

interface FormState {
  name: string; sku: string; category: string; customCategory: string
  quantity: string; lowStockThreshold: string
  purchasePrice: string; sellingPrice: string
  vendor: string; customVendor: string
  description: string; productUrl: string; imageUrl: string
}

const DEFAULT_FORM: FormState = {
  name: "", sku: "", category: "", customCategory: "",
  quantity: "0", lowStockThreshold: "5",
  purchasePrice: "", sellingPrice: "",
  vendor: "", customVendor: "",
  description: "", productUrl: "", imageUrl: "",
}

// ── Image compression ─────────────────────────────────────────────────────────

async function compressImage(file: File, maxDim = 400, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = reject
    img.src = url
  })
}

// ── Markup helper ─────────────────────────────────────────────────────────────

function markupPct(purchase: string, selling: string): number | null {
  const p = parseFloat(purchase); const s = parseFloat(selling)
  if (!p || !s || p <= 0) return null
  return ((s - p) / p) * 100
}

// ── ComboSelect: select from existing OR type a new value ────────────────────

function ComboSelect({
  label, value, customValue, options, placeholder, customPlaceholder,
  onChange, onCustomChange,
}: {
  label: string; value: string; customValue: string; options: string[]
  placeholder: string; customPlaceholder: string
  onChange: (v: string) => void; onCustomChange: (v: string) => void
}) {
  const isCustom = value === "__custom__"
  return (
    <div className="space-y-2">
      <Label>{label} <span className="text-xs text-muted-foreground">(optional)</span></Label>
      <Select value={value || "__none__"} onValueChange={(v) => { onChange(v === "__none__" ? "" : v); if (v !== "__custom__") onCustomChange("") }}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— None —</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          <SelectItem value="__custom__">+ Add new…</SelectItem>
        </SelectContent>
      </Select>
      {isCustom && (
        <Input placeholder={customPlaceholder} value={customValue} onChange={(e) => onCustomChange(e.target.value)} autoFocus />
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function InventoryPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params)
  const { data: rawBusinesses = [] } = useBusinesses()
  const business = (rawBusinesses as Business[]).find((b) => b.id === businessId)
  const { data: rawInventory = [], isLoading } = useInventory(businessId)
  const inventory = rawInventory as InventoryItem[]

  const createItem = useCreateInventoryItem(businessId)
  const updateItem = useUpdateInventoryItem(businessId)
  const deleteItem = useDeleteInventoryItem(businessId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [sellingPriceEdited, setSellingPriceEdited] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setF = useCallback((patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch })), [])

  // derived lists from inventory
  const allCategories = useMemo(() => {
    const s = new Set<string>()
    inventory.forEach((i) => { if (i.category) s.add(i.category) })
    return Array.from(s).sort()
  }, [inventory])

  const allVendors = useMemo(() => {
    const s = new Set<string>()
    inventory.forEach((i) => { if (i.vendor) s.add(i.vendor) })
    return Array.from(s).sort()
  }, [inventory])

  const { totalProducts, totalValue, lowStockCount } = useMemo(() => {
    let value = 0; let low = 0
    inventory.forEach((i) => {
      const p = typeof i.purchasePrice === "string" ? parseFloat(i.purchasePrice) : i.purchasePrice
      value += i.quantity * (isNaN(p) ? 0 : p)
      if (i.quantity <= i.lowStockThreshold) low++
    })
    return { totalProducts: inventory.length, totalValue: value, lowStockCount: low }
  }, [inventory])

  const filtered = useMemo(() => {
    let r = inventory
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((i) => i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q) || (i.vendor ?? "").toLowerCase().includes(q))
    }
    if (categoryFilter) r = r.filter((i) => i.category === categoryFilter)
    return r
  }, [inventory, search, categoryFilter])

  // ── Dialog open ───────────────────────────────────────────────────────────
  function openCreate() {
    setEditingItem(null)
    setForm(DEFAULT_FORM)
    setSellingPriceEdited(false)
    setDialogOpen(true)
  }

  function openEdit(item: InventoryItem) {
    setEditingItem(item)
    setForm({
      name: item.name, sku: item.sku ?? "", category: item.category ?? "", customCategory: "",
      quantity: String(item.quantity), lowStockThreshold: String(item.lowStockThreshold),
      purchasePrice: String(item.purchasePrice),
      sellingPrice: item.sellingPrice != null ? String(item.sellingPrice) : "",
      vendor: item.vendor ?? "", customVendor: "",
      description: item.description ?? "", productUrl: item.productUrl ?? "", imageUrl: item.imageUrl ?? "",
    })
    setSellingPriceEdited(true) // don't auto-override on edit
    setDialogOpen(true)
  }

  // ── Purchase price change: auto-set selling to 2× if untouched ───────────
  function handlePurchasePriceChange(v: string) {
    setF({ purchasePrice: v })
    if (!sellingPriceEdited) {
      const n = parseFloat(v)
      setF({ purchasePrice: v, sellingPrice: isNaN(n) ? "" : String(n * 2) })
    }
  }

  function handleSellingPriceChange(v: string) {
    setSellingPriceEdited(true)
    setF({ sellingPrice: v })
  }

  // ── Image upload + compress ───────────────────────────────────────────────
  async function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return }
    setUploadingImage(true)
    try {
      const compressed = await compressImage(file)
      setF({ imageUrl: compressed })
      toast.success("Image uploaded and compressed")
    } catch {
      toast.error("Failed to process image")
    } finally {
      setUploadingImage(false)
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Product name is required"); return }
    if (!form.purchasePrice || isNaN(parseFloat(form.purchasePrice))) { toast.error("Purchase price is required"); return }

    const finalCategory = form.category === "__custom__" ? form.customCategory.trim() : (form.category === "__none__" ? "" : form.category)
    const finalVendor = form.vendor === "__custom__" ? form.customVendor.trim() : (form.vendor === "__none__" ? "" : form.vendor)

    const payload: Record<string, unknown> = {
      name: form.name.trim(), sku: form.sku.trim() || undefined,
      category: finalCategory || undefined, quantity: parseInt(form.quantity) || 0,
      lowStockThreshold: parseInt(form.lowStockThreshold) || 5,
      purchasePrice: parseFloat(form.purchasePrice),
      sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : undefined,
      vendor: finalVendor || undefined, description: form.description.trim() || undefined,
      productUrl: form.productUrl.trim() || undefined,
      imageUrl: form.imageUrl || undefined,
    }

    const opts = {
      onSuccess: () => { toast.success(editingItem ? "Product updated" : "Product added"); setDialogOpen(false) },
      onError: (err: Error) => toast.error(err.message),
    }
    if (editingItem) updateItem.mutate({ id: editingItem.id, ...payload }, opts)
    else createItem.mutate(payload, opts)
  }

  const isPending = createItem.isPending || updateItem.isPending
  const markup = markupPct(form.purchasePrice, form.sellingPrice)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Inventory" description={business ? `Products for ${business.name}` : "Manage your product inventory"}>
        <span className="hidden sm:block">
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
        </span>
      </PageHeader>

      {/* Mobile: single unified summary card */}
      <BusinessSummaryCard
        rows={[
          { label: "Products",       value: totalProducts, color: "muted" },
          { label: "Inventory Value", value: totalValue,   color: "emerald" },
          { label: "Low Stock Items", value: lowStockCount, color: lowStockCount > 0 ? "red" : "muted" },
        ]}
      />

      {/* Summary tiles — desktop: grid */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border bg-gradient-to-br from-indigo-500/20 to-violet-500/5 ring-1 ring-indigo-500/30 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Products</p>
          <p className="text-2xl font-bold tabular-nums text-indigo-400">{totalProducts}</p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-emerald-500/20 to-teal-500/5 ring-1 ring-emerald-500/30 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Inventory Value</p>
          <p className="text-2xl font-bold tabular-nums text-emerald-400">{formatCompact(totalValue)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(totalValue)}</p>
        </div>
        <div className={cn("rounded-xl border ring-1 p-4", lowStockCount > 0 ? "bg-gradient-to-br from-red-500/20 to-rose-500/5 ring-red-500/30" : "bg-gradient-to-br from-muted/40 to-muted/10 ring-border")}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Low Stock</p>
          <p className={cn("text-2xl font-bold tabular-nums", lowStockCount > 0 ? "text-red-400" : "")}>{lowStockCount}</p>
          <p className="text-xs text-muted-foreground">{lowStockCount === 0 ? "All stocked up" : `${lowStockCount} item${lowStockCount > 1 ? "s" : ""} need restocking`}</p>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search products, SKUs, vendors…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {allCategories.length > 0 && (
          <Select value={categoryFilter || "__all__"} onValueChange={(v) => setCategoryFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Categories</SelectItem>
              {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Product list — mobile only */}
      <div className="sm:hidden">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading inventory…</div>
        ) : inventory.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-5 mb-5"><Package className="h-10 w-10 text-muted-foreground" /></div>
              <h3 className="text-lg font-semibold mb-1">No products yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">Add your first product to start tracking inventory and linking sales.</p>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No products match your search.</div>
        ) : (
          <Card className="p-0 overflow-hidden mb-4">
            {filtered.map((item) => {
              const isLow = item.quantity <= item.lowStockThreshold
              const pp = parseFloat(String(item.purchasePrice))
              const sp = item.sellingPrice ? parseFloat(String(item.sellingPrice)) : null
              const colors = ["bg-indigo-500/20 text-indigo-400", "bg-emerald-500/20 text-emerald-400", "bg-amber-500/20 text-amber-400", "bg-rose-500/20 text-rose-400", "bg-violet-500/20 text-violet-400", "bg-sky-500/20 text-sky-400"]
              let h = 0; for (const c of item.name) h = (h << 5) - h + c.charCodeAt(0)
              const avatarClass = colors[Math.abs(h) % colors.length]
              return (
                <div key={item.id} className={`flex items-center gap-3 px-4 py-3 border-b last:border-0 min-h-[68px] ${isLow ? "bg-red-500/5" : ""}`}>
                  {/* Avatar or image */}
                  {item.imageUrl
                    ? <img src={item.imageUrl} className="h-10 w-10 rounded-lg object-cover shrink-0" alt={item.name} />
                    : <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${avatarClass}`}>{item.name.charAt(0).toUpperCase()}</div>
                  }
                  {/* Center */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.sku && <span className="text-[11px] text-muted-foreground">SKU: {item.sku}</span>}
                      {item.category && <Badge variant="outline" className="text-[10px] px-1 h-4">{item.category}</Badge>}
                    </div>
                  </div>
                  {/* Right */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <Badge className={isLow ? "bg-red-500 text-white text-[10px]" : "bg-muted text-muted-foreground text-[10px]"}>{item.quantity}</Badge>
                    {sp && <span className="text-xs font-semibold text-emerald-400 tabular-nums">{formatCurrency(sp)}</span>}
                    <span className="text-[11px] text-muted-foreground tabular-nums">{formatCurrency(pp)}</span>
                  </div>
                  {/* Actions */}
                  <div className="shrink-0 flex flex-col gap-0.5">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-muted"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" /></button>
                  </div>
                </div>
              )
            })}
          </Card>
        )}
      </div>

      {/* Table — desktop only */}
      <div className="hidden sm:block">
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading inventory…</div>
        ) : inventory.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-5 mb-5"><Package className="h-10 w-10 text-muted-foreground" /></div>
              <h3 className="text-lg font-semibold mb-1">No products yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">Add your first product to start tracking inventory and linking sales.</p>
              <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No products match your search.</div>
        ) : (
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/40">
                  <TableHead className="w-12 hidden sm:table-cell">Img</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Markup</TableHead>
                  <TableHead className="hidden lg:table-cell">Vendor</TableHead>
                  <TableHead className="text-right w-16">Act</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const isLow = item.quantity <= item.lowStockThreshold
                  const pp = typeof item.purchasePrice === "string" ? parseFloat(item.purchasePrice) : item.purchasePrice
                  const sp = item.sellingPrice != null ? (typeof item.sellingPrice === "string" ? parseFloat(item.sellingPrice) : item.sellingPrice) : null
                  const mu = sp && pp ? ((sp - pp) / pp) * 100 : null

                  return (
                    <TableRow key={item.id} className={cn(isLow && "bg-red-500/5")}>
                      {/* Image */}
                      <TableCell className="hidden sm:table-cell py-2 px-3">
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.name} className="h-10 w-10 rounded-lg object-cover border" />
                          : <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                        }
                      </TableCell>
                      {/* Name */}
                      <TableCell className="py-2 px-3">
                        <p className="font-medium text-sm truncate max-w-[150px]">{item.name}</p>
                        {item.sku && <p className="text-[11px] text-muted-foreground">SKU: {item.sku}</p>}
                        {isLow && <span className="flex items-center gap-1 text-[10px] text-red-400 mt-0.5"><AlertTriangle className="h-3 w-3" />Low stock</span>}
                      </TableCell>
                      {/* Category */}
                      <TableCell className="hidden md:table-cell py-2 px-3">
                        {item.category ? <Badge variant="outline" className="text-[10px]">{item.category}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      {/* Qty */}
                      <TableCell className={cn("text-right py-2 px-3 font-semibold tabular-nums text-sm", isLow ? "text-red-400" : "")}>{item.quantity}</TableCell>
                      {/* Cost */}
                      <TableCell className="text-right py-2 px-3 tabular-nums text-sm hidden sm:table-cell">{formatCurrency(pp)}</TableCell>
                      {/* Selling price */}
                      <TableCell className="text-right py-2 px-3 tabular-nums text-sm text-emerald-400 font-medium">
                        {sp != null ? formatCurrency(sp) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      {/* Markup */}
                      <TableCell className="text-right py-2 px-3 text-xs tabular-nums hidden lg:table-cell">
                        {mu != null ? <span className={mu >= 0 ? "text-emerald-400" : "text-red-400"}>{mu.toFixed(0)}%</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      {/* Vendor */}
                      <TableCell className="py-2 px-3 text-sm text-muted-foreground hidden lg:table-cell">{item.vendor ?? "—"}</TableCell>
                      {/* Actions */}
                      <TableCell className="py-2 px-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* FAB — mobile only */}
      <button onClick={openCreate} className="sm:hidden fixed bottom-24 right-5 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center">
        <Plus className="h-6 w-6" />
      </button>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Image upload */}
            <div className="space-y-2">
              <Label>Product Image <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <div className="flex items-center gap-3">
                {form.imageUrl
                  ? <div className="relative shrink-0">
                      <img src={form.imageUrl} alt="preview" className="h-16 w-16 rounded-lg object-cover border" />
                      <button type="button" onClick={() => setF({ imageUrl: "" })} className="absolute -top-1.5 -right-1.5 rounded-full bg-background border p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
                    </div>
                  : <div className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted/30 shrink-0"><ImageIcon className="h-6 w-6 text-muted-foreground" /></div>
                }
                <div className="flex-1 space-y-1">
                  <Button type="button" variant="outline" size="sm" disabled={uploadingImage} onClick={() => fileInputRef.current?.click()} className="w-full">
                    <Upload className="mr-2 h-3.5 w-3.5" />
                    {uploadingImage ? "Compressing…" : "Upload Image"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">Image is compressed to ≤400px JPEG before saving.</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = "" }} />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Nike Air Max 90" value={form.name} onChange={(e) => setF({ name: e.target.value })} required />
            </div>

            {/* SKU + Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SKU <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input placeholder="e.g. NK-90-BLK" value={form.sku} onChange={(e) => setF({ sku: e.target.value })} />
              </div>
              <ComboSelect
                label="Category"
                value={form.category} customValue={form.customCategory}
                options={allCategories} placeholder="Select category" customPlaceholder="New category name"
                onChange={(v) => setF({ category: v })} onCustomChange={(v) => setF({ customCategory: v })}
              />
            </div>

            {/* Qty + Threshold */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="0" step="1" placeholder="0" value={form.quantity} onChange={(e) => setF({ quantity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Low Stock Alert</Label>
                <Input type="number" min="0" step="1" placeholder="5" value={form.lowStockThreshold} onChange={(e) => setF({ lowStockThreshold: e.target.value })} />
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Price <span className="text-destructive">*</span></Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.purchasePrice} onChange={(e) => handlePurchasePriceChange(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Selling Price <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.sellingPrice} onChange={(e) => handleSellingPriceChange(e.target.value)} />
                {markup != null && (
                  <p className={cn("text-[11px] tabular-nums", markup >= 0 ? "text-emerald-400" : "text-red-400")}>
                    Markup: {markup.toFixed(1)}%{markup === 100 ? " (2×)" : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Vendor */}
            <ComboSelect
              label="Vendor"
              value={form.vendor} customValue={form.customVendor}
              options={allVendors} placeholder="Select vendor" customPlaceholder="New vendor name"
              onChange={(v) => setF({ vendor: v })} onCustomChange={(v) => setF({ customVendor: v })}
            />

            {/* Description */}
            <div className="space-y-2">
              <Label>Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Textarea placeholder="Product notes…" rows={2} value={form.description} onChange={(e) => setF({ description: e.target.value })} />
            </div>

            {/* Product URL */}
            <div className="space-y-2">
              <Label>Product URL <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input type="url" placeholder="https://…" value={form.productUrl} onChange={(e) => setF({ productUrl: e.target.value })} />
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (editingItem ? "Saving…" : "Adding…") : (editingItem ? "Save Changes" : "Add Product")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="Delete Product"
        description={`Delete "${deleteTarget?.name ?? "this product"}"? This cannot be undone.`}
        note="Cannot delete a product with linked sales — archive it instead if needed."
        onConfirm={() => { if (!deleteTarget) return; deleteItem.mutate(deleteTarget.id, { onSuccess: () => { toast.success("Deleted"); setDeleteTarget(null) }, onError: (e) => toast.error(e.message) }) }}
      />
    </div>
  )
}
