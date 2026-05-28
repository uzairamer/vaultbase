"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useProperties, useCreateProperty, useDeleteProperty } from "@/modules/investments/hooks"
import { InvestmentArchiveDialog } from "@/modules/investments/components/archive-dialog"
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Building2, Trash2, MapPin, Archive } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn, formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { toast } from "sonner"

const PROPERTY_ACCENTS = [
  { from: "from-orange-500/25",  to: "to-red-500/5",     ring: "ring-orange-500/40",  ringHover: "hover:ring-orange-400/70",  badge: "bg-orange-500/10 border-orange-500/40 text-orange-300",  bar: "from-orange-400 to-amber-300",   pct: "text-orange-300" },
  { from: "from-violet-500/25",  to: "to-purple-500/5",   ring: "ring-violet-500/40",  ringHover: "hover:ring-violet-400/70",  badge: "bg-violet-500/10 border-violet-500/40 text-violet-300",  bar: "from-violet-400 to-purple-300",  pct: "text-violet-300" },
  { from: "from-sky-500/25",     to: "to-blue-500/5",     ring: "ring-sky-500/40",     ringHover: "hover:ring-sky-400/70",     badge: "bg-sky-500/10 border-sky-500/40 text-sky-300",           bar: "from-sky-400 to-blue-300",       pct: "text-sky-300" },
  { from: "from-emerald-500/25", to: "to-teal-500/5",     ring: "ring-emerald-500/40", ringHover: "hover:ring-emerald-400/70", badge: "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",bar: "from-emerald-400 to-teal-300",   pct: "text-emerald-300" },
  { from: "from-pink-500/25",    to: "to-rose-500/5",     ring: "ring-pink-500/40",    ringHover: "hover:ring-pink-400/70",    badge: "bg-pink-500/10 border-pink-500/40 text-pink-300",         bar: "from-pink-400 to-rose-300",      pct: "text-pink-300" },
  { from: "from-amber-500/25",   to: "to-yellow-500/5",   ring: "ring-amber-500/40",   ringHover: "hover:ring-amber-400/70",   badge: "bg-amber-500/10 border-amber-500/40 text-amber-300",      bar: "from-amber-400 to-yellow-300",   pct: "text-amber-300" },
]

function propertyAccent(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return PROPERTY_ACCENTS[Math.abs(h) % PROPERTY_ACCENTS.length]
}

export default function RealEstatePage() {
  const router = useRouter()
  const { data: properties = [], isLoading } = useProperties()
  const createProperty = useCreateProperty()
  const deleteProperty = useDeleteProperty()
  const [open, setOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState("")

  const totalValue = (properties as Record<string, unknown>[]).reduce(
    (sum: number, p: Record<string, unknown>) => sum + Number(p.currentValue ?? p.totalPrice),
    0
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const monthly = Number(fd.get("monthlyInstallment") || 0)
    const balloonAmt = Number(fd.get("balloonAmount") || 0)
    const balloonEvery = Number(fd.get("balloonEveryNMonths") || 0)
    const startDate = fd.get("installmentStartDate") as string
    const dueDay = Number(fd.get("installmentDueDay") || 0)
    const months = Number(fd.get("installmentMonths") || 0)

    createProperty.mutate(
      {
        name: fd.get("name") as string,
        location: (fd.get("location") as string) || undefined,
        totalPrice: Number(fd.get("totalPrice")),
        downPayment: Number(fd.get("downPayment") || 0),
        currentValue: Number(fd.get("currentValue")) || undefined,
        purchaseDate: fd.get("purchaseDate") as string,
        notes: (fd.get("notes") as string) || undefined,
        monthlyInstallment: monthly > 0 ? monthly : null,
        balloonAmount: balloonAmt > 0 ? balloonAmt : null,
        balloonEveryNMonths: balloonEvery > 0 ? balloonEvery : null,
        installmentStartDate: startDate || null,
        installmentDueDay: dueDay > 0 ? dueDay : null,
        installmentMonths: months > 0 ? months : null,
      },
      {
        onSuccess: () => { setOpen(false); toast.success("Property added") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader title="Real Estate" description={`Total value: ${formatCurrency(totalValue)}`}>
        {(properties as Record<string, unknown>[]).length > 0 && (
          <Button variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-950" onClick={() => setArchiveOpen(true)}>
            <Archive className="mr-2 h-4 w-4" /> Archive All
          </Button>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Property</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Property</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" placeholder="e.g. DHA Phase 8 Plot" required />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input name="location" placeholder="e.g. DHA Phase 8, Lahore" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Price</Label>
                  <Input name="totalPrice" type="number" step="0.01" min="0" required />
                </div>
                <div className="space-y-2">
                  <Label>Down Payment</Label>
                  <Input name="downPayment" type="number" step="0.01" min="0" defaultValue="0" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current Value (est.)</Label>
                  <Input name="currentValue" type="number" step="0.01" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Purchase Date</Label>
                  <Input name="purchaseDate" type="date" required />
                </div>
              </div>

              {/* Installment schedule */}
              <div className="space-y-3 rounded-lg border border-dashed border-muted-foreground/30 p-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Installment Schedule (optional)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Monthly Installment</Label>
                    <Input name="monthlyInstallment" type="number" step="0.01" min="0" placeholder="e.g. 80000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tenure (months)</Label>
                    <Input name="installmentMonths" type="number" min="1" max="600" placeholder="e.g. 36" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Date</Label>
                    <Input name="installmentStartDate" type="date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Due Day (1-31)</Label>
                    <Input name="installmentDueDay" type="number" min="1" max="31" placeholder="e.g. 5" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Balloon Amount</Label>
                    <Input name="balloonAmount" type="number" step="0.01" min="0" placeholder="e.g. 20000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Balloon Every N Months</Label>
                    <Input name="balloonEveryNMonths" type="number" min="1" max="60" placeholder="e.g. 6" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  If provided, an installment ledger will be auto-generated. Balloon payments are added on top of monthly installments every Nth month.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea name="notes" />
              </div>
              <Button type="submit" className="w-full" disabled={createProperty.isPending}>
                {createProperty.isPending ? "Adding..." : "Add Property"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {(properties as Record<string, unknown>[]).length === 0 ? (
        <EmptyState icon={Building2} title="No properties" description="Track your real estate investments here." />
      ) : (
        <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {(properties as Record<string, unknown>[]).map((p) => {
            const installments = (p.installments as Record<string, unknown>[]) || []
            const hasDownpaymentEntry = installments.some((i) => i.type === "downpayment")
            const paidFromLedger = installments
              .filter((i) => i.status === "paid")
              .reduce((sum: number, i) => sum + Number(i.amount), 0)
            const totalPaid = paidFromLedger + (hasDownpaymentEntry ? 0 : Number(p.downPayment))
            const overdueDebt = installments
              .filter((i) => i.status === "unpaid")
              .reduce((sum: number, i) => sum + Number(i.amount), 0)
            const pendingDebt = installments
              .filter((i) => i.status === "pending")
              .reduce((sum: number, i) => sum + Number(i.amount), 0)
            const debt = overdueDebt + pendingDebt
            const totalPrice = Number(p.totalPrice)
            const paidPct = totalPrice > 0 ? Math.min(100, (totalPaid / totalPrice) * 100) : 0
            const accent = propertyAccent(p.name as string)
            return (
              <div key={p.id as string} onClick={() => router.push(`/investments/real-estate/${p.id}`)} className="cursor-pointer">
                <div className={cn(
                  "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 ring-1 transition-all cursor-pointer hover:ring-2 h-full flex flex-col",
                  accent.from, accent.to, accent.ring, accent.ringHover,
                )}>
                  {/* Top: name + status + delete */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold truncate">{p.name as string}</p>
                      {p.location ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{p.location as string}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className={cn("text-[10px] h-5", accent.badge)}>{p.status as string}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
                        e.stopPropagation()
                        setDeleteId(p.id as string); setDeleteName(p.name as string)
                      }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Big value */}
                  <p className="text-2xl font-bold tabular-nums">{formatCurrency(Number(p.currentValue ?? p.totalPrice))}</p>

                  {/* Progress bar */}
                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-background/40">
                      <div className={cn("h-full bg-gradient-to-r", accent.bar)} style={{ width: `${paidPct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] tabular-nums">
                      <span className="text-muted-foreground">Paid {formatCurrency(totalPaid)} / {formatCurrency(totalPrice)}</span>
                      <span className={cn("font-semibold", accent.pct)}>{paidPct.toFixed(0)}%</span>
                    </div>
                  </div>

                  {debt > 0 && (
                    <div className={cn(
                      "mt-1.5 text-xs font-medium tabular-nums",
                      overdueDebt > 0 ? "text-red-400" : "text-amber-300",
                    )}>
                      {overdueDebt > 0 ? "⚠" : "ⓘ"} Owed: {formatCurrency(debt)}
                      {overdueDebt > 0 && <span className="text-red-400"> ({formatCurrency(overdueDebt)} overdue)</span>}
                    </div>
                  )}

                  <div className="mt-auto pt-2 text-[11px] text-muted-foreground">
                    {installments.length} installments · Purchased {format(new Date(p.purchaseDate as string), "MMM yyyy")}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null) }}
        title={`Delete ${deleteName}?`}
        description={`This will permanently delete this property and its entire installment ledger. This cannot be undone.`}
        note="Any wallet transactions linked to this property remain in your expenses ledger — they represent real cash flows. Delete them manually if needed."
        onConfirm={() => deleteProperty.mutate(deleteId!, {
          onSuccess: () => toast.success("Deleted"),
          onError: (err) => toast.error(err.message),
        })}
        isPending={deleteProperty.isPending}
      />
      <InvestmentArchiveDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        type="realestate"
        itemCount={(properties as Record<string, unknown>[]).length}
      />
    </div>
  )
}
