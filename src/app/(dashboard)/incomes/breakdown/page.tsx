"use client"

import { useState } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  Wallet, MoreHorizontal, Check,
} from "lucide-react"
import {
  useIncomeSources, useCreateIncomeSource, useUpdateIncomeSource,
  useDeleteIncomeSource, useCreateBreakdown, useUpdateBreakdown, useDeleteBreakdown,
} from "@/modules/incomes/hooks"
import { cn, formatCurrency } from "@/lib/utils"
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BreakdownNode {
  id: string
  name: string
  amount: number
  color: string
  note?: string | null
  parentId?: string | null
  incomeSourceId: string
  children: BreakdownNode[]
}

type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "annually"

interface IncomeSource {
  id: string
  name: string
  amount: number
  color: string
  frequency: Frequency
  description?: string | null
  breakdown: BreakdownNode[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FREQUENCIES: { value: Frequency; label: string; color: string }[] = [
  { value: "daily",      label: "Daily",      color: "#22d3ee" },
  { value: "weekly",     label: "Weekly",     color: "#84cc16" },
  { value: "monthly",    label: "Monthly",    color: "#6366f1" },
  { value: "quarterly",  label: "Quarterly",  color: "#f59e0b" },
  { value: "annually",   label: "Annually",   color: "#ec4899" },
]

const FREQ_MAP = Object.fromEntries(FREQUENCIES.map((f) => [f.value, f])) as Record<Frequency, typeof FREQUENCIES[0]>

const PALETTE = [
  "#6366f1", "#22d3ee", "#f59e0b", "#ec4899", "#84cc16",
  "#f97316", "#a78bfa", "#2dd4bf", "#fb7185", "#34d399",
  "#60a5fa", "#fbbf24", "#c084fc", "#4ade80", "#38bdf8",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sumTree(node: BreakdownNode): number {
  const own = Number(node.amount)
  const kids = node.children ?? []
  if (kids.length === 0) return own
  const childrenSum = kids.reduce((s, c) => s + sumTree(c), 0)
  return Math.max(own, childrenSum)
}

// ─── Color Picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            background: c,
            borderColor: value === c ? "white" : "transparent",
            boxShadow: value === c ? `0 0 0 2px ${c}` : "none",
          }}
        />
      ))}
    </div>
  )
}

// ─── Source Dialog ────────────────────────────────────────────────────────────

function SourceDialog({
  open, onClose, initial,
}: {
  open: boolean
  onClose: () => void
  initial?: Partial<IncomeSource> & { id?: string }
}) {
  const [name, setName]               = useState(initial?.name ?? "")
  const [amount, setAmount]           = useState(initial?.amount?.toString() ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [color, setColor]             = useState(initial?.color ?? PALETTE[0])
  const [frequency, setFrequency]     = useState<Frequency>(initial?.frequency ?? "monthly")

  const create = useCreateIncomeSource()
  const update = useUpdateIncomeSource()
  const isPending = create.isPending || update.isPending

  function handleSubmit() {
    if (!name.trim() || !amount) return
    const data = { name: name.trim(), amount: parseFloat(amount), description: description.trim() || undefined, color, frequency }
    if (initial?.id) {
      update.mutate({ id: initial.id, ...data }, {
        onSuccess: () => { toast.success("Income source updated"); onClose() },
        onError: (e) => toast.error(e.message),
      })
    } else {
      create.mutate(data, {
        onSuccess: () => { toast.success("Income source added"); onClose() },
        onError: (e) => toast.error(e.message),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Income Source" : "Add Income Source"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input placeholder="e.g. Salary, Freelance" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Amount (PKR)</Label>
            <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFrequency(f.value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                    frequency === f.value
                      ? "text-white border-transparent"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
                  style={frequency === f.value ? { background: f.color, borderColor: f.color } : {}}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input placeholder="Notes about this income" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !amount || isPending}>
            {initial?.id ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Breakdown Item Dialog ────────────────────────────────────────────────────

function BreakdownDialog({
  open, onClose, incomeSourceId, parentId, parentName, initial,
}: {
  open: boolean
  onClose: () => void
  incomeSourceId: string
  parentId?: string | null
  parentName?: string
  initial?: BreakdownNode
}) {
  const [name, setName]   = useState(initial?.name ?? "")
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "")
  const [note, setNote]   = useState(initial?.note ?? "")
  const [color, setColor] = useState(initial?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)])

  const create = useCreateBreakdown()
  const update = useUpdateBreakdown()
  const isPending = create.isPending || update.isPending

  function handleSubmit() {
    if (!name.trim() || !amount) return
    const data = { name: name.trim(), amount: parseFloat(amount), color, note: note.trim() || undefined }
    if (initial?.id) {
      update.mutate({ id: initial.id, ...data }, {
        onSuccess: () => { toast.success("Item updated"); onClose() },
        onError: (e) => toast.error(e.message),
      })
    } else {
      create.mutate({ incomeSourceId, parentId: parentId ?? null, ...data }, {
        onSuccess: () => { toast.success("Item added"); onClose() },
        onError: (e) => toast.error(e.message),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit Item" : parentName ? `Add under "${parentName}"` : "Add Breakdown Item"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Category Name</Label>
            <Input placeholder="e.g. Investments, Fuel, Rent" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (PKR)</Label>
            <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !amount || isPending}>
            {initial ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tree Node ────────────────────────────────────────────────────────────────

function TreeNode({
  node, totalIncome, depth = 0,
}: {
  node: BreakdownNode
  totalIncome: number
  depth?: number
}) {
  const [expanded, setExpanded]           = useState(true)
  const [editOpen, setEditOpen]           = useState(false)
  const [addChildOpen, setAddChildOpen]   = useState(false)
  const deleteBreakdown = useDeleteBreakdown()

  const effectiveAmount = sumTree(node)
  const pctOfIncome     = totalIncome > 0 ? (effectiveAmount / totalIncome) * 100 : 0
  const hasChildren     = (node.children ?? []).length > 0

  function handleDelete() {
    deleteBreakdown.mutate(node.id, {
      onSuccess: () => toast.success(`"${node.name}" removed`),
      onError:   (e) => toast.error(e.message),
    })
  }

  return (
    <div>
      <div className="group relative flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
        {/* Indent spacer for sub-items */}
        {depth > 0 && (
          <span className="w-5 shrink-0 self-stretch border-l border-border/40" />
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn("shrink-0 text-muted-foreground transition-transform", !hasChildren && "opacity-0 pointer-events-none")}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Color dot */}
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: node.color }} />

        {/* Name + note */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{node.name}</p>
          {node.note && <p className="text-xs text-muted-foreground truncate">{node.note}</p>}
        </div>

        {/* Amount + pct */}
        <div className="text-right shrink-0 pl-2">
          <p className="text-sm font-semibold tabular-nums whitespace-nowrap">{formatCurrency(effectiveAmount)}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">{pctOfIncome.toFixed(1)}% of income</p>
        </div>

        {/* Actions — absolutely positioned overlay on hover */}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/95 rounded-md px-0.5 backdrop-blur-sm">
          {depth === 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setAddChildOpen(true)}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Add sub-item</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setEditOpen(true)}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Progress bar */}
      <div className={cn("mx-3 h-0.5 rounded-full bg-muted overflow-hidden mb-0.5", depth > 0 && "ml-12")}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pctOfIncome, 100)}%`, background: node.color, opacity: 0.6 }}
        />
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="mt-0.5">
          {(node.children ?? []).map((child) => (
            <TreeNode key={child.id} node={child} totalIncome={totalIncome} depth={depth + 1} />
          ))}
        </div>
      )}

      {editOpen && (
        <BreakdownDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          incomeSourceId={node.incomeSourceId}
          initial={node}
        />
      )}
      {addChildOpen && (
        <BreakdownDialog
          open={addChildOpen}
          onClose={() => setAddChildOpen(false)}
          incomeSourceId={node.incomeSourceId}
          parentId={node.id}
          parentName={node.name}
        />
      )}
    </div>
  )
}

// ─── Pie Tooltip ──────────────────────────────────────────────────────────────

function PieTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number; color: string; pct: number } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-xl border border-white/10 bg-[#1e293b] shadow-2xl p-3 text-xs min-w-[140px] space-y-1">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
        <p className="font-semibold text-white">{d.name}</p>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Amount</span>
        <span className="text-white font-medium tabular-nums">{formatCurrency(d.value)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-slate-400">Share</span>
        <span className="text-white font-medium tabular-nums">{d.pct.toFixed(1)}%</span>
      </div>
    </div>
  )
}

// ─── Breakdown Panel ──────────────────────────────────────────────────────────

function BreakdownPanel({ source }: { source: IncomeSource }) {
  const [addOpen, setAddOpen]           = useState(false)
  const [editOpen, setEditOpen]         = useState(false)
  const [activeIdx, setActiveIdx]       = useState<number | null>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft]     = useState(source.description ?? "")
  const updateSource = useUpdateIncomeSource()
  const deleteSource = useDeleteIncomeSource()

  function saveNotes() {
    updateSource.mutate(
      { id: source.id, description: notesDraft.trim() || null },
      { onSuccess: () => setEditingNotes(false), onError: (e) => toast.error(e.message) }
    )
  }

  const topLevel       = (source.breakdown ?? []) as BreakdownNode[]
  const totalAmount    = Number(source.amount)
  const totalAllocated = topLevel.reduce((s, n) => s + sumTree(n), 0)
  const remaining      = totalAmount - totalAllocated

  const pieData = [
    ...topLevel.map((n) => ({
      name:  n.name,
      value: sumTree(n),
      color: n.color,
      pct:   totalAmount > 0 ? (sumTree(n) / totalAmount) * 100 : 0,
    })),
    ...(remaining > 0 ? [{ name: "Unallocated", value: remaining, color: "#334155", pct: totalAmount > 0 ? (remaining / totalAmount) * 100 : 0 }] : []),
  ]

  const active = activeIdx !== null ? pieData[activeIdx] : null

  return (
    <div className="space-y-6">
      {/* Source header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${source.color}20` }}>
            <span className="h-4 w-4 rounded-full" style={{ background: source.color }} />
          </div>
          <div>
            <h2 className="text-lg font-bold">{source.name}</h2>
            {source.description && <p className="text-sm text-muted-foreground">{source.description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            size="sm" variant="outline"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={() => deleteSource.mutate(source.id, { onSuccess: () => toast.success("Source deleted"), onError: (e) => toast.error(e.message) })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Income",  value: formatCurrency(totalAmount),    accent: source.color },
          { label: "Allocated",     value: formatCurrency(totalAllocated), accent: "#22c55e"    },
          { label: "Unallocated",   value: formatCurrency(Math.max(0, remaining)), accent: remaining > 0 ? "#f59e0b" : "#6b7280" },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-xl border p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            </div>
            <p className="text-sm font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Tree + Pie — 50/50 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">

        {/* Breakdown Tree card — LEFT */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Breakdown Tree</CardTitle>
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 h-7 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            {topLevel.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                <MoreHorizontal className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No breakdown yet</p>
                <p className="text-xs text-muted-foreground/70">Add items to allocate your income</p>
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="mt-2 gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add first item
                </Button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {topLevel.map((node) => (
                  <TreeNode key={node.id} node={node} totalIncome={totalAmount} />
                ))}
                {remaining > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border/50 mt-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-500/50" />
                    <span className="text-sm text-muted-foreground flex-1">Unallocated</span>
                    <span className="text-sm font-medium tabular-nums text-muted-foreground">{formatCurrency(remaining)}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donut chart card — RIGHT */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Allocation Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Add items to see chart</p>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Donut */}
                <div className="relative mx-auto" style={{ width: 200, height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={92}
                        dataKey="value"
                        paddingAngle={2}
                        startAngle={90}
                        endAngle={-270}
                        strokeWidth={0}
                        onMouseEnter={(_, i) => setActiveIdx(i)}
                        onMouseLeave={() => setActiveIdx(null)}
                      >
                        {pieData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.color}
                            opacity={activeIdx === null || activeIdx === i ? 1 : 0.2}
                            style={{ transition: "opacity 150ms", cursor: "pointer" }}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                    {active ? (
                      <>
                        <span className="inline-block h-2 w-2 rounded-full mb-1" style={{ background: active.color }} />
                        <p className="text-xs font-semibold">{active.name}</p>
                        <p className="text-base font-bold">{active.pct.toFixed(1)}%</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Allocated</p>
                        <p className="text-base font-bold tabular-nums">
                          {totalAmount > 0 ? ((totalAllocated / totalAmount) * 100).toFixed(0) : 0}%
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-0.5">
                  {pieData.map((d, i) => (
                    <div
                      key={i}
                      className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-default transition-colors", activeIdx === i ? "bg-muted" : "hover:bg-muted/40")}
                      onMouseEnter={() => setActiveIdx(i)}
                      onMouseLeave={() => setActiveIdx(null)}
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-xs font-medium flex-1 truncate">{d.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{d.pct.toFixed(1)}%</span>
                      <span className="text-xs font-semibold tabular-nums w-20 text-right">{formatCurrency(d.value)}</span>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div className="border-t border-border/40 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</p>
                    {!editingNotes ? (
                      <button
                        onClick={() => { setNotesDraft(source.description ?? ""); setEditingNotes(true) }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditingNotes(false)}>Cancel</Button>
                        <Button size="sm" className="h-6 px-2 text-xs" onClick={saveNotes} disabled={updateSource.isPending}>Save</Button>
                      </div>
                    )}
                  </div>
                  {editingNotes ? (
                    <Textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Add notes about this income allocation…"
                      className="text-sm min-h-[80px] resize-none"
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {source.description?.trim() || <span className="italic opacity-50">No notes yet. Click the pencil to add.</span>}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {addOpen && (
        <BreakdownDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          incomeSourceId={source.id}
        />
      )}
      {editOpen && (
        <SourceDialog open={editOpen} onClose={() => setEditOpen(false)} initial={source} />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncomeBreakdownPage() {
  const { data: rawSources = [], isLoading } = useIncomeSources()
  const sources = rawSources as IncomeSource[]
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [addSourceOpen, setAddSourceOpen] = useState(false)

  const selected = sources.find((s) => s.id === selectedId) ?? sources[0] ?? null

  return (
    <div>
      <PageHeader
        title="Income Breakdown"
        description="Allocate your income across categories and track where every rupee goes"
      />

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* ── Sources sidebar ── */}
        <div className="w-full md:w-64 shrink-0 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sources</p>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setAddSourceOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center space-y-2">
              <Wallet className="h-6 w-6 mx-auto text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">No income sources yet</p>
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={() => setAddSourceOpen(true)}>
                <Plus className="h-3 w-3" /> Add Source
              </Button>
            </div>
          ) : (
            sources.map((s) => {
              const isActive     = (selected?.id === s.id)
              const topLevel     = (s.breakdown ?? []) as BreakdownNode[]
              const allocated    = topLevel.reduce((sum, n) => sum + sumTree(n), 0)
              const srcAmount    = Number(s.amount)
              const pct          = srcAmount > 0 ? Math.min((allocated / srcAmount) * 100, 100) : 0

              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all",
                    isActive
                      ? "border-transparent ring-2 bg-muted/60"
                      : "hover:bg-muted/30 border-border/50"
                  )}
                  style={isActive ? { "--tw-ring-color": s.color } as React.CSSProperties : {}}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-sm font-semibold truncate flex-1">{s.name}</span>
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: s.color }} />}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs text-muted-foreground tabular-nums">{formatCurrency(srcAmount)}</p>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ background: `${FREQ_MAP[s.frequency as Frequency]?.color ?? "#6366f1"}20`, color: FREQ_MAP[s.frequency as Frequency]?.color ?? "#6366f1" }}
                    >
                      {FREQ_MAP[s.frequency as Frequency]?.label ?? s.frequency}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: s.color }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">{pct.toFixed(0)}% allocated</p>
                </button>
              )
            })
          )}

          {sources.length > 0 && (
            <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => setAddSourceOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Source
            </Button>
          )}
        </div>

        {/* ── Breakdown main ── */}
        <div className="flex-1 min-w-0 w-full">
          {selected ? (
            <BreakdownPanel key={selected.id} source={selected} />
          ) : !isLoading && (
            <div className="flex flex-col items-center justify-center h-96 text-center gap-3 rounded-xl border border-dashed border-border">
              <Wallet className="h-12 w-12 text-muted-foreground/30" />
              <div>
                <p className="font-medium text-muted-foreground">No income source selected</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Add an income source to start building your breakdown</p>
              </div>
              <Button onClick={() => setAddSourceOpen(true)} className="gap-1.5 mt-2">
                <Plus className="h-4 w-4" /> Add Income Source
              </Button>
            </div>
          )}
        </div>
      </div>

      {addSourceOpen && (
        <SourceDialog open={addSourceOpen} onClose={() => setAddSourceOpen(false)} />
      )}
    </div>
  )
}
