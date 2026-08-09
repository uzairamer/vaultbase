"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ChevronLeft, X, Scale } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn, formatCurrency } from "@/lib/utils"
import { useReconcileWallet } from "@/modules/expenses/hooks"
import { txSans, txMono, hexA, cleanAmount, FieldLabel } from "@/modules/expenses/components/wallet-ui-kit"

const NEUTRAL = "#F59E0B"
const UP = "#A3E635"
const DOWN = "#E5544B"

export function ReconcileDialog({
  open, onOpenChange, walletId, walletName, currentBalance,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletId: string | null
  walletName: string
  currentBalance: number
}) {
  const reconcile = useReconcileWallet()
  const [actualBalance, setActualBalance] = useState("")
  const [note, setNote] = useState("")

  function reset() {
    setActualBalance("")
    setNote("")
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) reset()
  }

  const entered = Number(cleanAmount(actualBalance))
  const hasValue = actualBalance !== ""
  const diff = hasValue && !isNaN(entered) ? entered - currentBalance : null
  const accent = diff === null || Math.abs(diff) < 0.01 ? NEUTRAL : diff > 0 ? UP : DOWN
  const valid = hasValue && !isNaN(entered) && !!walletId

  const diffText =
    diff === null ? "Enter the real balance to compare"
      : Math.abs(diff) < 0.01 ? "Already balanced — no adjustment needed"
      : `${diff > 0 ? "+" : ""}${formatCurrency(diff)} ${diff > 0 ? "inflow" : "outflow"} adjustment`

  function handleSubmit() {
    if (!valid || !walletId || reconcile.isPending) return
    reconcile.mutate(
      { walletId, actualBalance: entered, note: note || undefined },
      {
        onSuccess: (res) => {
          handleOpenChange(false)
          if (res.diff === 0) toast.success("Wallet is already balanced — no adjustment needed")
          else toast.success(`Reconciled: ${res.diff > 0 ? "+" : ""}${formatCurrency(res.diff)} adjustment recorded`)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const ctaLabel = reconcile.isPending ? "Reconciling..." : "Confirm Reconciliation"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          txSans.variable, txMono.variable,
          "gap-0 overflow-hidden border-0 bg-[#08090B] p-0 text-[#ECEEF1]",
          "inset-0 top-0 left-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-[460px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px] sm:border sm:border-white/[0.08] sm:bg-[#0B0D10]"
        )}
        style={{ fontFamily: "var(--font-tx-sans)" }}
      >
        <DialogTitle className="sr-only">Reconcile {walletName}</DialogTitle>
        <DialogDescription className="sr-only">Adjust the wallet balance to match reality</DialogDescription>
        <style>{`.tx-amount-input::placeholder { color: var(--tx-accent, #5C636D); opacity: 1; }`}</style>

        {/* MOBILE */}
        <div className="flex h-full flex-col sm:hidden">
          <div className="flex h-[52px] shrink-0 items-center justify-between px-1.5 pl-2">
            <button type="button" onClick={() => handleOpenChange(false)} className="flex min-h-11 min-w-11 items-center gap-0.5 pl-0.5" style={{ color: accent }}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-[16px] font-semibold">Reconcile</div>
            <button type="button" onClick={() => handleOpenChange(false)} className="flex min-h-11 min-w-11 items-center justify-center text-[#8B929C]">
              <X className="h-[19px] w-[19px]" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-4 pt-1.5 pb-1 text-center text-[13px] text-[#8B929C]">{walletName}</div>

            <div className="flex flex-col items-center gap-1.5 px-4 pt-3 pb-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#6E757F]" style={{ fontFamily: "var(--font-tx-mono)" }}>Current Balance</div>
              <div className="font-mono text-[15px] text-[#B9C0C9]" style={{ fontFamily: "var(--font-tx-mono)" }}>{formatCurrency(currentBalance)}</div>
            </div>

            <div className="flex flex-col items-center gap-2 px-4 pt-3 pb-7">
              <div className="flex max-w-full items-baseline gap-2">
                <span className="font-mono text-[24px] font-medium" style={{ color: accent, fontFamily: "var(--font-tx-mono)" }}>Rs</span>
                <input
                  value={actualBalance}
                  onChange={(e) => setActualBalance(cleanAmount(e.target.value))}
                  inputMode="decimal"
                  placeholder="0.00"
                  autoFocus
                  className="tx-amount-input w-[220px] max-w-[60vw] bg-transparent text-[54px] font-semibold tracking-[-0.03em] outline-none"
                  style={{ color: accent, fontFamily: "var(--font-tx-mono)", "--tx-accent": accent } as React.CSSProperties}
                />
              </div>
              <div className="font-mono text-[11.5px]" style={{ color: accent, fontFamily: "var(--font-tx-mono)" }}>{diffText}</div>
            </div>

            <div className="px-4 pb-4">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="min-h-[64px] w-full rounded-[14px] border border-white/[0.08] bg-[#101317] px-4 py-3.5 text-[15.5px] outline-none placeholder:text-[#5C636D]"
              />
            </div>
          </div>

          <div className="shrink-0 px-4 pt-2 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
            <button
              type="button" onClick={handleSubmit} disabled={!valid || reconcile.isPending}
              className="flex min-h-[54px] w-full items-center justify-center rounded-2xl text-[16.5px] font-semibold"
              style={{ background: accent, color: "#0B0D10", opacity: valid ? 1 : 0.45 }}
            >
              {ctaLabel}
            </button>
          </div>
        </div>

        {/* DESKTOP */}
        <div className="hidden sm:flex sm:flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.01em]">
                <Scale className="h-4 w-4" style={{ color: accent }} />
                Reconcile
              </div>
              <div className="text-[13px] text-[#8B929C]">Match {walletName}&rsquo;s balance to reality</div>
            </div>
            <button
              type="button" onClick={() => handleOpenChange(false)}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-white/[0.07] bg-[#15181D] text-[#8B929C]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-5 px-6 py-[22px]">
            <div className="flex items-center justify-between rounded-[11px] border border-white/[0.08] bg-[#101317] px-4 py-3">
              <span className="text-[13px] text-[#8B929C]">Current balance</span>
              <span className="font-mono text-[14px] font-semibold" style={{ fontFamily: "var(--font-tx-mono)" }}>{formatCurrency(currentBalance)}</span>
            </div>

            <div className="flex flex-col gap-2">
              <FieldLabel>Actual Balance</FieldLabel>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[19px] font-medium" style={{ color: accent, fontFamily: "var(--font-tx-mono)" }}>Rs</span>
                <input
                  value={actualBalance}
                  onChange={(e) => setActualBalance(cleanAmount(e.target.value))}
                  inputMode="decimal"
                  placeholder="0"
                  autoFocus
                  className="tx-amount-input min-w-0 flex-1 bg-transparent text-[38px] font-semibold tracking-[-0.03em] outline-none"
                  style={{ color: accent, fontFamily: "var(--font-tx-mono)", "--tx-accent": accent } as React.CSSProperties}
                />
              </div>
              <div className="h-0.5 rounded-full" style={{ background: hexA(accent, 0.32) }} />
              <div className="font-mono text-[11.5px]" style={{ color: accent, fontFamily: "var(--font-tx-mono)" }}>{diffText}</div>
            </div>

            <div className="flex flex-col gap-[9px]">
              <FieldLabel>Note (optional)</FieldLabel>
              <input
                value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Monthly bank statement check"
                className="w-full rounded-[11px] border border-white/[0.08] bg-[#101317] px-[13px] py-[11px] text-[14.5px] outline-none placeholder:text-[#5C636D]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-white/[0.06] bg-[#0A0C0F] px-6 py-4">
            <button type="button" onClick={() => handleOpenChange(false)} className="rounded-[11px] border border-white/[0.08] bg-[#15181D] px-[18px] py-[11px] text-[14px] text-[#B9C0C9]">
              Cancel
            </button>
            <button
              type="button" onClick={handleSubmit} disabled={!valid || reconcile.isPending}
              className="rounded-[11px] px-[22px] py-[11px] text-[14.5px] font-semibold"
              style={{ background: accent, color: "#0B0D10", opacity: valid ? 1 : 0.45 }}
            >
              {ctaLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
