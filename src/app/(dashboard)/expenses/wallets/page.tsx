"use client"

import { useState, useEffect } from "react"
import { useWallets, useCreateWallet, useDeleteWallet, useCheckSegmentResets, useArchiveWallet } from "@/modules/expenses/hooks"
import { WalletSegmentsDialog } from "@/modules/expenses/components/wallet-segments-dialog"
import type { Segment } from "@/modules/expenses/components/wallet-segments-dialog"
import { WalletCardStack } from "@/modules/expenses/components/wallet-card-stack"
import type { WalletStackItem } from "@/modules/expenses/components/wallet-card-stack"
import { AddTransactionDialog } from "@/modules/expenses/components/add-transaction-dialog"
import { TransferDialog } from "@/modules/expenses/components/transfer-dialog"
import { ReconcileDialog } from "@/modules/expenses/components/reconcile-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Wallet, Trash2, Building, Banknote, Smartphone, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, LayoutGrid, Scale, Wifi, Archive } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { WALLET_TYPES } from "@/lib/constants"
import { toast } from "sonner"

const walletIcons: Record<string, React.ElementType> = {
  bank: Building,
  cash: Banknote,
  digital_wallet: Smartphone,
  other: Wallet,
}

// Deterministic accent colour based on wallet name
const CARD_ACCENTS = [
  { from: "#4f46e5", to: "#7c3aed" }, // indigo → violet
  { from: "#0ea5e9", to: "#2563eb" }, // sky → blue
  { from: "#10b981", to: "#0d9488" }, // emerald → teal
  { from: "#f59e0b", to: "#d97706" }, // amber → amber-dark
  { from: "#ec4899", to: "#db2777" }, // pink → rose
  { from: "#64748b", to: "#475569" }, // slate
]

function cardAccent(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return CARD_ACCENTS[Math.abs(hash) % CARD_ACCENTS.length]
}

type ActionVariant = "inflow" | "outflow" | "transfer"

const ACTION_STYLES: Record<ActionVariant, { icon: React.ElementType; border: string; bg: string; iconBg: string; text: string }> = {
  inflow: {
    icon: ArrowDownLeft,
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/[0.07] hover:bg-emerald-500/[0.13]",
    iconBg: "bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  outflow: {
    icon: ArrowUpRight,
    border: "border-rose-500/25",
    bg: "bg-rose-500/[0.07] hover:bg-rose-500/[0.13]",
    iconBg: "bg-rose-500/15",
    text: "text-rose-600 dark:text-rose-400",
  },
  transfer: {
    icon: ArrowLeftRight,
    border: "border-sky-500/25",
    bg: "bg-sky-500/[0.07] hover:bg-sky-500/[0.13]",
    iconBg: "bg-sky-500/15",
    text: "text-sky-600 dark:text-sky-400",
  },
}

function WalletActionButton({
  variant, label, onClick, disabled, title,
}: { variant: ActionVariant; label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  const s = ACTION_STYLES[variant]
  const Icon = s.icon
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        s.border, s.bg, s.text
      )}
    >
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", s.iconBg)}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      {label}
    </button>
  )
}

// Decorative SVG shapes — deterministic positions from name hash
function CardDecorations({ name }: { name: string }) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  const abs = (n: number) => Math.abs(n)

  // 4 rings + 2 small filled circles, all with very low opacity
  const rings = [
    { cx: 85 + (abs(h >> 3) % 15), cy: -15 + (abs(h >> 7) % 20), r: 70 + (abs(h >> 11) % 30) },
    { cx: 60 + (abs(h >> 5) % 20), cy: 90 + (abs(h >> 9) % 20), r: 50 + (abs(h >> 13) % 25) },
    { cx: -10 + (abs(h >> 2) % 15), cy: 30 + (abs(h >> 6) % 30), r: 55 + (abs(h >> 10) % 20) },
    { cx: 40 + (abs(h >> 4) % 25), cy: 10 + (abs(h >> 8) % 20), r: 35 + (abs(h >> 12) % 15) },
  ]
  const dots = [
    { cx: 20 + (abs(h >> 1) % 60), cy: 15 + (abs(h >> 15) % 50), r: 3 + (abs(h >> 17) % 3) },
    { cx: 55 + (abs(h >> 3) % 35), cy: 60 + (abs(h >> 16) % 30), r: 2 + (abs(h >> 18) % 2) },
  ]

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      {rings.map((r, i) => (
        <circle key={i} cx={`${r.cx}%`} cy={`${r.cy}%`} r={r.r} fill="none" stroke="white" strokeWidth="0.5" strokeOpacity={0.06 + (i % 2) * 0.02} />
      ))}
      {dots.map((d, i) => (
        <circle key={i} cx={`${d.cx}%`} cy={`${d.cy}%`} r={d.r} fill="white" fillOpacity={0.04} />
      ))}
    </svg>
  )
}

export default function WalletsPage() {
  const { data: wallets = [], isLoading } = useWallets()
  const createWallet = useCreateWallet()
  const deleteWallet = useDeleteWallet()
  const archive = useArchiveWallet()
  const checkResets = useCheckSegmentResets()

  // Check and apply any due segment resets on page load
  useEffect(() => { checkResets.mutate() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [open, setOpen] = useState(false)

  // Reconcile dialog state
  const [reconcileWalletId, setReconcileWalletId] = useState<string | null>(null)

  // Transaction dialog state
  const [txWalletId, setTxWalletId] = useState<string | null>(null)
  const [txType, setTxType] = useState<"inflow" | "outflow" | null>(null)

  // Transfer dialog state
  const [transferFromId, setTransferFromId] = useState<string | null>(null)

  // Segments dialog state
  const [segmentsWalletId, setSegmentsWalletId] = useState<string | null>(null)

  // Delete confirmation state
  const [deleteWalletId, setDeleteWalletId] = useState<string | null>(null)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("")

  // Archive confirmation state
  const [archiveWalletId, setArchiveWalletId] = useState<string | null>(null)
  const [archiveConfirmInput, setArchiveConfirmInput] = useState("")

  // Mobile card stack — which wallet is currently front-and-center
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)

  const totalBalance = (wallets as Record<string, unknown>[]).reduce(
    (sum: number, w: Record<string, unknown>) => sum + Number(w.balance),
    0
  )

  function handleCreateWallet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createWallet.mutate(
      {
        name: fd.get("name") as string,
        type: fd.get("type") as string,
        bankName: (fd.get("bankName") as string) || undefined,
        balance: Number(fd.get("balance")),
      },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success("Wallet created")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function closeTxDialog() {
    setTxWalletId(null)
    setTxType(null)
  }

  const activeWallet =
    (wallets as Record<string, unknown>[]).find((w) => w.id === activeWalletId) ?? (wallets as Record<string, unknown>[])[0]

  if (isLoading) return <div className="p-6">Loading...</div>

  return (
    <div>
      <PageHeader
        title="Wallets"
        description={`Total balance: ${formatCurrency(totalBalance)}`}
      >
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Wallet</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Wallet</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateWallet} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" placeholder="e.g. HBL Savings" required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select name="type" required>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {WALLET_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bank Name (optional)</Label>
                <Input name="bankName" placeholder="e.g. HBL, Meezan" />
              </div>
              <div className="space-y-2">
                <Label>Initial Balance</Label>
                <Input name="balance" type="number" step="0.01" defaultValue="0" required />
              </div>
              <Button type="submit" className="w-full" disabled={createWallet.isPending}>
                {createWallet.isPending ? "Creating..." : "Create Wallet"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Transaction Dialog — same redesigned Add Transaction UI used on the Cash Flow page */}
      <AddTransactionDialog
        open={!!txWalletId}
        onOpenChange={(isOpen) => { if (!isOpen) closeTxDialog() }}
        initialWalletId={txWalletId ?? undefined}
        initialType={txType ?? undefined}
      />

      {/* Transfer Dialog */}
      <TransferDialog
        open={!!transferFromId}
        onOpenChange={(isOpen) => { if (!isOpen) setTransferFromId(null) }}
        fromWalletId={transferFromId}
      />

      {/* Reconcile Dialog */}
      {(() => {
        const rw = (wallets as Record<string, unknown>[]).find((w) => w.id === reconcileWalletId)
        return (
          <ReconcileDialog
            open={!!reconcileWalletId}
            onOpenChange={(isOpen) => { if (!isOpen) setReconcileWalletId(null) }}
            walletId={reconcileWalletId}
            walletName={(rw?.name as string) ?? ""}
            currentBalance={rw ? Number(rw.balance) : 0}
          />
        )
      })()}

      {/* Delete Confirmation Dialog */}
      {(() => {
        const dw = (wallets as Record<string, unknown>[]).find((w) => w.id === deleteWalletId)
        const confirmed = deleteConfirmInput === "delete me"
        return (
          <Dialog open={!!deleteWalletId} onOpenChange={(isOpen) => { if (!isOpen) { setDeleteWalletId(null); setDeleteConfirmInput("") } }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete wallet
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  <p className="font-medium">{dw?.name as string}</p>
                  <p className="text-xs mt-1 text-destructive/80">
                    This will permanently delete the wallet and all its transactions. This cannot be undone.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">
                    Type <span className="font-mono font-semibold text-foreground">delete me</span> to confirm
                  </Label>
                  <Input
                    placeholder="delete me"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    autoFocus
                    className={confirmed ? "border-destructive focus-visible:ring-destructive/30" : ""}
                  />
                </div>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={!confirmed || deleteWallet.isPending}
                  onClick={() => {
                    if (!deleteWalletId) return
                    deleteWallet.mutate(deleteWalletId, {
                      onSuccess: () => {
                        setDeleteWalletId(null)
                        setDeleteConfirmInput("")
                        toast.success("Wallet deleted")
                      },
                      onError: (err) => toast.error(err.message),
                    })
                  }}
                >
                  {deleteWallet.isPending ? "Deleting..." : "Delete wallet"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}

      {/* Archive Confirmation Dialog */}
      {(() => {
        const aw = (wallets as Record<string, unknown>[]).find((w) => w.id === archiveWalletId)
        const txCount = Number(aw?._count && (aw._count as Record<string, number>).transactions) || 0
        const balance = Number(aw?.balance ?? 0)
        const confirmed = archiveConfirmInput === "archive me"
        return (
          <Dialog open={!!archiveWalletId} onOpenChange={(isOpen) => { if (!isOpen) { setArchiveWalletId(null); setArchiveConfirmInput("") } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <Archive className="h-4 w-4" />
                  Archive & reset wallet
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">{aw?.name as string}</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    This will archive <span className="font-medium text-foreground">{txCount}</span> transaction{txCount !== 1 ? "s" : ""}, reset the balance from <span className="font-medium text-foreground">{formatCurrency(balance)}</span> to <span className="font-medium text-foreground">{formatCurrency(0)}</span>, and zero all segment amounts. Segment configurations are preserved.
                  </p>
                  <p className="text-xs mt-2 text-muted-foreground">
                    Archived data is hidden from analytics but preserved in the database for audit.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">
                    Type <span className="font-mono font-semibold text-foreground">archive me</span> to confirm
                  </Label>
                  <Input
                    placeholder="archive me"
                    value={archiveConfirmInput}
                    onChange={(e) => setArchiveConfirmInput(e.target.value)}
                    autoFocus
                    className={confirmed ? "border-orange-500 focus-visible:ring-orange-500/30" : ""}
                  />
                </div>
                <Button
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={!confirmed || archive.isPending}
                  onClick={() => {
                    if (!archiveWalletId) return
                    archive.mutate(archiveWalletId, {
                      onSuccess: (res: { archived: number }) => {
                        setArchiveWalletId(null)
                        setArchiveConfirmInput("")
                        toast.success(`Archived ${res.archived} transaction${res.archived !== 1 ? "s" : ""}. Wallet reset.`)
                      },
                      onError: (err) => toast.error(err.message),
                    })
                  }}
                >
                  {archive.isPending ? "Archiving..." : "Archive & reset"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}

      {/* Segments Dialog */}
      {segmentsWalletId && (() => {
        const w = (wallets as Record<string, unknown>[]).find((w) => w.id === segmentsWalletId)
        if (!w) return null
        return (
          <WalletSegmentsDialog
            open={!!segmentsWalletId}
            onOpenChange={(isOpen) => { if (!isOpen) setSegmentsWalletId(null) }}
            walletId={w.id as string}
            walletName={w.name as string}
            walletBalance={Number(w.balance)}
            segments={((w.segments ?? []) as Segment[]).map((s) => ({
              ...s,
              amount: Number(s.amount),
            }))}
          />
        )
      })()}

      {(wallets as Record<string, unknown>[]).length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No wallets yet"
          description="Add your first wallet to start tracking expenses."
        />
      ) : (
        <>
          {/* ── Mobile: snap-scroll card stack + action panel for the active wallet ── */}
          <div className="md:hidden">
            <WalletCardStack
              wallets={wallets as unknown as WalletStackItem[]}
              activeId={activeWalletId ?? ((wallets as Record<string, unknown>[])[0]?.id as string)}
              onActiveChange={setActiveWalletId}
            />

            {activeWallet && (() => {
              const wallet = activeWallet
              const segs = ((wallet.segments ?? []) as Record<string, unknown>[])
              const balance = Number(wallet.balance)
              return (
                <div className="mt-4 space-y-3">
                  {segs.length > 0 && (
                    <div className="rounded-xl border bg-muted/40 px-4 py-3 space-y-1.5">
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        {segs.map((s) => {
                          const pct = balance > 0 ? Math.min((Number(s.amount) / balance) * 100, 100) : 0
                          return (
                            <div
                              key={s.id as string}
                              style={{ width: `${pct}%`, backgroundColor: s.color as string }}
                              className="h-full"
                            />
                          )
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {segs.map((s) => (
                          <span key={s.id as string} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color as string }} />
                            {s.name as string}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <WalletActionButton
                      variant="inflow" label="Inflow"
                      onClick={() => { setTxWalletId(wallet.id as string); setTxType("inflow") }}
                    />
                    <WalletActionButton
                      variant="outflow" label="Outflow"
                      onClick={() => { setTxWalletId(wallet.id as string); setTxType("outflow") }}
                    />
                    <WalletActionButton
                      variant="transfer" label="Transfer"
                      onClick={() => setTransferFromId(wallet.id as string)}
                      disabled={(wallets as Record<string, unknown>[]).length < 2}
                      title={(wallets as Record<string, unknown>[]).length < 2 ? "Need at least 2 wallets to transfer" : undefined}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => setSegmentsWalletId(wallet.id as string)}
                    >
                      <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Segments
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      onClick={() => setReconcileWalletId(wallet.id as string)}
                    >
                      <Scale className="h-3.5 w-3.5 mr-1.5" /> Reconcile
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                      onClick={() => { setArchiveWalletId(wallet.id as string); setArchiveConfirmInput("") }}
                    >
                      <Archive className="h-3.5 w-3.5 mr-1.5" /> Archive
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive hover:bg-destructive/10"
                      onClick={() => { setDeleteWalletId(wallet.id as string); setDeleteConfirmInput("") }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                    </Button>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── Desktop: full card grid ── */}
          <div className="hidden md:grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {(wallets as Record<string, unknown>[]).map((wallet) => {
            const Icon = walletIcons[wallet.type as string] || Wallet
            const accent = cardAccent(wallet.name as string)
            const segs = ((wallet.segments ?? []) as Record<string, unknown>[])
            const balance = Number(wallet.balance)
            const txCount = (wallet._count as Record<string, number>)?.transactions || 0

            return (
              <div key={wallet.id as string} className="rounded-2xl overflow-hidden shadow-md flex flex-col h-full">

                {/* ── Card face ────────────────────────────── */}
                <div
                  className="relative flex-1 p-5 text-white overflow-hidden"
                  style={{ background: `linear-gradient(145deg, #0f172a 0%, #1e293b 100%)` }}
                >
                  {/* Subtle colour accent wash */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.18]"
                    style={{ background: `radial-gradient(ellipse at 80% 20%, ${accent.from}, transparent 65%), radial-gradient(ellipse at 20% 85%, ${accent.to}, transparent 60%)` }}
                  />
                  {/* Decorative outline rings */}
                  <CardDecorations name={wallet.name as string} />

                  {/* Top row: name + delete */}
                  <div className="flex items-start justify-between gap-2 relative">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-widest text-white/60">
                        {(WALLET_TYPES.find((t) => t.value === wallet.type) || { label: wallet.type }).label as string}
                      </p>
                      <p className="text-base font-semibold leading-tight mt-0.5">{wallet.name as string}</p>
                    </div>
                    <button
                      onClick={() => { setDeleteWalletId(wallet.id as string); setDeleteConfirmInput("") }}
                      className="rounded-full p-1 text-white/40 hover:text-white/80 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Chip + contactless */}
                  <div className="flex items-center gap-2 mt-4 relative">
                    <div className="h-7 w-9 rounded-md bg-yellow-300/80 flex items-center justify-center">
                      <div className="h-4 w-7 rounded-sm border border-yellow-500/40 grid grid-cols-2 gap-px p-0.5">
                        <div className="bg-yellow-500/50 rounded-[1px]" />
                        <div className="bg-yellow-500/50 rounded-[1px]" />
                        <div className="bg-yellow-500/50 rounded-[1px]" />
                        <div className="bg-yellow-500/50 rounded-[1px]" />
                      </div>
                    </div>
                    <Wifi className="h-4 w-4 text-white/50 rotate-90" />
                  </div>

                  {/* Balance */}
                  <div className="mt-4 relative">
                    <p className="text-[10px] uppercase tracking-widest text-white/50">Balance</p>
                    <p className="text-2xl font-bold tabular-nums tracking-tight mt-0.5">
                      {formatCurrency(balance)}
                    </p>
                  </div>

                  {/* Bottom: bank name + tx count */}
                  <div className="flex items-end justify-between mt-3 relative">
                    <div>
                      {(wallet.bankName as string | undefined) && (
                        <p className="text-[11px] font-medium text-white/70">{wallet.bankName as string}</p>
                      )}
                      <p className="text-[10px] text-white/40">{txCount} transaction{txCount !== 1 ? "s" : ""}</p>
                    </div>
                    <Icon className="h-6 w-6 text-white/30" />
                  </div>
                </div>

                {/* ── Segment bar ──────────────────────────── */}
                {segs.length > 0 && (
                  <div className="bg-muted/60 px-4 py-2.5 space-y-1.5 border-t border-border/50">
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      {segs.map((s) => {
                        const pct = balance > 0 ? Math.min((Number(s.amount) / balance) * 100, 100) : 0
                        return (
                          <div
                            key={s.id as string}
                            style={{ width: `${pct}%`, backgroundColor: s.color as string }}
                            className="h-full"
                            title={`${s.name as string}: ${formatCurrency(Number(s.amount))}`}
                          />
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {segs.map((s) => (
                        <span key={s.id as string} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color as string }} />
                          {s.name as string}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Action buttons ───────────────────────── */}
                <div className="bg-card border border-t-0 border-border rounded-b-2xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <WalletActionButton
                      variant="inflow" label="Inflow"
                      onClick={() => { setTxWalletId(wallet.id as string); setTxType("inflow") }}
                    />
                    <WalletActionButton
                      variant="outflow" label="Outflow"
                      onClick={() => { setTxWalletId(wallet.id as string); setTxType("outflow") }}
                    />
                    <WalletActionButton
                      variant="transfer" label="Transfer"
                      onClick={() => setTransferFromId(wallet.id as string)}
                      disabled={(wallets as Record<string, unknown>[]).length < 2}
                      title={(wallets as Record<string, unknown>[]).length < 2 ? "Need at least 2 wallets to transfer" : undefined}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 min-w-0 text-xs text-muted-foreground h-7 px-1.5"
                      onClick={() => setSegmentsWalletId(wallet.id as string)}
                    >
                      <LayoutGrid className="h-3 w-3 mr-1 shrink-0" />
                      <span className="truncate">Segments</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 min-w-0 text-xs text-amber-600 dark:text-amber-400 h-7 px-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      onClick={() => setReconcileWalletId(wallet.id as string)}
                    >
                      <Scale className="h-3 w-3 mr-1 shrink-0" />
                      <span className="truncate">Reconcile</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 min-w-0 text-xs text-orange-600 dark:text-orange-400 h-7 px-1.5 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                      onClick={() => { setArchiveWalletId(wallet.id as string); setArchiveConfirmInput("") }}
                    >
                      <Archive className="h-3 w-3 mr-1 shrink-0" />
                      <span className="truncate">Archive</span>
                    </Button>
                  </div>
                </div>

              </div>
            )
          })}
          </div>
        </>
      )}
    </div>
  )
}
