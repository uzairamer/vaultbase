"use client"

import { useState } from "react"
import {
  useBusinesses,
  useCreateBusiness,
  useUpdateBusiness,
  useDeleteBusiness,
} from "@/modules/businesses/hooks"
import { BUSINESS_TYPES } from "@/lib/business-constants"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { cn } from "@/lib/utils"
import { Plus, Building2, Archive, Pencil, Trash2, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { format } from "date-fns"

// ── Types ──────────────────────────────────────────────────────────────────────

interface BusinessCount {
  entries: number
  inventory: number
}

interface Business {
  id: string
  name: string
  type: string
  currency: string
  startDate: string | null
  description: string | null
  isArchived: boolean
  createdAt: string
  _count: BusinessCount
}

// ── Avatar colour helpers ──────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-sky-500",
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function businessTypeLabel(type: string) {
  return BUSINESS_TYPES.find((t) => t.value === type)?.label ?? type
}

// ── Create/Edit Dialog ─────────────────────────────────────────────────────────

interface BusinessFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Business | null
  onClose: () => void
}

function BusinessFormDialog({ open, onOpenChange, editing, onClose }: BusinessFormDialogProps) {
  const createBusiness = useCreateBusiness()
  const updateBusiness = useUpdateBusiness()
  const isPending = createBusiness.isPending || updateBusiness.isPending

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)

    const payload: Record<string, unknown> = {
      name: fd.get("name") as string,
      type: fd.get("type") as string,
      currency: (fd.get("currency") as string) || "PKR",
      startDate: (fd.get("startDate") as string) || undefined,
      description: (fd.get("description") as string) || undefined,
    }

    if (editing) {
      updateBusiness.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast.success("Business updated")
            onClose()
          },
          onError: (err) => toast.error(err.message),
        }
      )
    } else {
      createBusiness.mutate(payload, {
        onSuccess: () => {
          toast.success("Business created")
          onClose()
        },
        onError: (err) => toast.error(err.message),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Business" : "New Business"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input
              name="name"
              placeholder="e.g. My Online Store"
              required
              defaultValue={editing?.name ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label>Business Type</Label>
            <Select name="type" defaultValue={editing?.type ?? "other"} required>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                name="currency"
                placeholder="PKR"
                defaultValue={editing?.currency ?? "PKR"}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Start Date{" "}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                name="startDate"
                type="date"
                defaultValue={
                  editing?.startDate
                    ? new Date(editing.startDate).toISOString().split("T")[0]
                    : ""
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Description{" "}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              name="description"
              placeholder="A short description of this business..."
              rows={3}
              defaultValue={editing?.description ?? ""}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? editing
                ? "Saving..."
                : "Creating..."
              : editing
              ? "Save Changes"
              : "Create Business"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BusinessesPage() {
  const { data: rawBusinesses = [], isLoading } = useBusinesses()
  const updateBusiness = useUpdateBusiness()
  const deleteBusiness = useDeleteBusiness()

  const businesses = rawBusinesses as Business[]

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null)

  function handleArchiveToggle(biz: Business) {
    const action = biz.isArchived ? "unarchive" : "archive"
    const confirmed = window.confirm(
      biz.isArchived
        ? `Unarchive "${biz.name}"?`
        : `Archive "${biz.name}"? It will be hidden from this list.`
    )
    if (!confirmed) return

    updateBusiness.mutate(
      { id: biz.id, isArchived: !biz.isArchived },
      {
        onSuccess: () => toast.success(`Business ${action}d`),
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handleDelete(biz: Business) {
    if (biz._count.entries > 0) {
      toast.error("Cannot delete a business with ledger entries. Archive it instead.")
      return
    }
    const confirmed = window.confirm(`Permanently delete "${biz.name}"? This cannot be undone.`)
    if (!confirmed) return

    deleteBusiness.mutate(biz.id, {
      onSuccess: () => toast.success("Business deleted"),
      onError: (err) => toast.error(err.message),
    })
  }

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>

  const activeCount = businesses.filter((b) => !b.isArchived).length

  return (
    <div className="pb-28 sm:pb-6">
      {/* ── Page header — desktop button only ── */}
      <PageHeader
        title="Businesses"
        description={
          businesses.length === 0
            ? "No businesses yet"
            : `${activeCount} active business${activeCount !== 1 ? "es" : ""}${
                businesses.length > activeCount
                  ? `, ${businesses.length - activeCount} archived`
                  : ""
              }`
        }
      >
        {/* Desktop-only "New Business" button in header */}
        <div className="hidden sm:block">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Business
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </PageHeader>

      {/* Dialogs (rendered outside trigger so they work from FAB too) */}
      <BusinessFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        editing={null}
        onClose={() => setCreateOpen(false)}
      />
      <BusinessFormDialog
        open={!!editingBusiness}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingBusiness(null)
        }}
        editing={editingBusiness}
        onClose={() => setEditingBusiness(null)}
      />

      {/* ── Empty state ── */}
      {businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="rounded-full bg-muted p-6 mb-5">
            <Building2 className="h-14 w-14 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Start tracking your first business</h3>
          <p className="text-sm text-muted-foreground mb-8 max-w-xs">
            Track income, expenses, and inventory across all your ventures.
          </p>
          <Button size="lg" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Business
          </Button>
        </div>
      ) : (
        <>
          {/* ── Mobile: flat list inside a single card ── */}
          <div className="sm:hidden">
            <Card className="rounded-xl overflow-hidden p-0">
              {businesses.map((biz, idx) => {
                const color = avatarColor(biz.name)
                const entryCount = biz._count.entries

                return (
                  <div
                    key={biz.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 min-h-[72px] border-b last:border-b-0 border-border/60",
                      biz.isArchived && "opacity-60"
                    )}
                  >
                    {/* Left: avatar */}
                    <div
                      className={cn(
                        "flex-shrink-0 h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-base",
                        color
                      )}
                    >
                      {biz.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Center: info — tappable area navigates to ledger */}
                    <Link
                      href={`/businesses/${biz.id}/ledger`}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm leading-tight truncate">
                          {biz.name}
                        </span>
                        {biz.isArchived && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            Archived
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {businessTypeLabel(biz.type)} &middot; {biz.currency}
                        {biz.startDate
                          ? ` · Since ${format(new Date(biz.startDate), "MMM yyyy")}`
                          : ""}
                      </p>
                    </Link>

                    {/* Right: entry count badge + actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {entryCount > 0 && (
                        <Badge variant="secondary" className="text-xs font-medium tabular-nums">
                          {entryCount}
                        </Badge>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => setEditingBusiness(biz)}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* Archive toggle */}
                      <button
                        onClick={() => handleArchiveToggle(biz)}
                        className={cn(
                          "rounded-md p-1.5 transition-colors",
                          biz.isArchived
                            ? "text-muted-foreground hover:text-foreground"
                            : "text-muted-foreground hover:text-amber-600"
                        )}
                        title={biz.isArchived ? "Unarchive" : "Archive"}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete (only when no entries) */}
                      {entryCount === 0 && (
                        <button
                          onClick={() => handleDelete(biz)}
                          className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 ml-0.5" />
                    </div>
                  </div>
                )
              })}
            </Card>
          </div>

          {/* ── Desktop: 2-col grid of cards ── */}
          <div className="hidden sm:grid sm:grid-cols-2 gap-3">
            {businesses.map((biz) => {
              const color = avatarColor(biz.name)
              const entryCount = biz._count.entries
              const inventoryCount = biz._count.inventory

              return (
                <div
                  key={biz.id}
                  className={cn(
                    "relative rounded-xl border bg-card p-4 flex flex-col gap-3 transition-all hover:shadow-sm",
                    biz.isArchived && "opacity-60"
                  )}
                >
                  {/* Top row: avatar + info + actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={cn(
                          "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm",
                          color
                        )}
                      >
                        {biz.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm leading-tight truncate">
                            {biz.name}
                          </p>
                          {biz.isArchived && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 shrink-0"
                            >
                              Archived
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 font-normal"
                          >
                            {businessTypeLabel(biz.type)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 font-normal"
                          >
                            {biz.currency}
                          </Badge>
                          {biz.startDate && (
                            <span className="text-[10px] text-muted-foreground">
                              Since {format(new Date(biz.startDate), "MMM yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingBusiness(biz)}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchiveToggle(biz)}
                        className={cn(
                          "rounded-md p-1.5 transition-colors",
                          biz.isArchived
                            ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                            : "text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        )}
                        title={biz.isArchived ? "Unarchive" : "Archive"}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                      {entryCount === 0 && (
                        <button
                          onClick={() => handleDelete(biz)}
                          className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stat boxes */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                        Entries
                      </p>
                      <p className="text-lg font-bold tabular-nums leading-tight mt-0.5">
                        {entryCount}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 border border-border/50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                        Products
                      </p>
                      <p className="text-lg font-bold tabular-nums leading-tight mt-0.5">
                        {inventoryCount}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {biz.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {biz.description}
                    </p>
                  )}

                  {/* Open link */}
                  <div className="mt-auto pt-1">
                    <Link
                      href={`/businesses/${biz.id}/ledger`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground transition-colors group"
                    >
                      Open
                      <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Mobile FAB ── */}
      <button
        onClick={() => setCreateOpen(true)}
        className="sm:hidden fixed bottom-24 right-5 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all"
        aria-label="New Business"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}
