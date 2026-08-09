"use client"

import { useState } from "react"
import { format, subDays, startOfMonth } from "date-fns"
import { toast } from "sonner"
import { ChevronLeft, X, ChevronRight, Wallet as WalletIcon, CalendarDays, ArrowLeftRight } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet"
import { cn, formatCompact } from "@/lib/utils"
import { useWallets, useTransfer } from "@/modules/expenses/hooks"
import {
  txSans, txMono, hexA, cleanAmount, groupAmount, openDatePicker,
  FieldLabel, IconTile, walletColor,
} from "@/modules/expenses/components/wallet-ui-kit"

const ACCENT = "#60A5FA"

interface WalletData {
  id: string
  name: string
  balance: number | string
}

type SheetKind = null | "to" | "date"

export function TransferDialog({
  open, onOpenChange, fromWalletId,
}: { open: boolean; onOpenChange: (open: boolean) => void; fromWalletId: string | null }) {
  const { data: wallets = [] } = useWallets()
  const transfer = useTransfer()
  const walletList = wallets as WalletData[]

  const [toWalletId, setToWalletId] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sheet, setSheet] = useState<SheetKind>(null)

  function reset() {
    setToWalletId("")
    setAmount("")
    setDescription("")
    setDate(new Date().toISOString().slice(0, 10))
    setSheet(null)
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) reset()
  }

  const fromWallet = walletList.find((w) => w.id === fromWalletId)
  const toWallet = walletList.find((w) => w.id === toWalletId)
  const destinations = walletList.filter((w) => w.id !== fromWalletId)
  const numericAmount = Number(cleanAmount(amount) || 0)
  const valid = numericAmount > 0 && !!toWalletId && !!fromWalletId

  const todayISO = new Date().toISOString().slice(0, 10)
  const yesterdayISO = format(subDays(new Date(), 1), "yyyy-MM-dd")
  const monthStartISO = format(startOfMonth(new Date()), "yyyy-MM-dd")
  const dateLabel =
    date === todayISO ? "Today" : date === yesterdayISO ? "Yesterday" : format(new Date(`${date}T00:00:00`), "MMM d")

  const amountHint = numericAmount > 0 ? "Moved between wallets" : "Enter an amount to continue"
  const summaryText = numericAmount > 0 && toWallet
    ? `${fromWallet?.name ?? "—"} → ${toWallet.name} · Rs ${groupAmount(amount)}`
    : `${fromWallet?.name ?? "—"} → ${toWallet ? toWallet.name : "select destination"}`

  function handleSubmit() {
    if (!valid || transfer.isPending) return
    transfer.mutate(
      { fromWalletId, toWalletId, amount: numericAmount, description: description || undefined, date },
      {
        onSuccess: () => { handleOpenChange(false); toast.success("Transfer completed") },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const ctaLabel = transfer.isPending ? "Transferring..." : "Transfer"

  type Chip = { key: string; icon: typeof WalletIcon; iconColor: string; rowLabel: string; label: string; muted: boolean; onTap: (() => void) | null }
  const chips: Chip[] = [
    { key: "from", icon: WalletIcon, iconColor: fromWallet ? walletColor(fromWallet.name) : "#5C636D", rowLabel: "From", label: fromWallet?.name ?? "—", muted: false, onTap: null },
    { key: "to", icon: WalletIcon, iconColor: toWallet ? walletColor(toWallet.name) : "#5C636D", rowLabel: "To", label: toWallet ? toWallet.name : "Select", muted: !toWallet, onTap: () => setSheet("to") },
    { key: "date", icon: CalendarDays, iconColor: "#8B929C", rowLabel: "Date", label: dateLabel, muted: false, onTap: () => setSheet("date") },
  ]

  const sheetTitle = sheet === "to" ? "Destination Wallet" : "Date"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          txSans.variable, txMono.variable,
          "gap-0 overflow-hidden border-0 bg-[#08090B] p-0 text-[#ECEEF1]",
          "inset-0 top-0 left-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px] sm:border sm:border-white/[0.08] sm:bg-[#0B0D10]"
        )}
        style={{ fontFamily: "var(--font-tx-sans)" }}
      >
        <DialogTitle className="sr-only">Transfer Between Wallets</DialogTitle>
        <DialogDescription className="sr-only">Move money from one wallet to another</DialogDescription>
        <style>{`.tx-amount-input::placeholder { color: var(--tx-accent, #5C636D); opacity: 1; }`}</style>

        {/* MOBILE */}
        <div className="flex h-full flex-col sm:hidden">
          <div className="flex h-[52px] shrink-0 items-center justify-between px-1.5 pl-2">
            <button type="button" onClick={() => handleOpenChange(false)} className="flex min-h-11 min-w-11 items-center gap-0.5 pl-0.5" style={{ color: ACCENT }}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-[16px] font-semibold">Transfer</div>
            <button type="button" onClick={() => handleOpenChange(false)} className="flex min-h-11 min-w-11 items-center justify-center text-[#8B929C]">
              <X className="h-[19px] w-[19px]" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-10">
              <div className="flex max-w-full items-baseline gap-2">
                <span className="font-mono text-[24px] font-medium" style={{ color: ACCENT, fontFamily: "var(--font-tx-mono)" }}>Rs</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(cleanAmount(e.target.value))}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="tx-amount-input w-[220px] max-w-[60vw] bg-transparent text-[54px] font-semibold tracking-[-0.03em] outline-none"
                  style={{ color: ACCENT, fontFamily: "var(--font-tx-mono)", "--tx-accent": ACCENT } as React.CSSProperties}
                />
              </div>
              <div className="font-mono text-[11.5px] text-[#6E757F]" style={{ fontFamily: "var(--font-tx-mono)" }}>{amountHint}</div>
            </div>

            <div className="px-4 pb-4">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="min-h-[64px] w-full rounded-[14px] border border-white/[0.08] bg-[#101317] px-4 py-3.5 text-[15.5px] outline-none placeholder:text-[#5C636D]"
              />
            </div>

            <div className="px-4 pb-7">
              <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101317]">
                {chips.map((c, i) => {
                  const rowClass = "flex min-h-14 items-center gap-3 px-4 py-2.5 w-full text-left"
                  const rowStyle = { borderBottom: i < chips.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }
                  const content = (
                    <>
                      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: hexA(c.iconColor, 0.16) }}>
                        <c.icon className="h-4 w-4" style={{ color: c.iconColor }} />
                      </span>
                      <span className="flex-1 text-left text-[15px] text-[#B9C0C9]">{c.rowLabel}</span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="max-w-[150px] truncate text-[15px] font-medium" style={{ color: c.muted ? "#8B929C" : "#ECEEF1" }}>{c.label}</span>
                        {c.onTap && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#4E555F]" />}
                      </span>
                    </>
                  )
                  return c.onTap ? (
                    <button key={c.key} type="button" onClick={c.onTap} className={rowClass} style={rowStyle}>{content}</button>
                  ) : (
                    <div key={c.key} className={rowClass} style={rowStyle}>{content}</div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="shrink-0 px-4 pt-2 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
            <button
              type="button" onClick={handleSubmit} disabled={!valid || transfer.isPending}
              className="flex min-h-[54px] w-full items-center justify-center rounded-2xl text-[16.5px] font-semibold"
              style={{ background: ACCENT, color: "#0B0D10", opacity: valid ? 1 : 0.45 }}
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
                <ArrowLeftRight className="h-4 w-4" style={{ color: ACCENT }} />
                Transfer
              </div>
              <div className="text-[13px] text-[#8B929C]">Move money between your wallets</div>
            </div>
            <button
              type="button" onClick={() => handleOpenChange(false)}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-white/[0.07] bg-[#15181D] text-[#8B929C]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-5 px-6 py-[22px]">
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[19px] font-medium" style={{ color: ACCENT, fontFamily: "var(--font-tx-mono)" }}>Rs</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(cleanAmount(e.target.value))}
                  inputMode="decimal"
                  placeholder="0"
                  className="tx-amount-input w-[220px] bg-transparent text-center text-[38px] font-semibold tracking-[-0.03em] outline-none"
                  style={{ color: ACCENT, fontFamily: "var(--font-tx-mono)", "--tx-accent": ACCENT } as React.CSSProperties}
                />
              </div>
              <div className="font-mono text-[11.5px] text-[#6E757F]" style={{ fontFamily: "var(--font-tx-mono)" }}>{amountHint}</div>
            </div>

            <div className="flex flex-col gap-[9px]">
              <FieldLabel>From</FieldLabel>
              <div className="flex items-center gap-2 rounded-full border px-[13px] py-2" style={{ background: "#101317", borderColor: "rgba(255,255,255,0.08)", width: "fit-content" }}>
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: fromWallet ? walletColor(fromWallet.name) : "#5C636D" }} />
                <span className="text-[13px] font-medium text-[#ECEEF1]">{fromWallet?.name ?? "—"}</span>
              </div>
            </div>

            <div className="flex flex-col gap-[9px]">
              <FieldLabel>To</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {destinations.map((w) => {
                  const on = w.id === toWalletId
                  const color = walletColor(w.name)
                  return (
                    <button
                      key={w.id} type="button" onClick={() => setToWalletId(w.id)}
                      className="flex items-center gap-2 rounded-full border px-[13px] py-2"
                      style={{ background: on ? hexA(color, 0.12) : "#101317", borderColor: on ? hexA(color, 0.5) : "rgba(255,255,255,0.08)" }}
                    >
                      <span className="h-[7px] w-[7px] rounded-full" style={{ background: color }} />
                      <span className={cn("text-[13px]", on ? "font-semibold text-[#ECEEF1]" : "font-medium text-[#B9C0C9]")}>{w.name}</span>
                      <span className="font-mono text-[11px] text-[#6E757F]" style={{ fontFamily: "var(--font-tx-mono)" }}>{formatCompact(Number(w.balance))}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-[9px]">
              <FieldLabel>Description</FieldLabel>
              <input
                value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Moving savings"
                className="w-full rounded-[11px] border border-white/[0.08] bg-[#101317] px-[13px] py-[11px] text-[14.5px] outline-none placeholder:text-[#5C636D]"
              />
            </div>

            <div className="flex flex-col gap-[9px]">
              <FieldLabel>Date</FieldLabel>
              <input
                type="date" value={date} onChange={(e) => setDate(e.target.value)} onClick={openDatePicker}
                className="w-full cursor-pointer rounded-[11px] border border-white/[0.08] bg-[#101317] px-[13px] py-[11px] font-mono text-[14px] outline-none"
                style={{ colorScheme: "dark", fontFamily: "var(--font-tx-mono)" }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-[#0A0C0F] px-6 py-4">
            <div className="font-mono text-[12px] text-[#6E757F]" style={{ fontFamily: "var(--font-tx-mono)" }}>{summaryText}</div>
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => handleOpenChange(false)} className="rounded-[11px] border border-white/[0.08] bg-[#15181D] px-[18px] py-[11px] text-[14px] text-[#B9C0C9]">
                Cancel
              </button>
              <button
                type="button" onClick={handleSubmit} disabled={!valid || transfer.isPending}
                className="rounded-[11px] px-[22px] py-[11px] text-[14.5px] font-semibold"
                style={{ background: ACCENT, color: "#0B0D10", opacity: valid ? 1 : 0.45 }}
              >
                {ctaLabel}
              </button>
            </div>
          </div>
        </div>

        {/* MOBILE BOTTOM SHEET */}
        <Sheet open={sheet !== null} onOpenChange={(o) => { if (!o) setSheet(null) }}>
          <SheetContent
            side="bottom" showCloseButton={false}
            className={cn(txSans.variable, txMono.variable, "max-h-[70vh] gap-0 rounded-t-[20px] border border-b-0 border-white/[0.09] bg-[#111418] p-0 sm:hidden")}
            style={{ fontFamily: "var(--font-tx-sans)" }}
          >
            <div className="flex shrink-0 justify-center pt-2.5 pb-1">
              <div className="h-1 w-9 rounded-full bg-white/[0.18]" />
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 px-[18px] pt-1.5 pb-3.5">
              <SheetTitle className="text-[16px] font-semibold text-[#ECEEF1]">{sheetTitle}</SheetTitle>
              <SheetClose className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1B1F25] text-[#8B929C]">
                <X className="h-3.5 w-3.5" />
              </SheetClose>
            </div>
            <SheetDescription className="sr-only">Choose a {sheetTitle.toLowerCase()}</SheetDescription>

            {sheet === "to" && (
              <div className="overflow-y-auto px-[18px] pb-5">
                <div className="grid grid-cols-3 gap-2.5">
                  {destinations.map((w) => (
                    <IconTile
                      key={w.id} icon={WalletIcon} label={w.name} meta={formatCompact(Number(w.balance))} color={walletColor(w.name)}
                      active={w.id === toWalletId} onClick={() => { setToWalletId(w.id); setSheet(null) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {sheet === "date" && (
              <div className="flex flex-col gap-3 px-[18px] pb-6">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "today", name: "Today", value: todayISO },
                    { key: "yesterday", name: "Yesterday", value: yesterdayISO },
                    { key: "monthstart", name: format(startOfMonth(new Date()), "MMM d"), value: monthStartISO },
                  ].map((d) => (
                    <button
                      key={d.key} type="button" onClick={() => { setDate(d.value); setSheet(null) }}
                      className="flex min-h-[42px] items-center rounded-full border px-[15px] text-[13.5px]"
                      style={{
                        background: date === d.value ? hexA(ACCENT, 0.13) : "#101317",
                        borderColor: date === d.value ? hexA(ACCENT, 0.5) : "rgba(255,255,255,0.08)",
                      }}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
                <input
                  type="date" value={date} onChange={(e) => { setDate(e.target.value); setSheet(null) }} onClick={openDatePicker}
                  className="w-full cursor-pointer rounded-[13px] border border-white/[0.08] bg-[#0B0D10] px-3.5 py-3 font-mono text-[14px] outline-none"
                  style={{ colorScheme: "dark", fontFamily: "var(--font-tx-mono)" }}
                />
              </div>
            )}
          </SheetContent>
        </Sheet>
      </DialogContent>
    </Dialog>
  )
}
