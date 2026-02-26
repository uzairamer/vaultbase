"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Pencil, Check, X, Plus } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { useCreateSegment, useUpdateSegment, useDeleteSegment } from "../hooks"
import { toast } from "sonner"

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
]

export interface Segment {
  id: string
  name: string
  amount: number
  color: string
  isDefault: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletId: string
  walletName: string
  walletBalance: number
  segments: Segment[]
}

export function WalletSegmentsDialog({ open, onOpenChange, walletId, walletName, walletBalance, segments }: Props) {
  const createSegment = useCreateSegment()
  const updateSegment = useUpdateSegment()
  const deleteSegment = useDeleteSegment()

  // Add form state
  const [newName, setNewName] = useState("")
  const [newAmount, setNewAmount] = useState("")
  const [newColor, setNewColor] = useState(PRESET_COLORS[1])

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editColor, setEditColor] = useState("")

  const totalAllocated = segments.reduce((sum, s) => sum + s.amount, 0)
  const unallocated = walletBalance - totalAllocated

  function startEdit(seg: Segment) {
    setEditingId(seg.id)
    setEditName(seg.name)
    setEditAmount(String(seg.amount))
    setEditColor(seg.color)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  function saveEdit(id: string) {
    const amount = Number(editAmount)
    if (!editName.trim() || isNaN(amount) || amount < 0) {
      toast.error("Enter a valid name and amount")
      return
    }
    updateSegment.mutate(
      { id, name: editName.trim(), amount, color: editColor },
      {
        onSuccess: () => { setEditingId(null); toast.success("Segment updated") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function handleDelete(id: string) {
    deleteSegment.mutate(id, {
      onSuccess: () => toast.success("Segment removed"),
      onError: (err) => toast.error(err.message),
    })
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(newAmount)
    if (!newName.trim() || isNaN(amount) || amount < 0) {
      toast.error("Enter a valid name and amount")
      return
    }
    createSegment.mutate(
      { walletId, name: newName.trim(), amount, color: newColor },
      {
        onSuccess: () => {
          setNewName("")
          setNewAmount("")
          setNewColor(PRESET_COLORS[1])
          toast.success("Segment added")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  // Build stacked bar data
  const barSegments = segments.map((s) => ({
    ...s,
    pct: walletBalance > 0 ? Math.min((s.amount / walletBalance) * 100, 100) : 0,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Segments — {walletName}</DialogTitle>
        </DialogHeader>

        {/* Balance summary */}
        <div className="flex items-center justify-between text-sm rounded-lg bg-muted/50 px-4 py-3">
          <span className="text-muted-foreground">Wallet balance</span>
          <span className="font-semibold tabular-nums">{formatCurrency(walletBalance)}</span>
        </div>

        {/* Stacked bar */}
        {segments.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {barSegments.map((s) => (
                <div
                  key={s.id}
                  style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                  className="h-full transition-all"
                  title={`${s.name}: ${formatCurrency(s.amount)}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {segments.map((s) => (
                <span key={s.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Allocation status */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Allocated: <span className="font-medium text-foreground tabular-nums">{formatCurrency(totalAllocated)}</span>
          </span>
          <span className={unallocated < 0 ? "text-red-500 font-medium tabular-nums" : "text-muted-foreground tabular-nums"}>
            {unallocated < 0 ? `Over by ${formatCurrency(Math.abs(unallocated))}` : `${formatCurrency(unallocated)} unallocated`}
          </span>
        </div>

        {/* Segment list */}
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {segments.map((seg) =>
            editingId === seg.id ? (
              <div key={seg.id} className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
                {/* Color picker */}
                <div className="flex gap-1 shrink-0">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`h-4 w-4 rounded-full border-2 transition-transform ${editColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-7 text-sm flex-1 min-w-0"
                />
                <Input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="h-7 text-sm w-28"
                  step="0.01"
                  min="0"
                />
                <button onClick={() => saveEdit(seg.id)} className="text-green-500 hover:text-green-400 shrink-0" title="Save">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground shrink-0" title="Cancel">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div key={seg.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 group">
                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="flex-1 text-sm font-medium truncate">{seg.name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{formatCurrency(seg.amount)}</span>
                <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
                  {walletBalance > 0 ? `${Math.round((seg.amount / walletBalance) * 100)}%` : "—"}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(seg)} className="p-1 rounded hover:bg-muted" title="Edit">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(seg.id)}
                    className="p-1 rounded hover:bg-muted"
                    title={segments.length === 1 ? "Cannot delete the last segment" : "Delete"}
                    disabled={segments.length === 1}
                  >
                    <Trash2 className={`h-3.5 w-3.5 ${segments.length === 1 ? "text-muted-foreground/30" : "text-red-400"}`} />
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Add segment form */}
        <form onSubmit={handleAdd} className="space-y-3 border-t pt-3">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Segment</Label>
          <div className="flex gap-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`h-5 w-5 rounded-full border-2 transition-transform ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Name (e.g. Groceries)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1"
              required
            />
            <Input
              type="number"
              placeholder="Amount"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="w-32"
              step="0.01"
              min="0"
              required
            />
            <Button type="submit" size="sm" disabled={createSegment.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
