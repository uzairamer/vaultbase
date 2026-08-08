"use client"

import { useMemo, useState } from "react"
import { Instrument_Sans, JetBrains_Mono } from "next/font/google"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Wallet } from "lucide-react"
import {
  useIncomeSources, useCreateIncomeSource, useUpdateIncomeSource,
  useDeleteIncomeSource, useCreateBreakdown, useUpdateBreakdown, useDeleteBreakdown,
} from "@/modules/incomes/hooks"
import { cn } from "@/lib/utils"

const instrumentSans = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-income-sans" })
const jbMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-income-mono" })
const mono: React.CSSProperties = { fontFamily: "var(--font-income-mono)" }

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

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
]
const FREQ_LABEL: Record<Frequency, string> = Object.fromEntries(FREQUENCIES.map((f) => [f.value, f.label])) as Record<Frequency, string>

const PALETTE = [
  "#A3E635", "#38BDF8", "#A78BFA", "#FB923C", "#2DD4BF",
  "#F472B6", "#FBBF24", "#60A5FA", "#C084FC", "#4ADE80",
  "#FB7185", "#818CF8", "#34D399", "#F59E0B", "#22D3EE",
]

const UNALLOC_COLOR = "#FBBF24"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sumTree(node: BreakdownNode): number {
  const own = Number(node.amount)
  const kids = node.children ?? []
  if (kids.length === 0) return own
  const childrenSum = kids.reduce((s, c) => s + sumTree(c), 0)
  return Math.max(own, childrenSum)
}

function fmt(n: number): string {
  return "Rs " + Math.round(n).toLocaleString("en-US")
}

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

interface SquarifyItem { id: string; value: number; [k: string]: unknown }
interface PlacedBox extends SquarifyItem { x: number; y: number; w: number; h: number }

function squarify(data: SquarifyItem[], W: number, H: number): PlacedBox[] {
  const out: PlacedBox[] = []
  const items = data.slice().sort((a, b) => b.value - a.value)
  const total = items.reduce((s, i) => s + i.value, 0)
  if (!total) return out
  const scale = (W * H) / total
  const rect = { x: 0, y: 0, w: W, h: H }
  let row: SquarifyItem[] = [], rowVal = 0
  const worst = (r: SquarifyItem[], len: number, val: number) => {
    if (!r.length) return Infinity
    const s = val * scale
    const mx = r[0].value * scale, mn = r[r.length - 1].value * scale
    return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn))
  }
  const place = (r: SquarifyItem[], val: number, horiz: boolean) => {
    const s = val * scale
    if (horiz) {
      const rh = s / rect.w; let cx = rect.x
      r.forEach((it) => { const rw = (it.value * scale) / rh; out.push({ ...it, x: cx, y: rect.y, w: rw, h: rh }); cx += rw })
      rect.y += rh; rect.h -= rh
    } else {
      const rw = s / rect.h; let cy = rect.y
      r.forEach((it) => { const rh = (it.value * scale) / rw; out.push({ ...it, x: rect.x, y: cy, w: rw, h: rh }); cy += rh })
      rect.x += rw; rect.w -= rw
    }
  }
  while (items.length) {
    const horiz = rect.w >= rect.h
    const len = horiz ? rect.w : rect.h
    const it = items[0]
    if (!row.length || worst(row.concat([it]), len, rowVal + it.value) <= worst(row, len, rowVal)) {
      row.push(it); rowVal += it.value; items.shift()
    } else { place(row, rowVal, horiz); row = []; rowVal = 0 }
  }
  if (row.length) place(row, rowVal, rect.w >= rect.h)
  return out
}

// ─── Segmented toggle ─────────────────────────────────────────────────────────

function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-[9px] border border-white/[0.08] bg-[#0B0D10] p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[6px] px-3 py-[5px] text-[12.5px] font-medium transition-colors",
            value === o.value ? "bg-[#22262C] text-[#ECEEF1]" : "text-[#7A818B] hover:text-[#B9C0C9]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
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
          style={{ background: c, borderColor: value === c ? "white" : "transparent", boxShadow: value === c ? `0 0 0 2px ${c}` : "none" }}
        />
      ))}
    </div>
  )
}

// ─── Source Dialog ────────────────────────────────────────────────────────────

function SourceDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Partial<IncomeSource> & { id?: string } }) {
  const [name, setName] = useState(initial?.name ?? "")
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [color, setColor] = useState(initial?.color ?? PALETTE[0])
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? "monthly")

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
        <DialogHeader><DialogTitle>{initial?.id ? "Edit Income Source" : "Add Income Source"}</DialogTitle></DialogHeader>
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
                    frequency === f.value ? "text-white border-transparent bg-primary" : "border-border text-muted-foreground hover:border-foreground/30"
                  )}
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
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !amount || isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {initial?.id ? "Save" : "Add"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Breakdown Item Dialog ────────────────────────────────────────────────────

function BreakdownDialog({ open, onClose, incomeSourceId, parentId, parentName, initial }: {
  open: boolean; onClose: () => void; incomeSourceId: string
  parentId?: string | null; parentName?: string; initial?: BreakdownNode
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "")
  const [note, setNote] = useState(initial?.note ?? "")
  const [color, setColor] = useState(() => initial?.color ?? PALETTE[Math.floor(Math.random() * PALETTE.length)])

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
          <DialogTitle>{initial ? "Edit Item" : parentName ? `Add under "${parentName}"` : "Add Breakdown Item"}</DialogTitle>
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
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !amount || isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {initial ? "Save" : "Add"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Month pill (static display only) ────────────────────────────────────────

function MonthPill() {
  const now = new Date()
  return (
    <div className="flex items-center gap-2 rounded-[9px] border border-white/[0.08] bg-[#15181D] px-3 py-[7px] text-[13px] text-[#B9C0C9]">
      {MONTHS[now.getMonth()]} {now.getFullYear()}
    </div>
  )
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

interface SegItem { id: string; name: string; value: number; color: string }

interface DonutFocus { id: string; name: string; value: number; color: string }

function Donut({
  segItems, total, hover, setHover, size = 230, focusOverride,
}: {
  segItems: SegItem[]; total: number; hover: string | null; setHover: (id: string | null) => void; size?: number
  /** Focus to show in the center label. Falls back to matching `hover` against segItems (top-level only) when omitted. */
  focusOverride?: DonutFocus | null
}) {
  const C = 2 * Math.PI * 38
  const segs = segItems.reduce<{ acc: number; out: { id: string; color: string; dash: string; offset: number; width: number; opacity: number }[] }>(
    (state, s) => {
      const frac = total > 0 ? s.value / total : 0
      const len = Math.max(frac * C - 1.2, 0.6)
      const off = -state.acc * C
      const on = hover === s.id
      state.out.push({ id: s.id, color: s.color, dash: `${len} ${C - len}`, offset: off, width: on ? 15 : 11, opacity: !hover || on ? 1 : 0.3 })
      return { acc: state.acc + frac, out: state.out }
    },
    { acc: 0, out: [] }
  ).out

  const focus = focusOverride !== undefined ? focusOverride : segItems.find((s) => s.id === hover) ?? null
  const allocated = segItems.filter((s) => s.id !== "unallocated").reduce((s, i) => s + i.value, 0)
  const pct = (v: number) => (total > 0 ? ((v / total) * 100).toFixed(1) : "0.0") + "%"

  return (
    <div className="relative mx-auto" style={{ width: size, maxWidth: "100%" }}>
      <svg viewBox="0 0 100 100" className="block w-full h-auto" style={{ transform: "rotate(-90deg)" }}>
        {segs.map((g) => (
          <circle
            key={g.id} cx="50" cy="50" r="38" fill="none" stroke={g.color}
            strokeWidth={g.width} strokeDasharray={g.dash} strokeDashoffset={g.offset} opacity={g.opacity}
            onMouseEnter={() => setHover(g.id)} onMouseLeave={() => setHover(null)}
            style={{ cursor: "pointer", transition: "opacity .15s, stroke-width .15s" }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 pointer-events-none px-[20%] text-center">
        <div className="text-[9.5px] uppercase tracking-[0.1em] text-[#7A818B]" style={mono}>{focus ? "Selected" : "Allocated"}</div>
        <div className="text-[26px] font-semibold tracking-tight" style={{ ...mono, color: focus ? focus.color : "#A3E635" }}>
          {focus ? pct(focus.value) : pct(allocated)}
        </div>
        <div className="text-[11px] text-[#8B929C] leading-tight" style={mono}>{focus ? focus.name : fmt(allocated)}</div>
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ segItems, total, hover, setHover, variant = "desktop" }: {
  segItems: SegItem[]; total: number; hover: string | null; setHover: (id: string | null) => void; variant?: "desktop" | "mobile"
}) {
  const pct = (v: number) => (total > 0 ? ((v / total) * 100).toFixed(1) : "0.0") + "%"
  if (variant === "mobile") {
    return (
      <div className="flex flex-col rounded-[14px] overflow-hidden bg-[#0E1115] border border-white/[0.07]">
        {segItems.map((s) => {
          const on = hover === s.id
          return (
            <button
              key={s.id} onClick={() => setHover(on ? null : s.id)}
              className="flex items-center gap-[11px] px-3.5 py-3 min-h-12 border-b border-white/[0.05] last:border-0 text-left"
              style={{ background: on ? hexA(s.color, 0.1) : "transparent" }}
            >
              <span className="h-[9px] w-[9px] rounded-[2px] shrink-0" style={{ background: s.color }} />
              <span className="flex-1 min-w-0 text-sm truncate" style={{ color: !hover || on ? "#ECEEF1" : "#8B929C" }}>{s.name}</span>
              <span className="text-[11.5px] text-[#7A818B] shrink-0" style={mono}>{pct(s.value)}</span>
              <span className="text-[13px] shrink-0 min-w-[82px] text-right" style={{ ...mono, color: !hover || on ? "#ECEEF1" : "#8B929C" }}>{fmt(s.value)}</span>
            </button>
          )
        })}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-px mt-3.5">
      {segItems.map((s) => {
        const on = hover === s.id
        return (
          <div
            key={s.id} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}
            className="flex items-center gap-[9px] px-2 py-1.5 rounded-lg cursor-default"
            style={{ background: on ? hexA(s.color, 0.1) : "transparent" }}
          >
            <span className="h-[7px] w-[7px] rounded-[2px] shrink-0" style={{ background: s.color }} />
            <span className="flex-1 min-w-0 text-[12.5px] truncate" style={{ color: !hover || on ? "#ECEEF1" : "#8B929C" }}>{s.name}</span>
            <span className="text-[11px] text-[#7A818B] shrink-0" style={mono}>{pct(s.value)}</span>
            <span className="text-[11.5px] shrink-0 min-w-[66px] text-right" style={{ ...mono, color: !hover || on ? "#ECEEF1" : "#8B929C" }}>{fmt(s.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Treemap ──────────────────────────────────────────────────────────────────

function layoutRule(w: number, h: number) {
  if (h >= 70 && w >= 120) return { dir: "column" as const, name: "14px", val: "16px", pad: "10px 12px", gap: "8px", showName: true, showVal: true, showPct: w >= 150 }
  if (h >= 44 && w >= 86) return { dir: "column" as const, name: "11.5px", val: "12.5px", pad: "7px 9px", gap: "4px", showName: true, showVal: true, showPct: w >= 150 }
  if (h >= 60 && w >= 22 && h > w * 2) return { dir: "row" as const, name: "10.5px", val: "10px", pad: "6px 0", gap: "0", showName: true, showVal: false, showPct: false, vertical: true }
  if (h >= 15 && w >= 40) return { dir: "row" as const, name: h >= 24 ? "11px" : "10px", val: h >= 24 ? "11px" : "10px", pad: "0 7px", gap: "8px", showName: true, showVal: w >= 170, showPct: w >= 260 }
  return { dir: "row" as const, name: "10px", val: "10px", pad: "0", gap: "0", showName: false, showVal: false, showPct: false }
}

function Treemap({ segItems, total, hover, setHover, W = 1018, H = 702, minFrac = 0.009 }: {
  segItems: SegItem[]; total: number; hover: string | null; setHover: (id: string | null) => void
  W?: number; H?: number; minFrac?: number
}) {
  const pct = (v: number) => (total > 0 ? ((v / total) * 100).toFixed(1) : "0.0") + "%"
  const boxes = useMemo(() => squarify(
    segItems.map((s) => ({ id: s.id, value: Math.max(s.value, total * minFrac), real: s.value })),
    W, H
  ), [segItems, total, minFrac, W, H])

  return (
    <div className="relative w-full overflow-hidden rounded-[10px]" style={{ aspectRatio: W / H }}>
      {boxes.map((b) => {
        const item = segItems.find((s) => s.id === b.id)
        if (!item) return null
        const on = hover === b.id
        const w = b.w - 6, h = b.h - 6
        const t = layoutRule(w, h)
        return (
          <div
            key={b.id}
            onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)}
            className="absolute box-border cursor-pointer p-[3px]"
            style={{ left: `${(b.x / W) * 100}%`, top: `${(b.y / H) * 100}%`, width: `${(b.w / W) * 100}%`, height: `${(b.h / H) * 100}%` }}
          >
            <div
              className="w-full h-full rounded-lg box-border overflow-hidden flex transition-colors"
              style={{
                padding: t.pad, gap: t.gap,
                flexDirection: t.dir === "column" ? "column" : "row",
                alignItems: t.dir === "column" ? "stretch" : "center",
                justifyContent: t.dir === "column" ? "space-between" : (t.vertical ? "center" : "space-between"),
                background: hexA(item.color, on ? 0.34 : 0.17),
                border: `1px solid ${hexA(item.color, on ? 0.9 : 0.4)}`,
              }}
            >
              {t.showName && (
                <div
                  className="min-w-0 max-w-full max-h-full font-semibold leading-tight overflow-hidden text-ellipsis"
                  style={{
                    fontSize: t.name, color: "#ECEEF1",
                    whiteSpace: t.vertical ? "nowrap" : "normal",
                    writingMode: t.vertical ? "vertical-rl" : "horizontal-tb",
                  }}
                >
                  {item.name}
                </div>
              )}
              {t.showVal && (
                <div className="flex items-baseline gap-[7px] flex-none min-w-0 overflow-hidden">
                  <div className="whitespace-nowrap font-semibold" style={{ ...mono, fontSize: t.val, color: "#ECEEF1" }}>{fmt(item.value)}</div>
                  {t.showPct && <div style={{ ...mono, fontSize: "10.5px", color: hexA(item.color, 0.95) }}>{pct(item.value)}</div>}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Flattened tree row ───────────────────────────────────────────────────────

interface FlatRow {
  id: string; name: string; note: string; color: string; value: number
  depth: number; hasChildren: boolean; isOpen: boolean; isHighlighted: boolean
  node: BreakdownNode
}

function flattenRows(cats: BreakdownNode[], collapsed: Record<string, boolean>, hover: string | null, ancestors: string[] = [], depth = 0): FlatRow[] {
  const rows: FlatRow[] = []
  cats.forEach((c) => {
    const value = sumTree(c)
    const hasChildren = (c.children ?? []).length > 0
    const isOpen = !collapsed[c.id]
    const chain = [...ancestors, c.id]
    const isHighlighted = hover !== null && (hover === c.id || ancestors.includes(hover))
    rows.push({ id: c.id, name: c.name, note: c.note ?? "", color: c.color, value, depth, hasChildren, isOpen, isHighlighted, node: c })
    if (hasChildren && isOpen) {
      rows.push(...flattenRows(c.children, collapsed, hover, chain, depth + 1))
    }
  })
  return rows
}

function findFocusNode(cats: BreakdownNode[], id: string | null): { id: string; name: string; value: number; color: string } | null {
  if (!id) return null
  for (const c of cats) {
    if (c.id === id) return { id: c.id, name: c.name, value: sumTree(c), color: c.color }
    const found = findFocusNode(c.children ?? [], id)
    if (found) return found
  }
  return null
}

// ─── Breakdown workspace (per selected source) ───────────────────────────────

function Workspace({ source, sources, onSelectSource }: { source: IncomeSource; sources: IncomeSource[]; onSelectSource: (id: string) => void }) {
  const [addOpen, setAddOpen] = useState(false)
  const [editSourceOpen, setEditSourceOpen] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<"tree" | "treemap">("tree")
  const [viewM, setViewM] = useState<"list" | "chart">("list")
  const [notesOpen, setNotesOpen] = useState(true)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(source.description ?? "")

  // Per-item actions: edit an existing node, or add a sub-item under a top-level node.
  const [editingNode, setEditingNode] = useState<BreakdownNode | null>(null)
  const [addChildFor, setAddChildFor] = useState<BreakdownNode | null>(null)

  const updateSource = useUpdateIncomeSource()
  const deleteSource = useDeleteIncomeSource()
  const deleteBreakdownItem = useDeleteBreakdown()

  function handleDeleteRow(node: BreakdownNode) {
    deleteBreakdownItem.mutate(node.id, {
      onSuccess: () => toast.success(`"${node.name}" removed`),
      onError: (e) => toast.error(e.message),
    })
  }

  const topLevel = useMemo(() => source.breakdown ?? [], [source.breakdown])
  const total = Number(source.amount)
  const cats = useMemo(() => topLevel.map((c) => ({ ...c, value: sumTree(c) })), [topLevel])
  const allocated = cats.reduce((s, c) => s + c.value, 0)
  const unalloc = Math.max(0, total - allocated)
  const maxCat = Math.max(1, ...cats.map((c) => c.value))

  const segItems: SegItem[] = useMemo(() => {
    const items: SegItem[] = cats.map((c) => ({ id: c.id, name: c.name, value: c.value, color: c.color }))
    if (unalloc > 0) items.push({ id: "unallocated", name: "Unallocated", value: unalloc, color: UNALLOC_COLOR })
    return items
  }, [cats, unalloc])

  const rows = useMemo(() => flattenRows(topLevel, collapsed, hover), [topLevel, collapsed, hover])

  // Deep focus lookup (any depth) for the donut center label — a hovered leaf
  // has no matching top-level segment, but should still surface its own name/value/color.
  const focus: DonutFocus | null = hover === "unallocated"
    ? { id: "unallocated", name: "Unallocated", value: unalloc, color: UNALLOC_COLOR }
    : findFocusNode(topLevel, hover)

  const anyOpen = topLevel.some((c) => (c.children ?? []).length > 0 && !collapsed[c.id])
  const catCount = cats.length
  const leafCount = topLevel.reduce((s, c) => s + Math.max(1, (c.children ?? []).length), 0)

  function toggleAll() {
    const nextOpen = !anyOpen
    const next: Record<string, boolean> = {}
    topLevel.forEach((c) => { if ((c.children ?? []).length > 0) next[c.id] = !nextOpen })
    setCollapsed(next)
  }

  function saveNotes() {
    updateSource.mutate(
      { id: source.id, description: notesDraft.trim() || null },
      { onSuccess: () => setEditingNotes(false), onError: (e) => toast.error(e.message) }
    )
  }

  return (
    <>
      {/* ── Stat tiles ── */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[150px] rounded-[14px] border border-white/[0.07] bg-[#101317] px-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.1em] text-[#7A818B] mb-2" style={mono}>Total income</div>
          <div className="text-[23px] font-semibold tracking-tight" style={mono}>{fmt(total)}</div>
        </div>
        <div className="flex-1 min-w-[150px] rounded-[14px] border border-white/[0.07] bg-[#101317] px-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.1em] text-[#7A818B] mb-2" style={mono}>Allocated</div>
          <div className="text-[23px] font-semibold tracking-tight text-[#A3E635]" style={mono}>{fmt(allocated)}</div>
        </div>
        <div className="flex-1 min-w-[150px] rounded-[14px] border border-white/[0.07] bg-[#101317] px-4 py-3.5">
          <div className="text-[10px] uppercase tracking-[0.1em] text-[#7A818B] mb-2" style={mono}>Unallocated</div>
          <div className="text-[23px] font-semibold tracking-tight text-[#FBBF24]" style={mono}>{fmt(unalloc)}</div>
        </div>
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden md:flex flex-wrap gap-5 items-start mt-3.5">
        {/* Left rail */}
        <div className="flex-1 min-w-[320px] flex flex-col gap-3.5">
          <SourcesRailContent
            sources={sources} selectedSourceId={source.id} onSelect={onSelectSource}
            onEditSelected={() => setEditSourceOpen(true)}
            onDeleteSelected={() => {
              deleteSource.mutate(source.id, { onSuccess: () => toast.success("Source deleted"), onError: (e) => toast.error(e.message) })
            }}
          />

          {/* Allocation donut card */}
          <div className="rounded-[14px] border border-white/[0.07] bg-[#101317] p-3.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#5C636D] mb-1.5" style={mono}>Allocation</div>
            {segItems.length === 0 ? (
              <p className="text-sm text-[#7A818B] text-center py-8">Add items to see chart</p>
            ) : (
              <>
                <Donut segItems={segItems} total={total} hover={hover} setHover={setHover} focusOverride={focus} />
                <Legend segItems={segItems} total={total} hover={hover} setHover={setHover} />
              </>
            )}
          </div>

          {/* Notes card */}
          <div className="rounded-[14px] border border-white/[0.07] bg-[#101317] p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#5C636D]" style={mono}>Accounts / notes</div>
              {!editingNotes ? (
                <button onClick={() => { setNotesDraft(source.description ?? ""); setEditingNotes(true) }} className="text-[11.5px] text-[#7A818B] hover:text-[#ECEEF1]">Edit</button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingNotes(false)} className="text-[11.5px] text-[#7A818B]">Cancel</button>
                  <button onClick={saveNotes} disabled={updateSource.isPending} className="text-[11.5px] text-[#A3E635] font-medium">Save</button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Add notes — accounts, transfers, anything worth remembering…" className="text-sm min-h-[100px] resize-none bg-[#0B0D10] border-white/10 text-[#ECEEF1]" autoFocus />
            ) : (
              <p className="text-[11px] leading-[1.6] text-[#7A818B] whitespace-pre-wrap" style={mono}>
                {source.description?.trim() || <span className="italic opacity-60">No notes yet. Click Edit to add.</span>}
              </p>
            )}
          </div>
        </div>

        {/* Main breakdown */}
        <div className="flex-[99_1_620px] min-w-0 flex flex-col gap-3.5">
          <div className="rounded-[14px] border border-white/[0.07] bg-[#101317] flex flex-col overflow-hidden">
            <div className="flex flex-wrap gap-3 items-center justify-between px-4 py-3.5 border-b border-white/[0.06]">
              <div className="flex items-baseline gap-2.5">
                <div className="text-[14.5px] font-semibold">Breakdown</div>
                <div className="text-[11px] text-[#7A818B]" style={mono}>{catCount} categories · {leafCount} items</div>
              </div>
              <div className="flex gap-2 items-center">
                <Segmented options={[{ value: "tree", label: "Tree" }, { value: "treemap", label: "Treemap" }]} value={view} onChange={setView} />
                <button onClick={toggleAll} className="rounded-[9px] border border-white/[0.08] bg-[#15181D] px-3 py-[7px] text-[12.5px] text-[#B9C0C9]">
                  {anyOpen ? "Collapse all" : "Expand all"}
                </button>
                <button onClick={() => setAddOpen(true)} className="rounded-[9px] border border-[#A3E635]/25 bg-[#A3E635]/[0.12] px-3 py-[7px] text-[12.5px] font-semibold text-[#A3E635]">
                  + Add item
                </button>
              </div>
            </div>

            {view === "tree" ? (
              <div className="flex flex-col">
                <div className="flex gap-3 px-4 py-2 border-b border-white/[0.05] text-[9.5px] uppercase tracking-[0.1em] text-[#5C636D]" style={mono}>
                  <div className="flex-[1_1_220px]">Category</div>
                  <div className="flex-[0_1_170px]">Share of income</div>
                  <div className="flex-[0_0_128px] text-right">Amount</div>
                  <div className="flex-[0_0_52px] text-right">%</div>
                </div>
                {rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                    <p className="text-sm text-[#7A818B]">No breakdown yet</p>
                    <button onClick={() => setAddOpen(true)} className="mt-1 rounded-md border border-white/10 px-3 py-1.5 text-xs text-[#B9C0C9]">Add first item</button>
                  </div>
                ) : (
                  rows.map((r) => {
                    const barWidth = Math.min(100, (r.value / maxCat) * 100)
                    const pctVal = total > 0 ? (r.value / total) * 100 : 0
                    return (
                      <div
                        key={r.id}
                        onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}
                        className="group relative flex flex-wrap gap-3 items-center px-4 border-b border-white/[0.04] transition-colors"
                        style={{
                          paddingTop: r.depth === 0 ? 13 : 11, paddingBottom: r.depth === 0 ? 13 : 11,
                          background: r.isHighlighted ? hexA(r.color, 0.09) : "transparent",
                          boxShadow: r.isHighlighted ? `inset 3px 0 0 ${r.color}` : "none",
                        }}
                      >
                        <div className="flex-[1_1_220px] min-w-0 flex items-center gap-[9px]" style={{ paddingLeft: r.depth * 26 }}>
                          <button
                            onClick={() => r.hasChildren && setCollapsed((s) => ({ ...s, [r.id]: !s[r.id] }))}
                            className={cn("w-3.5 shrink-0 text-[10px] text-[#7A818B] transition-transform", !r.hasChildren && "opacity-0 pointer-events-none")}
                            style={{ transform: collapsed[r.id] ? "rotate(-90deg)" : "rotate(0deg)" }}
                          >
                            ▾
                          </button>
                          <span className="h-2 w-2 shrink-0" style={{ background: r.color, borderRadius: r.depth === 0 ? 2 : 99 }} />
                          <div className="min-w-0">
                            <div className="truncate" style={{ fontSize: r.depth === 0 ? 14 : 13, fontWeight: r.depth === 0 ? 600 : 500 }}>{r.name}</div>
                            {r.note && <div className="text-[11.5px] text-[#6E757F] truncate">{r.note}</div>}
                          </div>
                        </div>
                        <div className="flex-[0_1_170px] min-w-[80px] h-[5px] rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: r.color, opacity: r.isHighlighted ? 1 : 0.85 }} />
                        </div>
                        <div className="flex-[0_0_128px] text-right font-medium tracking-tight" style={{ ...mono, fontSize: r.depth === 0 ? 14.5 : 13 }}>{fmt(r.value)}</div>
                        <div className="flex-[0_0_52px] text-right text-[11.5px] text-[#7A818B]" style={mono}>{pctVal.toFixed(1)}%</div>

                        {/* Hover-revealed row actions */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[#101317] rounded-md px-0.5">
                          {r.depth === 0 && (
                            <button onClick={() => setAddChildFor(r.node)} title="Add sub-item" className="p-1.5 rounded hover:bg-white/10 text-[#7A818B] hover:text-[#ECEEF1]">
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                          <button onClick={() => setEditingNode(r.node)} title="Edit" className="p-1.5 rounded hover:bg-white/10 text-[#7A818B] hover:text-[#ECEEF1]">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDeleteRow(r.node)} title="Delete" className="p-1.5 rounded hover:bg-red-500/15 text-[#7A818B] hover:text-red-400">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
                {unalloc > 0 && (
                  <div className="flex flex-wrap gap-3 items-center px-4 py-3.5" style={{ background: "rgba(251,191,36,0.05)" }}>
                    <div className="flex-[1_1_220px] flex items-center gap-[9px]" style={{ paddingLeft: 23 }}>
                      <span className="h-2 w-2 rounded-[2px]" style={{ background: UNALLOC_COLOR }} />
                      <span className="text-[13.5px] font-semibold text-[#FBBF24]">Unallocated</span>
                    </div>
                    <div className="flex-[0_1_170px] min-w-[80px] h-[5px] rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(unalloc / Math.max(maxCat, unalloc)) * 100}%`, background: UNALLOC_COLOR }} />
                    </div>
                    <div className="flex-[0_0_128px] text-right font-semibold text-[#FBBF24]" style={{ ...mono, fontSize: 14 }}>{fmt(unalloc)}</div>
                    <div className="flex-[0_0_52px] text-right text-[11.5px] text-[#FBBF24]" style={mono}>{total > 0 ? ((unalloc / total) * 100).toFixed(1) : "0.0"}%</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4">
                {segItems.length === 0 ? (
                  <p className="text-sm text-[#7A818B] text-center py-8">Add items to see the treemap</p>
                ) : (
                  <Treemap segItems={segItems} total={total} hover={hover} setHover={setHover} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE layout ── */}
      <div className="md:hidden flex flex-col gap-4 mt-3.5">
        {/* horizontal-scroll source cards */}
        <SourcesRailContent
          sources={sources} selectedSourceId={source.id} onSelect={onSelectSource}
          onEditSelected={() => setEditSourceOpen(true)}
          onDeleteSelected={() => {
            deleteSource.mutate(source.id, { onSuccess: () => toast.success("Source deleted"), onError: (e) => toast.error(e.message) })
          }}
          variant="mobile"
        />

        <Segmented options={[{ value: "list", label: "Breakdown" }, { value: "chart", label: "Charts" }]} value={viewM} onChange={setViewM} />

        {viewM === "list" ? (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="text-[10.5px] uppercase tracking-[0.12em] text-[#6E757F]" style={mono}>{catCount} categories</div>
              <div className="flex items-center gap-3">
                <button onClick={toggleAll} className="text-[13.5px] text-[#A3E635]">{anyOpen ? "Collapse all" : "Expand all"}</button>
                <button onClick={() => setAddOpen(true)} className="text-[13.5px] text-[#A3E635] font-medium">+ Add</button>
              </div>
            </div>

            <div className="bg-[#0E1115] border-y border-white/[0.07]">
              {rows.map((r) => {
                const barWidth = Math.min(100, (r.value / maxCat) * 100)
                const pctVal = total > 0 ? (r.value / total) * 100 : 0
                return (
                  <div
                    key={r.id}
                    className="w-full flex items-center gap-2 border-b border-white/[0.05] last:border-0"
                    style={{
                      paddingLeft: r.depth === 0 ? 18 : 40, paddingRight: 10,
                      paddingTop: r.depth === 0 ? 13 : 11, paddingBottom: r.depth === 0 ? 13 : 11, minHeight: 56,
                      boxShadow: r.isHighlighted ? `inset 3px 0 0 ${r.color}` : "none",
                    }}
                  >
                    <button
                      onClick={() => r.hasChildren && setCollapsed((s) => ({ ...s, [r.id]: !s[r.id] }))}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left"
                      style={{ cursor: r.hasChildren ? "pointer" : "default" }}
                    >
                      <span className="h-[9px] w-[9px] shrink-0" style={{ background: r.color, borderRadius: r.depth === 0 ? 2 : 99 }} />
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="leading-tight truncate" style={{ fontSize: r.depth === 0 ? 14 : 13, fontWeight: r.depth === 0 ? 600 : 500 }}>{r.name}</div>
                        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden max-w-[150px]">
                          <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: r.color, opacity: r.isHighlighted ? 1 : 0.7 }} />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-[3px] shrink-0">
                        <div className="font-semibold tracking-tight whitespace-nowrap" style={{ ...mono, fontSize: 14 }}>{fmt(r.value)}</div>
                        <div className="text-[11px] text-[#7A818B]" style={mono}>{pctVal.toFixed(1)}%</div>
                      </div>
                      <div className="w-2.5 text-[15px] text-[#5C636D] shrink-0">{r.hasChildren ? (collapsed[r.id] ? "›" : "⌄") : ""}</div>
                    </button>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {r.depth === 0 && (
                        <button onClick={() => setAddChildFor(r.node)} title="Add sub-item" className="p-1.5 rounded text-[#7A818B] active:bg-white/10">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setEditingNode(r.node)} title="Edit" className="p-1.5 rounded text-[#7A818B] active:bg-white/10">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDeleteRow(r.node)} title="Delete" className="p-1.5 rounded text-[#7A818B] active:bg-red-500/15">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {unalloc > 0 && (
                <div className="flex items-center gap-3 px-4.5 py-3.5" style={{ background: "rgba(251,191,36,0.06)", minHeight: 56 }}>
                  <span className="h-[9px] w-[9px] rounded-[2px]" style={{ background: UNALLOC_COLOR }} />
                  <div className="flex-1 text-[14px] font-semibold text-[#FBBF24]">Unallocated</div>
                  <div className="flex flex-col items-end gap-[3px]">
                    <div className="font-semibold" style={{ ...mono, fontSize: 14, color: UNALLOC_COLOR }}>{fmt(unalloc)}</div>
                    <div className="text-[11px]" style={{ ...mono, color: hexA(UNALLOC_COLOR, 0.75) }}>{total > 0 ? ((unalloc / total) * 100).toFixed(1) : "0.0"}%</div>
                  </div>
                  <div className="w-2.5" />
                </div>
              )}
            </div>

            <div className="pt-0.5">
              <button onClick={() => setNotesOpen((v) => !v)} className="w-full flex items-center justify-between min-h-12">
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-[#6E757F]" style={mono}>Accounts / notes</div>
                <div className="text-[13.5px] text-[#A3E635]">{notesOpen ? "Hide" : "Show"}</div>
              </button>
              {notesOpen && (
                <div className="rounded-[14px] overflow-hidden bg-[#0E1115] border border-white/[0.07] p-3.5">
                  {editingNotes ? (
                    <div className="space-y-2">
                      <Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Add notes…" className="text-sm min-h-[100px] resize-none bg-[#0B0D10] border-white/10 text-[#ECEEF1]" autoFocus />
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setEditingNotes(false)} className="text-[13px] text-[#7A818B]">Cancel</button>
                        <button onClick={saveNotes} disabled={updateSource.isPending} className="text-[13px] text-[#A3E635] font-medium">Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[12.5px] leading-[1.6] text-[#7A818B] whitespace-pre-wrap flex-1" style={mono}>
                        {source.description?.trim() || <span className="italic opacity-60">No notes yet.</span>}
                      </p>
                      <button onClick={() => { setNotesDraft(source.description ?? ""); setEditingNotes(true) }} className="shrink-0 text-[#7A818B]"><Pencil className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-[22px]">
            {segItems.length === 0 ? (
              <p className="text-sm text-[#7A818B] text-center py-8">Add items to see charts</p>
            ) : (
              <>
                <Donut segItems={segItems} total={total} hover={hover} setHover={setHover} size={300} focusOverride={focus} />
                <Legend segItems={segItems} total={total} hover={hover} setHover={setHover} variant="mobile" />
                <div className="flex flex-col gap-2.5">
                  <div className="text-[10.5px] uppercase tracking-[0.12em] text-[#6E757F]" style={mono}>Proportional view</div>
                  <Treemap segItems={segItems} total={total} hover={hover} setHover={setHover} W={362} H={394} minFrac={0.02} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {addOpen && <BreakdownDialog open={addOpen} onClose={() => setAddOpen(false)} incomeSourceId={source.id} />}
      {editSourceOpen && <SourceDialog open={editSourceOpen} onClose={() => setEditSourceOpen(false)} initial={source} />}
      {editingNode && (
        <BreakdownDialog open onClose={() => setEditingNode(null)} incomeSourceId={source.id} initial={editingNode} />
      )}
      {addChildFor && (
        <BreakdownDialog open onClose={() => setAddChildFor(null)} incomeSourceId={source.id} parentId={addChildFor.id} parentName={addChildFor.name} />
      )}
    </>
  )
}

// ─── Sources rail (shared desktop card / mobile scroll-row) ──────────────────

function SourcesRailContent({
  sources, selectedSourceId, onSelect, onEditSelected, onDeleteSelected, variant = "desktop",
}: {
  sources: IncomeSource[]; selectedSourceId: string; onSelect: (id: string) => void
  onEditSelected: () => void; onDeleteSelected: () => void; variant?: "desktop" | "mobile"
}) {
  if (variant === "mobile") {
    return (
      <div className="-mx-4 overflow-x-auto px-4 pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="flex gap-2.5 w-max">
          {sources.map((s) => {
            const topLevel = s.breakdown ?? []
            const own = topLevel.reduce((sum, n) => sum + sumTree(n), 0)
            const srcAmount = Number(s.amount)
            const ratio = srcAmount > 0 ? Math.min(own / srcAmount, 1) : 0
            const isActive = s.id === selectedSourceId
            return (
              <button
                key={s.id} onClick={() => onSelect(s.id)}
                className="flex flex-col gap-[7px] min-w-[170px] rounded-[14px] px-3.5 py-3 text-left"
                style={{ background: isActive ? hexA(s.color, 0.08) : "#15181D", border: `1px solid ${isActive ? hexA(s.color, 0.45) : "rgba(255,255,255,0.07)"}` }}
              >
                <div className="flex items-center gap-[7px]">
                  <span className="h-[7px] w-[7px] rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-[13px] font-semibold truncate">{s.name}</span>
                </div>
                <div className="text-[17px] font-semibold tracking-tight" style={mono}>{fmt(srcAmount)}</div>
                <div className="h-[3px] rounded-full bg-white/[0.09] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: s.color }} />
                </div>
                <div className="text-[10.5px] text-[#7A818B]" style={mono}>{FREQ_LABEL[s.frequency]} · {(ratio * 100).toFixed(0)}% allocated</div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-[#101317] p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[#5C636D]" style={mono}>Sources</div>
        <div className="flex items-center gap-1">
          <button onClick={onEditSelected} className="p-1 rounded hover:bg-white/5 text-[#7A818B] hover:text-[#ECEEF1]"><Pencil className="h-3 w-3" /></button>
          <button onClick={onDeleteSelected} className="p-1 rounded hover:bg-red-500/10 text-[#7A818B] hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {sources.map((s) => {
          const topLevel = s.breakdown ?? []
          const own = topLevel.reduce((sum, n) => sum + sumTree(n), 0)
          const srcAmount = Number(s.amount)
          const ratio = srcAmount > 0 ? Math.min(own / srcAmount, 1) : 0
          const isActive = s.id === selectedSourceId
          return (
            <button
              key={s.id} onClick={() => onSelect(s.id)}
              className="flex gap-[11px] items-start rounded-[11px] px-3 py-[11px] text-left transition-colors"
              style={{ background: isActive ? hexA(s.color, 0.08) : "transparent", border: `1px solid ${isActive ? hexA(s.color, 0.45) : "rgba(255,255,255,0.07)"}` }}
            >
              <span className="h-2 w-2 rounded-full shrink-0 mt-1.5" style={{ background: s.color }} />
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[13.5px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{s.name}</div>
                  <div className="text-[9.5px] uppercase tracking-[0.06em] text-[#7A818B] shrink-0" style={mono}>{s.frequency}</div>
                </div>
                <div className="text-[15px] font-medium tracking-tight" style={mono}>{fmt(srcAmount)}</div>
                <div className="h-[3px] rounded-full bg-white/[0.08] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: s.color }} />
                </div>
                <div className="text-[10.5px] text-[#7A818B]" style={mono}>{(ratio * 100).toFixed(0)}% allocated</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IncomeBreakdownPage() {
  const { data: rawSources = [], isLoading } = useIncomeSources()
  const sources = rawSources as IncomeSource[]
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addSourceOpen, setAddSourceOpen] = useState(false)

  const selected = sources.find((s) => s.id === selectedId) ?? sources[0] ?? null

  return (
    <div className={cn(instrumentSans.variable, jbMono.variable)} style={{ fontFamily: "var(--font-income-sans)" }}>
      <div className="rounded-[18px] border border-white/[0.07] bg-[#0B0D10] overflow-hidden text-[#ECEEF1]">
        {/* Header */}
        <div className="flex flex-wrap gap-4 items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="text-[19px] font-semibold tracking-tight">Income Breakdown</div>
            <div className="text-[13px] text-[#8B929C]">Allocate your income across categories and track where every rupee goes</div>
          </div>
          <div className="flex gap-2 items-center shrink-0">
            <MonthPill />
            <button onClick={() => setAddSourceOpen(true)} className="flex items-center gap-[7px] rounded-[9px] bg-[#A3E635] px-3.5 py-2 text-[13px] font-semibold text-[#0B0D10]">
              <Plus className="h-3.5 w-3.5" /> Add source
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-white/[0.03] animate-pulse" />)}
            </div>
          ) : !selected ? (
            <div className="flex flex-col items-center justify-center h-80 text-center gap-3 rounded-xl border border-dashed border-white/10">
              <Wallet className="h-10 w-10 text-white/20" />
              <div>
                <p className="font-medium text-[#B9C0C9]">No income source yet</p>
                <p className="text-sm text-[#7A818B] mt-1">Add one to start building your breakdown</p>
              </div>
              <button onClick={() => setAddSourceOpen(true)} className="mt-1 flex items-center gap-1.5 rounded-[9px] bg-[#A3E635] px-3.5 py-2 text-[13px] font-semibold text-[#0B0D10]">
                <Plus className="h-4 w-4" /> Add Income Source
              </button>
            </div>
          ) : (
            <Workspace key={selected.id} source={selected} sources={sources} onSelectSource={setSelectedId} />
          )}
        </div>
      </div>

      {addSourceOpen && <SourceDialog open={addSourceOpen} onClose={() => setAddSourceOpen(false)} />}
    </div>
  )
}
