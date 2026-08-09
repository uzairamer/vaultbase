"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, X, Pencil, Trash2, Plus, Check } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet"
import { cn, formatCurrency } from "@/lib/utils"
import { useCreateSegment, useUpdateSegment, useDeleteSegment } from "@/modules/expenses/hooks"
import {
  txSans, txMono, cleanAmount, chevronBg, selectClass, optionStyle, FieldLabel,
} from "@/modules/expenses/components/wallet-ui-kit"

const RESET_SCHEDULE_OPTIONS = [
  { value: "none", label: "No reset" },
  { value: "weekly", label: "Weekly (every Monday)" },
  { value: "monthly", label: "Monthly (1st of month)" },
  { value: "quarterly", label: "Quarterly (1st of quarter)" },
]

const PRESET_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#f97316",
]

const ACCENT = "#818CF8"

export interface Segment {
  id: string
  name: string
  amount: number
  color: string
  isDefault: boolean
  resetSchedule?: string
  resetAmount?: number | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletId: string
  walletName: string
  walletBalance: number
  segments: Segment[]
}

type FormMode = null | "add" | "edit"

function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-7 w-7 shrink-0 rounded-full border-2 transition-transform"
          style={{ backgroundColor: c, borderColor: value === c ? "#ECEEF1" : "transparent", transform: value === c ? "scale(1.1)" : "scale(1)" }}
        />
      ))}
    </div>
  )
}

interface SegmentFormValues {
  name: string
  amount: string
  color: string
  resetSchedule: string
  resetAmount: string
}
interface SegmentFormProps {
  values: SegmentFormValues
  onNameChange: (v: string) => void
  onAmountChange: (v: string) => void
  onColorChange: (v: string) => void
  onResetScheduleChange: (v: string) => void
  onResetAmountChange: (v: string) => void
}

function SegmentForm({ values, onNameChange, onAmountChange, onColorChange, onResetScheduleChange, onResetAmountChange }: SegmentFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-[9px]">
        <FieldLabel>Color</FieldLabel>
        <ColorSwatches value={values.color} onChange={onColorChange} />
      </div>
      <div className="flex flex-col gap-[9px]">
        <FieldLabel>Name</FieldLabel>
        <input
          value={values.name} onChange={(e) => onNameChange(e.target.value)} placeholder="e.g. Groceries"
          className="w-full rounded-[11px] border border-white/[0.08] bg-[#101317] px-[13px] py-[11px] text-[14.5px] outline-none placeholder:text-[#5C636D]"
        />
      </div>
      <div className="flex flex-col gap-[9px]">
        <FieldLabel>Amount</FieldLabel>
        <div className="flex items-center gap-2 rounded-[11px] border border-white/[0.08] bg-[#101317] px-[13px] py-[11px]">
          <span className="font-mono text-[14.5px] font-medium" style={{ color: values.color, fontFamily: "var(--font-tx-mono)" }}>Rs</span>
          <input
            value={values.amount}
            onChange={(e) => onAmountChange(cleanAmount(e.target.value))}
            inputMode="decimal"
            placeholder="0.00"
            className="min-w-0 flex-1 bg-transparent font-mono text-[14.5px] outline-none"
            style={{ fontFamily: "var(--font-tx-mono)" }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-[9px]">
        <FieldLabel>Reset Schedule</FieldLabel>
        <select value={values.resetSchedule} onChange={(e) => onResetScheduleChange(e.target.value)} className={selectClass} style={chevronBg}>
          {RESET_SCHEDULE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} style={optionStyle}>{o.label}</option>
          ))}
        </select>
      </div>
      {values.resetSchedule !== "none" && (
        <div className="flex flex-col gap-[9px]">
          <FieldLabel>Reset Amount To</FieldLabel>
          <input
            value={values.resetAmount}
            onChange={(e) => onResetAmountChange(cleanAmount(e.target.value))}
            inputMode="decimal"
            placeholder="Leave blank to reset to 0"
            className="w-full rounded-[11px] border border-white/[0.08] bg-[#101317] px-[13px] py-[11px] font-mono text-[14px] outline-none placeholder:text-[#5C636D]"
            style={{ fontFamily: "var(--font-tx-mono)" }}
          />
        </div>
      )}
    </div>
  )
}

function SegmentRow({
  seg, walletBalance, canDelete, onEdit, onDelete,
}: { seg: Segment; walletBalance: number; canDelete: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#101317] px-4 py-3">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: seg.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-medium text-[#ECEEF1]">{seg.name}</p>
        {seg.resetSchedule && seg.resetSchedule !== "none" && (
          <p className="truncate text-[11.5px] text-[#6E757F]">
            Resets {RESET_SCHEDULE_OPTIONS.find((o) => o.value === seg.resetSchedule)?.label.toLowerCase().replace("no reset", "")}
            {seg.resetAmount != null ? ` → ${formatCurrency(seg.resetAmount)}` : " → 0"}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="font-mono text-[13.5px] font-medium text-[#ECEEF1]" style={{ fontFamily: "var(--font-tx-mono)" }}>{formatCurrency(seg.amount)}</p>
        <p className="font-mono text-[10.5px] text-[#6E757F]" style={{ fontFamily: "var(--font-tx-mono)" }}>
          {walletBalance > 0 ? `${Math.round((seg.amount / walletBalance) * 100)}%` : "—"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded-full text-[#8B929C] hover:bg-white/[0.06]">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          title={!canDelete ? "Cannot delete the last segment" : "Delete"}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#E5544B] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-[#4E555F]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function WalletSegmentsDialog({ open, onOpenChange, walletId, walletName, walletBalance, segments }: Props) {
  const createSegment = useCreateSegment()
  const updateSegment = useUpdateSegment()
  const deleteSegment = useDeleteSegment()

  const [formMode, setFormMode] = useState<FormMode>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState("")
  const [formAmount, setFormAmount] = useState("")
  const [formColor, setFormColor] = useState(PRESET_COLORS[0])
  const [formResetSchedule, setFormResetSchedule] = useState("none")
  const [formResetAmount, setFormResetAmount] = useState("")

  const totalAllocated = segments.reduce((sum, s) => sum + s.amount, 0)
  const unallocated = walletBalance - totalAllocated
  const pending = createSegment.isPending || updateSegment.isPending

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) closeForm()
  }

  function openAdd() {
    setFormMode("add")
    setEditingId(null)
    setFormName("")
    setFormAmount("")
    setFormColor(PRESET_COLORS[segments.length % PRESET_COLORS.length])
    setFormResetSchedule("none")
    setFormResetAmount("")
  }

  function openEdit(seg: Segment) {
    setFormMode("edit")
    setEditingId(seg.id)
    setFormName(seg.name)
    setFormAmount(String(seg.amount))
    setFormColor(seg.color)
    setFormResetSchedule(seg.resetSchedule ?? "none")
    setFormResetAmount(seg.resetAmount != null ? String(seg.resetAmount) : "")
  }

  function closeForm() {
    setFormMode(null)
    setEditingId(null)
  }

  function handleFormSubmit() {
    const amount = Number(cleanAmount(formAmount))
    if (!formName.trim() || isNaN(amount) || amount < 0) {
      toast.error("Enter a valid name and amount")
      return
    }
    const resetAmount = formResetSchedule !== "none" && formResetAmount !== "" ? Number(cleanAmount(formResetAmount)) : null

    if (formMode === "edit" && editingId) {
      updateSegment.mutate(
        { id: editingId, name: formName.trim(), amount, color: formColor, resetSchedule: formResetSchedule, resetAmount },
        { onSuccess: () => { closeForm(); toast.success("Segment updated") }, onError: (err) => toast.error(err.message) }
      )
    } else {
      createSegment.mutate(
        { walletId, name: formName.trim(), amount, color: formColor, resetSchedule: formResetSchedule, resetAmount },
        { onSuccess: () => { closeForm(); toast.success("Segment added") }, onError: (err) => toast.error(err.message) }
      )
    }
  }

  function handleDelete(id: string) {
    deleteSegment.mutate(id, {
      onSuccess: () => toast.success("Segment removed"),
      onError: (err) => toast.error(err.message),
    })
  }

  const barSegments = segments.map((s) => ({ ...s, pct: walletBalance > 0 ? Math.min((s.amount / walletBalance) * 100, 100) : 0 }))
  const formValid = formName.trim().length > 0 && formAmount !== "" && !isNaN(Number(cleanAmount(formAmount)))
  const formValues: SegmentFormValues = { name: formName, amount: formAmount, color: formColor, resetSchedule: formResetSchedule, resetAmount: formResetAmount }
  const formTitle = formMode === "edit" ? "Edit Segment" : "Add Segment"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          txSans.variable, txMono.variable,
          "gap-0 overflow-hidden border-0 bg-[#08090B] p-0 text-[#ECEEF1]",
          "inset-0 top-0 left-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-[620px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px] sm:border sm:border-white/[0.08] sm:bg-[#0B0D10]"
        )}
        style={{ fontFamily: "var(--font-tx-sans)" }}
      >
        <DialogTitle className="sr-only">Segments — {walletName}</DialogTitle>
        <DialogDescription className="sr-only">Manage budget segments for this wallet</DialogDescription>

        {/* MOBILE */}
        <div className="flex h-full flex-col sm:hidden">
          <div className="flex h-[52px] shrink-0 items-center justify-between px-1.5 pl-2">
            <button type="button" onClick={() => handleOpenChange(false)} className="flex min-h-11 min-w-11 items-center gap-0.5 pl-0.5" style={{ color: ACCENT }}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-[16px] font-semibold">Segments</div>
            <button type="button" onClick={() => handleOpenChange(false)} className="flex min-h-11 min-w-11 items-center justify-center text-[#8B929C]">
              <X className="h-[19px] w-[19px]" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[#101317] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#8B929C]">{walletName}</span>
                <span className="font-mono text-[15px] font-semibold" style={{ fontFamily: "var(--font-tx-mono)" }}>{formatCurrency(walletBalance)}</span>
              </div>
              {segments.length > 0 && (
                <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  {barSegments.map((s) => (
                    <div key={s.id} style={{ width: `${s.pct}%`, background: s.color }} className="h-full" />
                  ))}
                </div>
              )}
              <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
                <span className="text-[#8B929C]">Allocated <span className="font-medium text-[#ECEEF1]">{formatCurrency(totalAllocated)}</span></span>
                <span style={{ color: unallocated < 0 ? "#E5544B" : "#6E757F" }}>
                  {unallocated < 0 ? `Over by ${formatCurrency(Math.abs(unallocated))}` : `${formatCurrency(unallocated)} left`}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {segments.map((seg) => (
                <SegmentRow
                  key={seg.id} seg={seg} walletBalance={walletBalance}
                  canDelete={segments.length > 1}
                  onEdit={() => openEdit(seg)}
                  onDelete={() => handleDelete(seg.id)}
                />
              ))}
            </div>
          </div>

          <div className="shrink-0 px-4 pt-2 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
            <button
              type="button" onClick={openAdd}
              className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[16.5px] font-semibold"
              style={{ background: ACCENT, color: "#0B0D10" }}
            >
              <Plus className="h-4 w-4" /> Add Segment
            </button>
          </div>
        </div>

        {/* DESKTOP */}
        <div className="hidden sm:flex sm:flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
            <div className="flex flex-col gap-0.5">
              <div className="text-[19px] font-semibold tracking-[-0.01em]">Segments</div>
              <div className="text-[13px] text-[#8B929C]">{walletName} · {formatCurrency(walletBalance)}</div>
            </div>
            <button
              type="button" onClick={() => handleOpenChange(false)}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-white/[0.07] bg-[#15181D] text-[#8B929C]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-[22px]">
            {formMode ? (
              <>
                <button type="button" onClick={closeForm} className="flex w-fit items-center gap-1.5 text-[13px] text-[#8B929C] hover:text-[#ECEEF1]">
                  <ChevronLeft className="h-3.5 w-3.5" /> Back to segments
                </button>
                <div className="text-[15px] font-semibold">{formTitle}</div>
                <SegmentForm
                  values={formValues}
                  onNameChange={setFormName}
                  onAmountChange={setFormAmount}
                  onColorChange={setFormColor}
                  onResetScheduleChange={setFormResetSchedule}
                  onResetAmountChange={setFormResetAmount}
                />
              </>
            ) : (
              <>
                {segments.length > 0 && (
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    {barSegments.map((s) => (
                      <div key={s.id} style={{ width: `${s.pct}%`, background: s.color }} className="h-full" />
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#8B929C]">Allocated <span className="font-medium text-[#ECEEF1]">{formatCurrency(totalAllocated)}</span></span>
                  <span style={{ color: unallocated < 0 ? "#E5544B" : "#6E757F" }}>
                    {unallocated < 0 ? `Over by ${formatCurrency(Math.abs(unallocated))}` : `${formatCurrency(unallocated)} unallocated`}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {segments.map((seg) => (
                <SegmentRow
                  key={seg.id} seg={seg} walletBalance={walletBalance}
                  canDelete={segments.length > 1}
                  onEdit={() => openEdit(seg)}
                  onDelete={() => handleDelete(seg.id)}
                />
              ))}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-white/[0.06] bg-[#0A0C0F] px-6 py-4">
            {formMode ? (
              <>
                <button type="button" onClick={closeForm} className="rounded-[11px] border border-white/[0.08] bg-[#15181D] px-[18px] py-[11px] text-[14px] text-[#B9C0C9]">
                  Cancel
                </button>
                <button
                  type="button" onClick={handleFormSubmit} disabled={!formValid || pending}
                  className="rounded-[11px] px-[22px] py-[11px] text-[14.5px] font-semibold"
                  style={{ background: ACCENT, color: "#0B0D10", opacity: formValid ? 1 : 0.45 }}
                >
                  {pending ? "Saving..." : formMode === "edit" ? "Save Changes" : "Add Segment"}
                </button>
              </>
            ) : (
              <button
                type="button" onClick={openAdd}
                className="flex items-center gap-2 rounded-[11px] px-[18px] py-[11px] text-[14.5px] font-semibold"
                style={{ background: ACCENT, color: "#0B0D10" }}
              >
                <Plus className="h-4 w-4" /> Add Segment
              </button>
            )}
          </div>
        </div>

        {/* MOBILE ADD/EDIT SHEET */}
        <Sheet open={formMode !== null} onOpenChange={(o) => { if (!o) closeForm() }}>
          <SheetContent
            side="bottom" showCloseButton={false}
            className={cn(txSans.variable, txMono.variable, "flex max-h-[85vh] flex-col gap-0 rounded-t-[20px] border border-b-0 border-white/[0.09] bg-[#111418] p-0 sm:hidden")}
            style={{ fontFamily: "var(--font-tx-sans)" }}
          >
            <div className="flex shrink-0 justify-center pt-2.5 pb-1">
              <div className="h-1 w-9 rounded-full bg-white/[0.18]" />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 px-[18px] pt-1.5 pb-3.5">
              <SheetTitle className="text-[16px] font-semibold text-[#ECEEF1]">{formTitle}</SheetTitle>
              <SheetClose className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1B1F25] text-[#8B929C]">
                <X className="h-3.5 w-3.5" />
              </SheetClose>
            </div>
            <SheetDescription className="sr-only">{formTitle}</SheetDescription>

            <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-4">
              <SegmentForm
                  values={formValues}
                  onNameChange={setFormName}
                  onAmountChange={setFormAmount}
                  onColorChange={setFormColor}
                  onResetScheduleChange={setFormResetSchedule}
                  onResetAmountChange={setFormResetAmount}
                />
            </div>

            <div className="shrink-0 px-[18px] pt-2 pb-[calc(18px+env(safe-area-inset-bottom,0px))]">
              <button
                type="button" onClick={handleFormSubmit} disabled={!formValid || pending}
                className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-[15.5px] font-semibold"
                style={{ background: ACCENT, color: "#0B0D10", opacity: formValid ? 1 : 0.45 }}
              >
                {pending ? "Saving..." : (
                  <>
                    <Check className="h-4 w-4" /> {formMode === "edit" ? "Save Changes" : "Add Segment"}
                  </>
                )}
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </DialogContent>
    </Dialog>
  )
}
