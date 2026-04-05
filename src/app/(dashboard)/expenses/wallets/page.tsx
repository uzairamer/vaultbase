"use client"

import { useState } from "react"
import { useWallets, useCreateWallet, useDeleteWallet, useCreateTransaction, useTransfer, useCategories, useReceivables, useLiabilities, useReconcileWallet } from "@/modules/expenses/hooks"
import { WalletSegmentsDialog } from "@/modules/expenses/components/wallet-segments-dialog"
import type { Segment } from "@/modules/expenses/components/wallet-segments-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { Plus, Wallet, Trash2, Building, Banknote, Smartphone, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, LayoutGrid, Scale, Wifi } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { WALLET_TYPES, INFLOW_SUBTYPES, OUTFLOW_SUBTYPES } from "@/lib/constants"
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
  const { data: categories = [] } = useCategories()
  const { data: receivables = [] } = useReceivables()
  const { data: liabilities = [] } = useLiabilities()
  const createWallet = useCreateWallet()
  const deleteWallet = useDeleteWallet()
  const createTx = useCreateTransaction()
  const transfer = useTransfer()
  const reconcile = useReconcileWallet()
  const [open, setOpen] = useState(false)

  // Reconcile dialog state
  const [reconcileWalletId, setReconcileWalletId] = useState<string | null>(null)
  const [actualBalance, setActualBalance] = useState("")
  const [reconcileNote, setReconcileNote] = useState("")

  // Transaction dialog state
  const [txWalletId, setTxWalletId] = useState<string | null>(null)
  const [txType, setTxType] = useState<"inflow" | "outflow" | null>(null)
  const [txSubType, setTxSubType] = useState("")

  // Transfer dialog state
  const [transferFromId, setTransferFromId] = useState<string | null>(null)

  // Segments dialog state
  const [segmentsWalletId, setSegmentsWalletId] = useState<string | null>(null)

  // Delete confirmation state
  const [deleteWalletId, setDeleteWalletId] = useState<string | null>(null)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("")

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

  function handleTxSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload: Record<string, unknown> = {
      walletId: txWalletId,
      categoryId: (fd.get("categoryId") as string) || undefined,
      type: txType,
      subType: txSubType || undefined,
      amount: Number(fd.get("amount")),
      description: fd.get("description") as string,
      date: fd.get("date") as string,
    }
    if (txSubType === "lending") payload.personName = fd.get("personName") as string
    if (txSubType === "receivable_collection") payload.receivableId = fd.get("receivableId") as string
    if (txSubType === "debt_repayment") payload.liabilityId = fd.get("liabilityId") as string

    createTx.mutate(payload, {
      onSuccess: () => {
        closeTxDialog()
        toast.success(
          txSubType === "lending"
            ? "Transaction added & receivable created"
            : txSubType === "receivable_collection"
            ? "Transaction added & receivable updated"
            : txSubType === "debt_repayment"
            ? "Transaction added & liability updated"
            : "Transaction added"
        )
      },
      onError: (err) => toast.error(err.message),
    })
  }

  function closeTxDialog() {
    setTxWalletId(null)
    setTxType(null)
    setTxSubType("")
  }

  function handleTransferSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    transfer.mutate(
      {
        fromWalletId: transferFromId,
        toWalletId: fd.get("toWalletId") as string,
        amount: Number(fd.get("amount")),
        description: (fd.get("description") as string) || undefined,
        date: fd.get("date") as string,
      },
      {
        onSuccess: () => { setTransferFromId(null); toast.success("Transfer completed") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  function closeReconcileDialog() {
    setReconcileWalletId(null)
    setActualBalance("")
    setReconcileNote("")
  }

  function handleReconcile(e: React.FormEvent) {
    e.preventDefault()
    if (!reconcileWalletId) return
    reconcile.mutate(
      { walletId: reconcileWalletId, actualBalance: Number(actualBalance), note: reconcileNote || undefined },
      {
        onSuccess: (res) => {
          closeReconcileDialog()
          if (res.diff === 0) {
            toast.success("Wallet is already balanced — no adjustment needed")
          } else {
            const sign = res.diff > 0 ? "+" : ""
            toast.success(`Reconciled: ${sign}${formatCurrency(res.diff)} adjustment recorded`)
          }
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const txWallet = (wallets as Record<string, unknown>[]).find((w) => w.id === txWalletId)
  const subtypes = txType === "inflow" ? INFLOW_SUBTYPES : txType === "outflow" ? OUTFLOW_SUBTYPES : []

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

      {/* Transaction Dialog */}
      <Dialog open={!!txWalletId} onOpenChange={(isOpen) => { if (!isOpen) closeTxDialog() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Add Transaction — {txWallet ? (txWallet.name as string) : ""}
            </DialogTitle>
          </DialogHeader>

          {!txType ? (
            <div className="grid grid-cols-2 gap-4 py-4">
              <button
                onClick={() => setTxType("inflow")}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 transition-colors hover:border-green-500 hover:bg-green-500/5"
              >
                <ArrowDownLeft className="h-10 w-10 text-green-500" />
                <div className="text-center">
                  <p className="font-semibold text-lg">Inflow</p>
                  <p className="text-xs text-muted-foreground mt-1">Money coming in</p>
                </div>
              </button>
              <button
                onClick={() => setTxType("outflow")}
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 transition-colors hover:border-red-500 hover:bg-red-500/5"
              >
                <ArrowUpRight className="h-10 w-10 text-red-500" />
                <div className="text-center">
                  <p className="font-semibold text-lg">Outflow</p>
                  <p className="text-xs text-muted-foreground mt-1">Money going out</p>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleTxSubmit} className="space-y-4">
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setTxType(null); setTxSubType("") }}>
                  &larr; Back
                </Button>
                <Badge variant={txType === "inflow" ? "default" : "destructive"} className="gap-1">
                  {txType === "inflow" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  {txType === "inflow" ? "Inflow" : "Outflow"}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>{txType === "inflow" ? "Inflow Type" : "Outflow Type"}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {subtypes.map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => setTxSubType(st.value)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        txSubType === st.value
                          ? txType === "inflow"
                            ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400"
                            : "border-red-500 bg-red-500/10 text-red-700 dark:text-red-400"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Amount</Label>
                <Input name="amount" type="number" step="0.01" min="0" required />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input name="description" placeholder="What was this for?" />
              </div>

              {txSubType === "lending" && (
                <div className="space-y-2">
                  <Label>Person Name <span className="text-xs text-muted-foreground">(a receivable will be created)</span></Label>
                  <Input name="personName" placeholder="Who are you lending to?" required />
                </div>
              )}

              {txSubType === "receivable_collection" && (receivables as Record<string, unknown>[]).filter((r) => r.status !== "settled").length > 0 && (
                <div className="space-y-2">
                  <Label>Link to Receivable <span className="text-xs text-muted-foreground">(auto-updates payment)</span></Label>
                  <Select name="receivableId">
                    <SelectTrigger><SelectValue placeholder="Select receivable (optional)" /></SelectTrigger>
                    <SelectContent>
                      {(receivables as Record<string, unknown>[]).filter((r) => r.status !== "settled").map((r) => (
                        <SelectItem key={r.id as string} value={r.id as string}>
                          {r.personName as string} — {formatCurrency(Number(r.amount) - Number(r.amountPaid))} remaining
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {txSubType === "debt_repayment" && (liabilities as Record<string, unknown>[]).filter((l) => l.status !== "settled").length > 0 && (
                <div className="space-y-2">
                  <Label>Link to Liability <span className="text-xs text-muted-foreground">(auto-updates payment)</span></Label>
                  <Select name="liabilityId">
                    <SelectTrigger><SelectValue placeholder="Select liability (optional)" /></SelectTrigger>
                    <SelectContent>
                      {(liabilities as Record<string, unknown>[]).filter((l) => l.status !== "settled").map((l) => (
                        <SelectItem key={l.id as string} value={l.id as string}>
                          {l.personName as string} — {formatCurrency(Number(l.amount) - Number(l.amountPaid))} remaining
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
                </div>
                <div className="space-y-2">
                  <Label>Tag (optional)</Label>
                  <Select name="categoryId">
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {(categories as Record<string, string>[]).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createTx.isPending}
                variant={txType === "inflow" ? "default" : "destructive"}
              >
                {createTx.isPending ? "Adding..." : `Add ${txType === "inflow" ? "Inflow" : "Outflow"}`}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={!!transferFromId} onOpenChange={(isOpen) => { if (!isOpen) setTransferFromId(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Transfer Between Wallets
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>From</Label>
              <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium">
                {(wallets as Record<string, unknown>[]).find((w) => w.id === transferFromId)?.name as string ?? "—"}
              </div>
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Select name="toWalletId" required>
                <SelectTrigger><SelectValue placeholder="Select destination wallet" /></SelectTrigger>
                <SelectContent>
                  {(wallets as Record<string, unknown>[])
                    .filter((w) => w.id !== transferFromId)
                    .map((w) => (
                      <SelectItem key={w.id as string} value={w.id as string}>
                        {w.name as string} — {formatCurrency(Number(w.balance))}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input name="description" placeholder="e.g. Moving savings" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
            </div>
            <Button type="submit" className="w-full" disabled={transfer.isPending}>
              {transfer.isPending ? "Transferring..." : "Transfer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reconcile Dialog */}
      {(() => {
        const rw = (wallets as Record<string, unknown>[]).find((w) => w.id === reconcileWalletId)
        const stored = rw ? Number(rw.balance) : 0
        const entered = Number(actualBalance)
        const diff = actualBalance !== "" && !isNaN(entered) ? entered - stored : null
        return (
          <Dialog open={!!reconcileWalletId} onOpenChange={(isOpen) => { if (!isOpen) closeReconcileDialog() }}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Reconcile — {rw?.name as string}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleReconcile} className="space-y-4">
                {/* Current balance display */}
                <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current balance</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(stored)}</span>
                </div>

                <div className="space-y-2">
                  <Label>Actual balance <span className="text-xs text-muted-foreground">(from bank / cash count)</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={actualBalance}
                    onChange={(e) => setActualBalance(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {/* Live diff preview */}
                {diff !== null && (
                  <div className={`rounded-lg px-4 py-3 flex items-center justify-between text-sm ${
                    Math.abs(diff) < 0.01
                      ? "bg-muted/50"
                      : diff > 0
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}>
                    <span className="text-muted-foreground">
                      {Math.abs(diff) < 0.01 ? "No adjustment needed" : diff > 0 ? "Inflow adjustment" : "Outflow adjustment"}
                    </span>
                    <span className={`font-bold tabular-nums ${
                      Math.abs(diff) < 0.01 ? "" : diff > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}>
                      {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Note <span className="text-xs text-muted-foreground">(optional)</span></Label>
                  <Input
                    placeholder="e.g. Monthly bank statement check"
                    value={reconcileNote}
                    onChange={(e) => setReconcileNote(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={reconcile.isPending || actualBalance === ""}
                >
                  {reconcile.isPending ? "Reconciling..." : "Confirm Reconciliation"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-900 dark:hover:bg-green-950"
                      onClick={() => { setTxWalletId(wallet.id as string); setTxType("inflow") }}
                    >
                      <ArrowDownLeft className="h-3.5 w-3.5 mr-1" /> Inflow
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
                      onClick={() => { setTxWalletId(wallet.id as string); setTxType("outflow") }}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Outflow
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-900 dark:hover:bg-blue-950"
                      onClick={() => setTransferFromId(wallet.id as string)}
                      disabled={(wallets as Record<string, unknown>[]).length < 2}
                      title={(wallets as Record<string, unknown>[]).length < 2 ? "Need at least 2 wallets to transfer" : undefined}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Transfer
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 text-xs text-muted-foreground h-7"
                      onClick={() => setSegmentsWalletId(wallet.id as string)}
                    >
                      <LayoutGrid className="h-3 w-3 mr-1.5" />
                      Manage Segments
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 text-xs text-amber-600 dark:text-amber-400 h-7 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      onClick={() => {
                        setReconcileWalletId(wallet.id as string)
                        setActualBalance(String(balance))
                      }}
                    >
                      <Scale className="h-3 w-3 mr-1.5" />
                      Reconcile
                    </Button>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
