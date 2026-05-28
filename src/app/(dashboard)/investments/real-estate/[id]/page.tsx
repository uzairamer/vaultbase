"use client"

import { use, useEffect, useMemo, useState } from "react"
import { useProperty, useCreateProperty, useUpdateInstallment, useAutoMarkInstallments, useRegenerateLedger } from "@/modules/investments/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatCard } from "@/components/shared/stat-card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Building2, DollarSign, CheckCircle, AlertTriangle, Wallet, Pencil, Check, X, Settings, TrendingUp } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { format, isAfter, isBefore, isThisYear } from "date-fns"
import { toast } from "sonner"

type Inst = {
  id: string
  type: string
  amount: number
  dueDate: string
  paidDate: string | null
  status: string
  receiptNote: string | null
}

function shortDate(d: Date): string {
  return format(d, isThisYear(d) ? "d MMM" : "d MMM ''yy")
}

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: property, isLoading } = useProperty(id)
  const createInstallment = useCreateProperty()
  const updateInstallment = useUpdateInstallment()
  const autoMark = useAutoMarkInstallments()
  const regenerate = useRegenerateLedger()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState("")

  useEffect(() => { autoMark.mutate(id) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const p = (property ?? {}) as Record<string, unknown>
  const installments = useMemo(
    () => ((p.installments as Inst[]) || []).map((i) => ({ ...i, amount: Number(i.amount) })),
    [p.installments]
  )

  const downPayment = Number(p.downPayment ?? 0)
  const totalPrice = Number(p.totalPrice ?? 0)
  const hasDownpaymentEntry = installments.some((i) => i.type === "downpayment")
  const paidFromLedger = installments.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0)
  const totalPaid = paidFromLedger + (hasDownpaymentEntry ? 0 : downPayment)
  // Outstanding = pending + unpaid (full remaining contractual obligation, the property liability)
  const pendingDebt = installments.filter((i) => i.status === "pending").reduce((sum, i) => sum + i.amount, 0)
  const overdueDebt = installments.filter((i) => i.status === "unpaid").reduce((sum, i) => sum + i.amount, 0)
  const debt = pendingDebt + overdueDebt
  const remaining = totalPrice - totalPaid - debt

  function handleAddInstallment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createInstallment.mutate(
      {
        propertyId: id,
        type: (fd.get("type") as string) || "regular",
        amount: Number(fd.get("amount")),
        dueDate: fd.get("dueDate") as string,
      },
      {
        onSuccess: () => { setOpen(false); toast.success("Installment added") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function setStatus(installmentId: string, status: "paid" | "unpaid" | "pending") {
    updateInstallment.mutate(
      { installmentId, status },
      {
        onSuccess: () => toast.success(status === "paid" ? "Marked paid" : status === "unpaid" ? "Marked unpaid (added to debt)" : "Reset to pending"),
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function startEdit(inst: Inst) {
    setEditingId(inst.id)
    setEditAmount(String(inst.amount))
  }
  function cancelEdit() {
    setEditingId(null)
    setEditAmount("")
  }
  function saveEdit() {
    if (!editingId) return
    const n = Number(editAmount)
    if (!isFinite(n) || n < 0) {
      toast.error("Enter a valid amount")
      return
    }
    updateInstallment.mutate(
      { installmentId: editingId, amount: n },
      {
        onSuccess: () => { toast.success("Amount updated"); cancelEdit() },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!property) return <div className="p-6">Property not found</div>

  const now = new Date()

  return (
    <div className="space-y-4">
      <PageHeader title={p.name as string} description={(p.location as string) || "Real Estate Investment"} />

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Price" value={formatCurrency(totalPrice)} icon={DollarSign} gradient={{ from: "from-indigo-500/25", to: "to-violet-500/5", ring: "ring-indigo-500/40", accent: "text-indigo-400" }} />
        <StatCard title="Current Value" value={formatCurrency(Number(p.currentValue ?? p.totalPrice))} icon={TrendingUp} gradient={{ from: "from-emerald-500/25", to: "to-teal-500/5", ring: "ring-emerald-500/40", accent: "text-emerald-400" }} />
        <StatCard title="Total Paid" value={formatCurrency(totalPaid)} icon={CheckCircle} gradient={{ from: "from-sky-500/25", to: "to-blue-500/5", ring: "ring-sky-500/40", accent: "text-sky-400" }} />
        <StatCard title="Remaining" value={formatCurrency(Math.max(0, remaining))} icon={Wallet} gradient={{ from: "from-amber-500/25", to: "to-orange-500/5", ring: "ring-amber-500/40", accent: "text-amber-400" }} />
      </div>

      {/* Payment progress bar */}
      {totalPrice > 0 && (() => {
        const paidPct = Math.min(100, (totalPaid / totalPrice) * 100)
        const debtPct = Math.min(100 - paidPct, (debt / totalPrice) * 100)
        return (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Payment Progress</span>
              <span className="font-semibold tabular-nums">{paidPct.toFixed(1)}% paid</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted flex">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all"
                style={{ width: `${paidPct}%` }}
                title={`Paid: ${formatCurrency(totalPaid)}`}
              />
              {debt > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-rose-600"
                  style={{ width: `${debtPct}%` }}
                  title={`Debt: ${formatCurrency(debt)}`}
                />
              )}
            </div>
          </div>
        )
      })()}

      {debt > 0 && (
        <div className={cn(
          "rounded-lg border px-3 py-2 flex items-start gap-2",
          overdueDebt > 0 ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5",
        )}>
          <AlertTriangle className={cn("h-4 w-4 shrink-0 mt-0.5", overdueDebt > 0 ? "text-red-500" : "text-amber-500")} />
          <div className="flex-1 min-w-0 text-xs space-y-0.5">
            <p className={cn("font-medium", overdueDebt > 0 ? "text-red-500" : "text-amber-500")}>
              Outstanding obligation: {formatCurrency(debt)}
            </p>
            <p className="text-muted-foreground tabular-nums">
              {pendingDebt > 0 && <>Pending future installments: <span className="text-foreground">{formatCurrency(pendingDebt)}</span></>}
              {pendingDebt > 0 && overdueDebt > 0 && <> · </>}
              {overdueDebt > 0 && <>Overdue: <span className="text-red-400">{formatCurrency(overdueDebt)}</span></>}
            </p>
            <p className="text-muted-foreground">
              Counted as a liability against this property in your net worth.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Installment Ledger</h2>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Past-due pending entries auto-mark as paid. Tap an amount to edit.
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="outline" onClick={() => { setScheduleOpen(true); setConfirmRegen("") }}>
            <Settings className="mr-1.5 h-3.5 w-3.5" /> Schedule
          </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Installment</DialogTitle></DialogHeader>
            <form onSubmit={handleAddInstallment} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <select name="type" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">
                  <option value="regular">Regular</option>
                  <option value="balloon">Balloon</option>
                  <option value="downpayment">Down Payment</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input name="amount" type="number" step="0.01" min="0" required />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input name="dueDate" type="date" required />
              </div>
              <Button type="submit" className="w-full">Add</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <EditScheduleDialog
        open={scheduleOpen}
        onOpenChange={(o) => { setScheduleOpen(o); if (!o) setConfirmRegen("") }}
        property={p}
        confirmInput={confirmRegen}
        setConfirmInput={setConfirmRegen}
        onSubmit={(payload) => {
          regenerate.mutate(
            { propertyId: id, ...payload },
            {
              onSuccess: (data: { generated: number }) => {
                toast.success(`Schedule regenerated. Generated ${data.generated} entries.`)
                setScheduleOpen(false)
                setConfirmRegen("")
              },
              onError: (err) => toast.error(err.message),
            }
          )
        }}
        isPending={regenerate.isPending}
      />

      {installments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            No installments yet. Add one above, or set the installment schedule when creating the property.
          </CardContent>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/40">
                <TableHead className="h-8 w-8 px-2 text-[10px] uppercase tracking-wide hidden sm:table-cell">#</TableHead>
                <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide">Type</TableHead>
                <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide text-right">Amount</TableHead>
                <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide">Due</TableHead>
                <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide hidden sm:table-cell">Paid</TableHead>
                <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide">Status</TableHead>
                <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide text-right">Act</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installments.map((inst, i) => {
                const due = new Date(inst.dueDate)
                const paid = inst.paidDate ? new Date(inst.paidDate) : null
                const isOverdue = inst.status === "pending" && isBefore(due, now)
                const isFuture = isAfter(due, now)
                const isPaid = inst.status === "paid"
                const isUnpaid = inst.status === "unpaid"
                const isBalloon = inst.type === "balloon"
                const isDownpayment = inst.type === "downpayment"
                const isEditing = editingId === inst.id

                return (
                  <TableRow key={inst.id} className={cn(
                    isUnpaid && "bg-red-500/10 hover:bg-red-500/15",
                    isDownpayment && "bg-blue-500/10 hover:bg-blue-500/15",
                    isOverdue && "bg-amber-500/10 hover:bg-amber-500/15",
                    isPaid && !isDownpayment && "bg-emerald-500/[0.04]",
                    isBalloon && !isPaid && !isUnpaid && "bg-purple-500/[0.06]",
                  )}>
                    <TableCell className="py-2 px-2 font-mono text-muted-foreground hidden sm:table-cell">{i + 1}</TableCell>
                    <TableCell className="py-2 px-2">
                      {isBalloon ? (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 border-purple-500/50 bg-purple-500/10 text-purple-400">Balloon</Badge>
                      ) : isDownpayment ? (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 border-blue-500/50 bg-blue-500/10 text-blue-400">Down</Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Regular</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-2 text-right tabular-nums font-medium">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-0.5">
                          <Input
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            type="number"
                            step="0.01"
                            min="0"
                            autoFocus
                            className="h-6 text-xs w-20 text-right px-1.5"
                          />
                          <button onClick={saveEdit} className="text-emerald-500 hover:text-emerald-400 p-0.5" title="Save">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground p-0.5" title="Cancel">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(inst)}
                          className="group inline-flex items-center gap-1 hover:text-primary transition-colors"
                          title="Click to edit"
                        >
                          {formatCurrency(inst.amount)}
                          <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-2 tabular-nums whitespace-nowrap">{shortDate(due)}</TableCell>
                    <TableCell className="py-2 px-2 tabular-nums whitespace-nowrap text-muted-foreground hidden sm:table-cell">{paid ? shortDate(paid) : "—"}</TableCell>
                    <TableCell className="py-2 px-2">
                      {isPaid ? (
                        <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500 hover:bg-emerald-500">Paid</Badge>
                      ) : isUnpaid ? (
                        <Badge className="text-[9px] h-4 px-1.5 bg-red-500 hover:bg-red-500">Unpaid</Badge>
                      ) : isOverdue ? (
                        <Badge className="text-[9px] h-4 px-1.5 bg-amber-500 hover:bg-amber-500">Overdue</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-1">
                      <div className="flex items-center justify-end gap-0">
                        {!isPaid && (!isFuture || isUnpaid) && (
                          <button
                            onClick={() => setStatus(inst.id, "paid")}
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500"
                            title="Mark Paid"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!isUnpaid && !isDownpayment && (
                          <button
                            onClick={() => setStatus(inst.id, "unpaid")}
                            className="p-1 rounded hover:bg-red-500/20 text-red-500"
                            title="Didn't Pay"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
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
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Schedule Dialog — lets user update installment config and regenerates the
// entire ledger (deletes existing installments, regenerates from new config).
// Shows a live preview of the first 6 entries so the user can verify before
// confirming. Requires typing "regenerate" to confirm (destructive op).
// ─────────────────────────────────────────────────────────────────────────────

interface EditScheduleProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  property: Record<string, unknown>
  confirmInput: string
  setConfirmInput: (v: string) => void
  onSubmit: (payload: {
    downPayment?: number
    purchaseDate?: string
    monthlyInstallment?: number | null
    balloonAmount?: number | null
    balloonEveryNMonths?: number | null
    installmentStartDate?: string | null
    installmentDueDay?: number | null
    installmentMonths?: number | null
  }) => void
  isPending: boolean
}

function toDateInput(d: unknown): string {
  if (!d) return ""
  const date = new Date(d as string)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

function EditScheduleDialog({ open, onOpenChange, property, confirmInput, setConfirmInput, onSubmit, isPending }: EditScheduleProps) {
  const p = property
  const [downPayment, setDownPayment] = useState(String(Number(p.downPayment ?? 0)))
  const [purchaseDate, setPurchaseDate] = useState(toDateInput(p.purchaseDate))
  const [monthlyInstallment, setMonthlyInstallment] = useState(p.monthlyInstallment ? String(Number(p.monthlyInstallment)) : "")
  const [installmentMonths, setInstallmentMonths] = useState(p.installmentMonths ? String(Number(p.installmentMonths)) : "")
  const [installmentStartDate, setInstallmentStartDate] = useState(toDateInput(p.installmentStartDate))
  const [installmentDueDay, setInstallmentDueDay] = useState(p.installmentDueDay ? String(Number(p.installmentDueDay)) : "")
  const [balloonAmount, setBalloonAmount] = useState(p.balloonAmount ? String(Number(p.balloonAmount)) : "")
  const [balloonEveryNMonths, setBalloonEveryNMonths] = useState(p.balloonEveryNMonths ? String(Number(p.balloonEveryNMonths)) : "")

  // Re-sync local state when the property changes (e.g., after regeneration)
  useEffect(() => {
    if (!open) return
    setDownPayment(String(Number(p.downPayment ?? 0)))
    setPurchaseDate(toDateInput(p.purchaseDate))
    setMonthlyInstallment(p.monthlyInstallment ? String(Number(p.monthlyInstallment)) : "")
    setInstallmentMonths(p.installmentMonths ? String(Number(p.installmentMonths)) : "")
    setInstallmentStartDate(toDateInput(p.installmentStartDate))
    setInstallmentDueDay(p.installmentDueDay ? String(Number(p.installmentDueDay)) : "")
    setBalloonAmount(p.balloonAmount ? String(Number(p.balloonAmount)) : "")
    setBalloonEveryNMonths(p.balloonEveryNMonths ? String(Number(p.balloonEveryNMonths)) : "")
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build a live preview of the first ~6 entries from current form values
  const preview = useMemo(() => {
    const out: Array<{ type: string; amount: number; date: Date }> = []
    const dp = Number(downPayment)
    if (dp > 0 && purchaseDate) {
      out.push({ type: "downpayment", amount: dp, date: new Date(purchaseDate) })
    }
    const m = Number(monthlyInstallment)
    const months = Number(installmentMonths)
    const dueDay = Number(installmentDueDay)
    const n = Number(balloonEveryNMonths)
    const balloon = Number(balloonAmount)
    if (m > 0 && months > 0 && dueDay > 0 && installmentStartDate) {
      const start = new Date(installmentStartDate)
      const startY = start.getUTCFullYear()
      const startM = start.getUTCMonth()
      for (let i = 0; i < months && out.length < 6; i++) {
        const totalMonths = startM + i
        const targetY = startY + Math.floor(totalMonths / 12)
        const targetM = ((totalMonths % 12) + 12) % 12
        const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate()
        const day = Math.min(dueDay, lastDay)
        const d = new Date(Date.UTC(targetY, targetM, day))
        const isBalloonMonth = n > 0 && balloon > 0 && (i + 1) % n === 0
        if (isBalloonMonth) {
          out.push({ type: "balloon", amount: balloon, date: d })
        } else {
          out.push({ type: "regular", amount: m, date: d })
        }
      }
    }
    return out
  }, [downPayment, purchaseDate, monthlyInstallment, installmentMonths, installmentDueDay, installmentStartDate, balloonAmount, balloonEveryNMonths])

  const confirmed = confirmInput === "regenerate"

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      downPayment: Number(downPayment || 0),
      purchaseDate: purchaseDate || undefined,
      monthlyInstallment: monthlyInstallment ? Number(monthlyInstallment) : null,
      installmentMonths: installmentMonths ? Number(installmentMonths) : null,
      installmentStartDate: installmentStartDate || null,
      installmentDueDay: installmentDueDay ? Number(installmentDueDay) : null,
      balloonAmount: balloonAmount ? Number(balloonAmount) : null,
      balloonEveryNMonths: balloonEveryNMonths ? Number(balloonEveryNMonths) : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Edit Schedule & Regenerate Ledger
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Down Payment</Label>
              <Input type="number" step="0.01" min="0" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Purchase Date</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Monthly Installment</Label>
              <Input type="number" step="0.01" min="0" value={monthlyInstallment} onChange={(e) => setMonthlyInstallment(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tenure (months)</Label>
              <Input type="number" min="1" max="600" value={installmentMonths} onChange={(e) => setInstallmentMonths(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Installment Start Date</Label>
              <Input type="date" value={installmentStartDate} onChange={(e) => setInstallmentStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Day (1-31)</Label>
              <Input type="number" min="1" max="31" value={installmentDueDay} onChange={(e) => setInstallmentDueDay(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Balloon Amount</Label>
              <Input type="number" step="0.01" min="0" value={balloonAmount} onChange={(e) => setBalloonAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Balloon Every N Months</Label>
              <Input type="number" min="1" max="60" value={balloonEveryNMonths} onChange={(e) => setBalloonEveryNMonths(e.target.value)} />
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Preview — first {preview.length} entries
            </p>
            {preview.length === 0 ? (
              <p className="text-xs text-muted-foreground">Fill in the fields above to see a preview.</p>
            ) : (
              <div className="space-y-1">
                {preview.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">#{idx + 1}</span>
                      <Badge variant="outline" className={cn(
                        "text-[9px] h-4 px-1",
                        row.type === "balloon" && "border-purple-500/40 text-purple-500",
                        row.type === "downpayment" && "border-blue-500/40 text-blue-500",
                      )}>
                        {row.type === "regular" ? "Regular" : row.type === "balloon" ? "Balloon" : "Down"}
                      </Badge>
                      <span className="tabular-nums">{shortDate(row.date)}</span>
                    </div>
                    <span className="font-medium tabular-nums">{formatCurrency(row.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 space-y-2">
            <p className="text-xs font-medium text-red-500">
              ⚠ This will delete ALL existing installments (paid, unpaid, pending) and rebuild from the config above.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Type <span className="font-mono font-semibold">regenerate</span> to confirm</Label>
              <Input
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="regenerate"
                className={confirmed ? "border-red-500 focus-visible:ring-red-500/30" : ""}
              />
            </div>
          </div>

          <Button type="submit" disabled={!confirmed || isPending} className="w-full bg-red-600 hover:bg-red-700 text-white">
            {isPending ? "Regenerating..." : "Wipe & Regenerate Ledger"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
