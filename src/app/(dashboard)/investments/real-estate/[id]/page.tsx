"use client"

import { use, useEffect, useMemo, useState } from "react"
import { useProperty, useCreateProperty, useUpdateInstallment, useAutoMarkInstallments, useRegenerateLedger, useSaveLedger, useUnlockLedger } from "@/modules/investments/hooks"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatCard } from "@/components/shared/stat-card"
import { Plus, Building2, DollarSign, CheckCircle, AlertTriangle, Wallet, Pencil, Check, X, Settings, Lock, Unlock, Trash2, TrendingUp } from "lucide-react"
import { cn, formatCurrency, formatCompact } from "@/lib/utils"
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

type DraftRow = {
  _key: string  // local key for React
  id?: string   // present for existing rows
  type: "regular" | "balloon" | "downpayment"
  amount: string
  dueDate: string
  status: "pending" | "paid" | "unpaid"
  paidDate: string | null
  receiptNote: string | null
}

function shortDate(d: Date): string {
  return format(d, isThisYear(d) ? "d MMM" : "d MMM ''yy")
}

let draftKeyCounter = 0
function newKey() { return `new-${++draftKeyCounter}` }

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: property, isLoading } = useProperty(id)
  const createInstallment = useCreateProperty()
  const updateInstallment = useUpdateInstallment()
  const autoMark = useAutoMarkInstallments()
  const regenerate = useRegenerateLedger()
  const saveLedger = useSaveLedger()
  const unlockLedger = useUnlockLedger()

  const [addOpen, setAddOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState("")

  // Draft edit state
  const [draftRows, setDraftRows] = useState<DraftRow[]>([])

  const p = (property ?? {}) as Record<string, unknown>
  const isLocked = Boolean(p.ledgerLocked)

  const installments = useMemo(
    () => ((p.installments as Inst[]) || []).map((i) => ({ ...i, amount: Number(i.amount) })),
    [p.installments]
  )

  // When property loads and is unlocked, sync draft from installments
  useEffect(() => {
    if (!property) return
    if (!isLocked) {
      setDraftRows(
        installments.map((i) => ({
          _key: i.id,
          id: i.id,
          type: i.type as DraftRow["type"],
          amount: String(i.amount),
          dueDate: i.dueDate.slice(0, 10),
          status: i.status as DraftRow["status"],
          paidDate: i.paidDate,
          receiptNote: i.receiptNote,
        }))
      )
    }
  }, [property, isLocked]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { autoMark.mutate(id) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const downPayment = Number(p.downPayment ?? 0)
  const totalPrice = Number(p.totalPrice ?? 0)
  const hasDownpaymentEntry = installments.some((i) => i.type === "downpayment")
  const paidFromLedger = installments.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0)
  const totalPaid = paidFromLedger + (hasDownpaymentEntry ? 0 : downPayment)
  const pendingDebt = installments.filter((i) => i.status === "pending").reduce((sum, i) => sum + i.amount, 0)
  const overdueDebt = installments.filter((i) => i.status === "unpaid").reduce((sum, i) => sum + i.amount, 0)
  const debt = pendingDebt + overdueDebt
  const remaining = totalPrice - totalPaid - debt

  function handleAddInstallment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createInstallment.mutate(
      { propertyId: id, type: (fd.get("type") as string) || "regular", amount: Number(fd.get("amount")), dueDate: fd.get("dueDate") as string },
      {
        onSuccess: () => { setAddOpen(false); toast.success("Installment added") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function setStatus(installmentId: string, status: "paid" | "unpaid" | "pending") {
    updateInstallment.mutate(
      { installmentId, status },
      {
        onSuccess: () => toast.success(status === "paid" ? "Marked paid" : status === "unpaid" ? "Marked unpaid" : "Reset"),
        onError: (err) => toast.error(err.message),
      }
    )
  }

  // ── Draft editing helpers ──────────────────────────────────────────────────

  function updateDraftRow(key: string, field: Partial<DraftRow>) {
    setDraftRows((rows) => rows.map((r) => r._key === key ? { ...r, ...field } : r))
  }

  function deleteDraftRow(key: string) {
    setDraftRows((rows) => rows.filter((r) => r._key !== key))
  }

  function addDraftRow() {
    const lastDate = draftRows.length > 0 ? draftRows[draftRows.length - 1].dueDate : new Date().toISOString().slice(0, 10)
    setDraftRows((rows) => [...rows, {
      _key: newKey(),
      type: "regular",
      amount: "",
      dueDate: lastDate,
      status: "pending",
      paidDate: null,
      receiptNote: null,
    }])
  }

  function handleSaveLedger() {
    const bad = draftRows.find((r) => !r.dueDate || !r.amount || isNaN(Number(r.amount)) || Number(r.amount) < 0)
    if (bad) { toast.error("All rows must have a valid amount and due date"); return }
    saveLedger.mutate(
      {
        propertyId: id,
        rows: draftRows.map((r) => ({
          type: r.type,
          amount: Number(r.amount),
          dueDate: r.dueDate,
          status: r.status,
          paidDate: r.paidDate ?? null,
          receiptNote: r.receiptNote ?? null,
        })),
      },
      {
        onSuccess: (data: { saved: number }) => toast.success(`Ledger saved & locked (${data.saved} entries)`),
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handleUnlock() {
    unlockLedger.mutate(id, {
      onSuccess: () => toast.success("Ledger unlocked — you can now edit entries"),
      onError: (err) => toast.error(err.message),
    })
  }

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!property) return <div className="p-6">Property not found</div>

  const now = new Date()

  return (
    <div className="space-y-4">
      <PageHeader title={p.name as string} description={(p.location as string) || "Real Estate Investment"} />

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Price"    value={formatCompact(totalPrice)}           numericValue={totalPrice}           icon={DollarSign}  gradient={{ from: "from-indigo-500/25", to: "to-violet-500/5",  ring: "ring-indigo-500/40",  accent: "text-indigo-400" }} />
        <StatCard title="Amount Paid"    value={formatCompact(totalPaid)}            numericValue={totalPaid}            icon={CheckCircle} gradient={{ from: "from-emerald-500/25", to: "to-teal-500/5",   ring: "ring-emerald-500/40", accent: "text-emerald-400" }} />
        <StatCard title="Still Owed"     value={formatCompact(Math.max(0, debt))}    numericValue={Math.max(0, debt)}    icon={Wallet}      gradient={{ from: "from-amber-500/25",  to: "to-orange-500/5", ring: "ring-amber-500/40",   accent: "text-amber-400" }} />
        <StatCard title="Missed"         value={overdueDebt > 0 ? formatCompact(overdueDebt) : "None"} numericValue={overdueDebt > 0 ? overdueDebt : undefined} icon={AlertTriangle} gradient={{ from: overdueDebt > 0 ? "from-red-500/25" : "from-slate-500/15", to: overdueDebt > 0 ? "to-rose-500/5" : "to-slate-500/5", ring: overdueDebt > 0 ? "ring-red-500/40" : "ring-slate-500/20", accent: overdueDebt > 0 ? "text-red-400" : "text-muted-foreground" }} />
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
              <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all" style={{ width: `${paidPct}%` }} />
              {debt > 0 && <div className="h-full bg-gradient-to-r from-red-500 to-rose-600" style={{ width: `${debtPct}%` }} />}
            </div>
          </div>
        )
      })()}

      {debt > 0 && (
        <div className={cn("rounded-lg border px-3 py-2 flex items-start gap-2", overdueDebt > 0 ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5")}>
          <AlertTriangle className={cn("h-4 w-4 shrink-0 mt-0.5", overdueDebt > 0 ? "text-red-500" : "text-amber-500")} />
          <div className="flex-1 min-w-0 text-xs space-y-0.5">
            <p className={cn("font-medium", overdueDebt > 0 ? "text-red-500" : "text-amber-500")}>Outstanding obligation: {formatCurrency(debt)}</p>
            <p className="text-muted-foreground tabular-nums">
              {pendingDebt > 0 && <>Pending future: <span className="text-foreground">{formatCurrency(pendingDebt)}</span></>}
              {pendingDebt > 0 && overdueDebt > 0 && <> · </>}
              {overdueDebt > 0 && <>Overdue: <span className="text-red-400">{formatCurrency(overdueDebt)}</span></>}
            </p>
          </div>
        </div>
      )}

      {/* Ledger header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Installment Ledger</h2>
            {isLocked
              ? <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] h-5"><Lock className="h-3 w-3 mr-1" />Locked</Badge>
              : <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] h-5"><Unlock className="h-3 w-3 mr-1" />Draft</Badge>
            }
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isLocked ? "Tap ✓ / ✗ to mark payments. Unlock to edit entries." : "Edit any entry below, add or remove rows, then Save & Lock."}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap shrink-0">
          {isLocked ? (
            <>
              <Button size="sm" variant="outline" onClick={() => { setScheduleOpen(true); setConfirmRegen("") }}>
                <Settings className="mr-1.5 h-3.5 w-3.5" /> Schedule
              </Button>
              <Button size="sm" variant="outline" className="text-amber-500 border-amber-500/40 hover:bg-amber-500/10" onClick={handleUnlock}>
                <Unlock className="mr-1.5 h-3.5 w-3.5" /> Unlock
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => { setScheduleOpen(true); setConfirmRegen("") }}>
                <Settings className="mr-1.5 h-3.5 w-3.5" /> Schedule
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline"><Plus className="mr-1.5 h-3.5 w-3.5" /> Add Row</Button>
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
                    <div className="space-y-2"><Label>Amount</Label><Input name="amount" type="number" step="0.01" min="0" required /></div>
                    <div className="space-y-2"><Label>Due Date</Label><Input name="dueDate" type="date" required /></div>
                    <Button type="submit" className="w-full">Add</Button>
                  </form>
                </DialogContent>
              </Dialog>
              <Button size="sm" onClick={handleSaveLedger} disabled={saveLedger.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Lock className="mr-1.5 h-3.5 w-3.5" />
                {saveLedger.isPending ? "Saving..." : "Save & Lock"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── LOCKED VIEW ──────────────────────────────────────────────────────── */}
      {isLocked && (
        installments.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-xs text-muted-foreground">No installments. Unlock to add entries.</CardContent></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/40">
                  <TableHead className="h-8 px-2 text-[10px] uppercase tracking-wide hidden sm:table-cell">#</TableHead>
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
                        {isBalloon ? <Badge variant="outline" className="text-[9px] h-4 px-1 border-purple-500/50 bg-purple-500/10 text-purple-400">Balloon</Badge>
                          : isDownpayment ? <Badge variant="outline" className="text-[9px] h-4 px-1 border-blue-500/50 bg-blue-500/10 text-blue-400">Down</Badge>
                          : <span className="text-[10px] text-muted-foreground">Regular</span>}
                      </TableCell>
                      <TableCell className="py-2 px-2 text-right font-medium tabular-nums">{formatCurrency(inst.amount)}</TableCell>
                      <TableCell className="py-2 px-2 tabular-nums whitespace-nowrap">{shortDate(due)}</TableCell>
                      <TableCell className="py-2 px-2 tabular-nums text-muted-foreground hidden sm:table-cell">{paid ? shortDate(paid) : "—"}</TableCell>
                      <TableCell className="py-2 px-2">
                        {isPaid ? <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500 hover:bg-emerald-500">Paid</Badge>
                          : isUnpaid ? <Badge className="text-[9px] h-4 px-1.5 bg-red-500 hover:bg-red-500">Unpaid</Badge>
                          : isOverdue ? <Badge className="text-[9px] h-4 px-1.5 bg-amber-500 hover:bg-amber-500">Overdue</Badge>
                          : <Badge variant="outline" className="text-[9px] h-4 px-1.5">Pending</Badge>}
                      </TableCell>
                      <TableCell className="py-2 px-1">
                        <div className="flex items-center justify-end gap-0">
                          {!isPaid && (!isFuture || isUnpaid) && (
                            <button onClick={() => setStatus(inst.id, "paid")} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500" title="Mark Paid">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!isUnpaid && !isDownpayment && (
                            <button onClick={() => setStatus(inst.id, "unpaid")} className="p-1 rounded hover:bg-red-500/20 text-red-500" title="Didn't Pay">
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
        )
      )}

      {/* ── DRAFT EDIT VIEW ───────────────────────────────────────────────────── */}
      {!isLocked && (
        <div className="space-y-2">
          {draftRows.length === 0 && (
            <Card><CardContent className="py-8 text-center text-xs text-muted-foreground">No entries yet. Add rows below or regenerate from a schedule.</CardContent></Card>
          )}
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-amber-500/10">
                  <TableHead className="h-10 px-3 text-[10px] uppercase tracking-wide hidden sm:table-cell w-10">#</TableHead>
                  <TableHead className="h-10 px-3 text-[10px] uppercase tracking-wide w-32">Type</TableHead>
                  <TableHead className="h-10 px-3 text-[10px] uppercase tracking-wide">Amount</TableHead>
                  <TableHead className="h-10 px-3 text-[10px] uppercase tracking-wide">Due Date</TableHead>
                  <TableHead className="h-10 px-3 text-[10px] uppercase tracking-wide w-32">Status</TableHead>
                  <TableHead className="h-10 px-3 text-[10px] uppercase tracking-wide text-right w-12">Del</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draftRows.map((row, i) => (
                  <TableRow key={row._key} className={cn(
                    row.type === "balloon" && "bg-purple-500/[0.06]",
                    row.type === "downpayment" && "bg-blue-500/[0.06]",
                  )}>
                    <TableCell className="py-2 px-3 font-mono text-muted-foreground hidden sm:table-cell">{i + 1}</TableCell>
                    <TableCell className="py-2 px-3">
                      <select
                        value={row.type}
                        onChange={(e) => updateDraftRow(row._key, { type: e.target.value as DraftRow["type"] })}
                        className="h-9 w-full rounded-md border border-input bg-background text-sm px-2"
                      >
                        <option value="regular">Regular</option>
                        <option value="balloon">Balloon</option>
                        <option value="downpayment">Down Payment</option>
                      </select>
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.amount}
                        onChange={(e) => updateDraftRow(row._key, { amount: e.target.value })}
                        className="h-9 w-full text-sm text-right"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <Input
                        type="date"
                        value={row.dueDate}
                        onChange={(e) => updateDraftRow(row._key, { dueDate: e.target.value })}
                        className="h-9 w-full text-sm"
                      />
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <select
                        value={row.status}
                        onChange={(e) => updateDraftRow(row._key, { status: e.target.value as DraftRow["status"] })}
                        className="h-9 w-full rounded-md border border-input bg-background text-sm px-2"
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                      </select>
                    </TableCell>
                    <TableCell className="py-2 px-3 text-right">
                      <button onClick={() => deleteDraftRow(row._key)} className="p-1.5 rounded hover:bg-red-500/20 text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Button size="sm" variant="outline" className="w-full border-dashed" onClick={addDraftRow}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Row
          </Button>
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveLedger} disabled={saveLedger.isPending}>
            <Lock className="mr-2 h-4 w-4" />
            {saveLedger.isPending ? "Saving..." : `Save & Lock Ledger (${draftRows.length} entries)`}
          </Button>
        </div>
      )}

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
                toast.success(`Schedule regenerated — ${data.generated} draft entries created. Review and Save & Lock when ready.`)
                setScheduleOpen(false)
                setConfirmRegen("")
              },
              onError: (err) => toast.error(err.message),
            }
          )
        }}
        isPending={regenerate.isPending}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Schedule Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface EditScheduleProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  property: Record<string, unknown>
  confirmInput: string
  setConfirmInput: (v: string) => void
  onSubmit: (payload: {
    downPayment?: number; purchaseDate?: string; monthlyInstallment?: number | null
    balloonAmount?: number | null; balloonEveryNMonths?: number | null
    installmentStartDate?: string | null; installmentDueDay?: number | null; installmentMonths?: number | null
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

  const preview = useMemo(() => {
    const out: Array<{ type: string; amount: number; date: Date }> = []
    const dp = Number(downPayment)
    if (dp > 0 && purchaseDate) out.push({ type: "downpayment", amount: dp, date: new Date(purchaseDate) })
    const m = Number(monthlyInstallment), months = Number(installmentMonths), dueDay = Number(installmentDueDay)
    const n = Number(balloonEveryNMonths), balloon = Number(balloonAmount)
    if (m > 0 && months > 0 && dueDay > 0 && installmentStartDate) {
      const start = new Date(installmentStartDate)
      const startY = start.getUTCFullYear(), startM = start.getUTCMonth()
      for (let i = 0; i < months && out.length < 6; i++) {
        const total = startM + i, targetY = startY + Math.floor(total / 12), targetM = ((total % 12) + 12) % 12
        const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate()
        const d = new Date(Date.UTC(targetY, targetM, Math.min(dueDay, lastDay)))
        const isBalloonMonth = n > 0 && balloon > 0 && (i + 1) % n === 0
        out.push(isBalloonMonth ? { type: "balloon", amount: balloon, date: d } : { type: "regular", amount: m, date: d })
      }
    }
    return out
  }, [downPayment, purchaseDate, monthlyInstallment, installmentMonths, installmentDueDay, installmentStartDate, balloonAmount, balloonEveryNMonths])

  const confirmed = confirmInput === "regenerate"

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      downPayment: Number(downPayment || 0), purchaseDate: purchaseDate || undefined,
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
          <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Edit Schedule & Regenerate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Down Payment</Label><Input type="number" step="0.01" min="0" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Purchase Date</Label><Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Monthly Installment</Label><Input type="number" step="0.01" min="0" value={monthlyInstallment} onChange={(e) => setMonthlyInstallment(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Tenure (months)</Label><Input type="number" min="1" max="600" value={installmentMonths} onChange={(e) => setInstallmentMonths(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Installment Start Date</Label><Input type="date" value={installmentStartDate} onChange={(e) => setInstallmentStartDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Due Day (1-31)</Label><Input type="number" min="1" max="31" value={installmentDueDay} onChange={(e) => setInstallmentDueDay(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs">Balloon Amount</Label><Input type="number" step="0.01" min="0" value={balloonAmount} onChange={(e) => setBalloonAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Balloon Every N Months</Label><Input type="number" min="1" max="60" value={balloonEveryNMonths} onChange={(e) => setBalloonEveryNMonths(e.target.value)} /></div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Preview — first {preview.length} entries</p>
            {preview.length === 0 ? <p className="text-xs text-muted-foreground">Fill in the fields above to see a preview.</p> : (
              <div className="space-y-1">
                {preview.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">#{idx + 1}</span>
                      <Badge variant="outline" className={cn("text-[9px] h-4 px-1", row.type === "balloon" && "border-purple-500/40 text-purple-500", row.type === "downpayment" && "border-blue-500/40 text-blue-500")}>
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
            <p className="text-xs font-medium text-red-500">⚠ This wipes all existing entries and creates a new draft. You can edit before locking.</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Type <span className="font-mono font-semibold">regenerate</span> to confirm</Label>
              <Input value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} placeholder="regenerate" className={confirmed ? "border-red-500" : ""} />
            </div>
          </div>
          <Button type="submit" disabled={!confirmed || isPending} className="w-full bg-red-600 hover:bg-red-700 text-white">
            {isPending ? "Regenerating..." : "Wipe & Regenerate (Draft)"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
