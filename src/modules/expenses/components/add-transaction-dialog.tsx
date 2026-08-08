"use client"

import { useState, useRef } from "react"
import { Instrument_Sans, JetBrains_Mono } from "next/font/google"
import { format, subDays, startOfMonth } from "date-fns"
import { toast } from "sonner"
import {
  ChevronLeft, X, Check, ChevronRight, Wallet as WalletIcon, CalendarDays, Tag as TagIcon, Layers, Users,
  Briefcase, TrendingUp, Undo2, LineChart, Gift, Receipt, ShoppingCart, HandCoins, Landmark, PiggyBank,
  type LucideIcon,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet"
import { cn, formatCurrency, formatCompact } from "@/lib/utils"
import { useWallets, useCategories, useReceivables, useLiabilities, useCreateTransaction } from "@/modules/expenses/hooks"
import { INFLOW_SUBTYPES, OUTFLOW_SUBTYPES } from "@/lib/constants"

const txSans = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-tx-sans" })
const txMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-tx-mono" })

interface WalletSegmentData {
  id: string
  name: string
  amount: number | string
  color?: string
}
interface WalletData {
  id: string
  name: string
  balance: number | string
  segments?: WalletSegmentData[]
}
interface CategoryData {
  id: string
  name: string
  color?: string | null
}
interface LinkableData {
  id: string
  personName: string
  amount: number | string
  amountPaid: number | string
  status: string
}

const SUBTYPE_ICONS: Record<string, LucideIcon> = {
  earned_income: Briefcase,
  passive_income: TrendingUp,
  receivable_collection: Undo2,
  stock_sale: LineChart,
  other_inflow: Gift,
  fixed_expense: Receipt,
  variable_expense: ShoppingCart,
  lending: HandCoins,
  debt_repayment: Landmark,
  savings_investment: PiggyBank,
  stock_purchase: LineChart,
}

const WALLET_COLORS = ["#818CF8", "#38BDF8", "#34D399", "#FBBF24", "#F472B6", "#94A3B8"]
function walletColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return WALLET_COLORS[Math.abs(hash) % WALLET_COLORS.length]
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "")
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`
}

const LAST_WALLET_KEY = "vaultbase:lastWalletId"
function getLastWalletId(): string {
  if (typeof window === "undefined") return ""
  try {
    return window.localStorage.getItem(LAST_WALLET_KEY) ?? ""
  } catch {
    return ""
  }
}
function setLastWalletId(id: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LAST_WALLET_KEY, id)
  } catch {
    // ignore
  }
}

function openDatePicker(e: React.MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget
  if (typeof el.showPicker === "function") el.showPicker()
}

function cleanAmount(v: string) {
  return (v || "").replace(/[^0-9.]/g, "")
}
function groupAmount(v: string) {
  const s = cleanAmount(v)
  if (!s) return ""
  const [intPart, dec] = s.split(".")
  const grouped = Number(intPart || 0).toLocaleString("en-US")
  return dec !== undefined ? `${grouped}.${dec.slice(0, 2)}` : grouped
}

const chevronBg: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,transparent 50%,#7A818B 50%),linear-gradient(135deg,#7A818B 50%,transparent 50%)",
  backgroundPosition: "calc(100% - 17px) 50%, calc(100% - 12px) 50%",
  backgroundSize: "5px 5px, 5px 5px",
  backgroundRepeat: "no-repeat",
}
const selectClass =
  "w-full box-border rounded-[11px] bg-[#101317] border border-white/[0.08] px-[13px] py-[11px] text-[14.5px] cursor-pointer appearance-none"
const optionStyle: React.CSSProperties = { background: "#15181D" }

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#6E757F]">{children}</div>
  )
}

function IconTile({
  icon: Icon, label, meta, color, active, onClick,
}: { icon: LucideIcon; label: string; meta?: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[96px] flex-col items-center gap-[9px] rounded-[14px] border px-2 pt-3.5 pb-3 text-center"
      style={{
        background: active ? hexA(color, 0.13) : "#0B0D10",
        borderColor: active ? hexA(color, 0.55) : "rgba(255,255,255,0.07)",
      }}
    >
      <span
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px]"
        style={{ background: active ? color : hexA(color, 0.15) }}
      >
        <Icon className="h-[19px] w-[19px]" style={{ color: active ? "#0B0D10" : color }} />
      </span>
      <span className={cn("text-[12.5px] leading-[1.25]", active ? "font-semibold text-[#ECEEF1]" : "font-medium text-[#B9C0C9]")}>
        {label}
      </span>
      {meta ? <span className="font-mono text-[10.5px] text-[#6E757F]">{meta}</span> : null}
    </button>
  )
}

function SimpleListRow({
  icon: Icon, label, meta, color, active, onClick,
}: { icon: LucideIcon; label: string; meta?: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left"
      style={{
        background: active ? hexA(color, 0.12) : "#0B0D10",
        borderColor: active ? hexA(color, 0.5) : "rgba(255,255,255,0.08)",
      }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: hexA(color, 0.16) }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[14.5px]", active ? "font-semibold text-[#ECEEF1]" : "font-medium text-[#B9C0C9]")}>
          {label}
        </span>
        {meta ? <span className="block font-mono text-[11.5px] text-[#6E757F]">{meta}</span> : null}
      </span>
      {active ? <Check className="h-4 w-4 shrink-0" style={{ color }} /> : null}
    </button>
  )
}

type SheetKind = null | "type" | "wallet" | "segment" | "date" | "tag" | "receivable" | "liability"

export function AddTransactionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: wallets = [] } = useWallets()
  const { data: categories = [] } = useCategories()
  const { data: receivables = [] } = useReceivables()
  const { data: liabilities = [] } = useLiabilities()
  const createTx = useCreateTransaction()

  const walletList = wallets as WalletData[]
  const categoryList = categories as CategoryData[]
  const unsettledReceivables = (receivables as LinkableData[]).filter((r) => r.status !== "settled")
  const unsettledLiabilities = (liabilities as LinkableData[]).filter((l) => l.status !== "settled")

  const [type, setType] = useState<"inflow" | "outflow">("outflow")
  const [subType, setSubType] = useState<string>(OUTFLOW_SUBTYPES[0].value)
  const [walletId, setWalletId] = useState("")
  const [segmentId, setSegmentId] = useState("")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [categoryId, setCategoryId] = useState("")
  const [personName, setPersonName] = useState("")
  const [receivableId, setReceivableId] = useState("")
  const [liabilityId, setLiabilityId] = useState("")
  const [sheet, setSheet] = useState<SheetKind>(null)

  const amountMobileRef = useRef<HTMLInputElement>(null)
  const amountDesktopRef = useRef<HTMLInputElement>(null)
  const descriptionMobileRef = useRef<HTMLInputElement>(null)

  const effectiveWalletId =
    walletId || walletList.find((w) => w.id === getLastWalletId())?.id || walletList[0]?.id || ""

  function reset() {
    setType("outflow")
    setSubType(OUTFLOW_SUBTYPES[0].value)
    setWalletId("")
    setSegmentId("")
    setAmount("")
    setDescription("")
    setDate(new Date().toISOString().slice(0, 10))
    setCategoryId("")
    setPersonName("")
    setReceivableId("")
    setLiabilityId("")
    setSheet(null)
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) reset()
  }

  function switchType(next: "inflow" | "outflow") {
    setType(next)
    setSubType((next === "inflow" ? INFLOW_SUBTYPES : OUTFLOW_SUBTYPES)[0].value)
    setPersonName("")
    setReceivableId("")
    setLiabilityId("")
  }

  const activeSubtypes = type === "inflow" ? INFLOW_SUBTYPES : OUTFLOW_SUBTYPES
  const activeSubtypeObj = activeSubtypes.find((s) => s.value === subType) ?? activeSubtypes[0]
  const accent = type === "outflow" ? "#E5544B" : "#A3E635"

  const numericAmount = Number(cleanAmount(amount) || 0)
  const selectedWallet = walletList.find((w) => w.id === effectiveWalletId)
  const walletSegments = selectedWallet?.segments ?? []
  const selectedCategory = categoryList.find((c) => c.id === categoryId)
  const selectedReceivable = unsettledReceivables.find((r) => r.id === receivableId)
  const selectedLiability = unsettledLiabilities.find((l) => l.id === liabilityId)

  const personNameValid = subType !== "lending" || personName.trim().length > 0
  const descriptionValid = description.trim().length > 0
  const valid = numericAmount > 0 && !!effectiveWalletId && personNameValid && descriptionValid

  const todayISO = new Date().toISOString().slice(0, 10)
  const yesterdayISO = format(subDays(new Date(), 1), "yyyy-MM-dd")
  const monthStartISO = format(startOfMonth(new Date()), "yyyy-MM-dd")
  const dateLabel =
    date === todayISO ? "Today" : date === yesterdayISO ? "Yesterday" : format(new Date(`${date}T00:00:00`), "MMM d")

  const amountHint =
    numericAmount > 0
      ? (type === "outflow" ? "Deducted from " : "Added to ") + (selectedWallet ? selectedWallet.name : "wallet")
      : "Enter an amount to continue"

  const summaryText =
    numericAmount > 0
      ? `${activeSubtypeObj.label} · ${selectedWallet ? selectedWallet.name : "—"} · ${type === "outflow" ? "−" : "+"}Rs ${groupAmount(amount)}`
      : `${activeSubtypeObj.label} · ${selectedWallet ? selectedWallet.name : "no wallet selected"}`

  function handleSubmit() {
    if (!valid || createTx.isPending) return
    const payload: Record<string, unknown> = {
      walletId: effectiveWalletId,
      categoryId: categoryId || undefined,
      type,
      subType: subType || undefined,
      amount: numericAmount,
      description,
      date,
      segmentId: segmentId || undefined,
    }
    if (subType === "lending") payload.personName = personName
    if (subType === "receivable_collection") payload.receivableId = receivableId || undefined
    if (subType === "debt_repayment") payload.liabilityId = liabilityId || undefined

    createTx.mutate(payload, {
      onSuccess: () => {
        setLastWalletId(effectiveWalletId)
        handleOpenChange(false)
        toast.success(
          subType === "lending" ? "Transaction added & receivable created"
            : subType === "receivable_collection" ? "Transaction added & receivable updated"
            : subType === "debt_repayment" ? "Transaction added & liability updated"
            : "Transaction added"
        )
      },
      onError: (err) => toast.error(err.message),
    })
  }

  type Chip = { key: string; icon: LucideIcon; iconColor: string; rowLabel: string; label: string; muted: boolean; onTap: () => void }
  const chips: Chip[] = [
    {
      key: "type", icon: SUBTYPE_ICONS[activeSubtypeObj.value] ?? TagIcon, iconColor: accent,
      rowLabel: "Transaction Type", label: activeSubtypeObj.label, muted: false, onTap: () => setSheet("type"),
    },
    {
      key: "wallet", icon: WalletIcon, iconColor: selectedWallet ? walletColor(selectedWallet.name) : "#5C636D",
      rowLabel: "Wallet", label: selectedWallet ? selectedWallet.name : "Select", muted: !selectedWallet, onTap: () => setSheet("wallet"),
    },
    ...(walletSegments.length > 0
      ? [{
          key: "segment", icon: Layers, iconColor: "#60A5FA", rowLabel: "Segment",
          label: walletSegments.find((s) => s.id === segmentId)?.name ?? "Whole wallet",
          muted: !segmentId, onTap: () => setSheet("segment"),
        } as Chip]
      : []),
    ...(subType === "receivable_collection" && unsettledReceivables.length > 0
      ? [{
          key: "receivable", icon: Users, iconColor: "#60A5FA", rowLabel: "Link to Receivable",
          label: selectedReceivable ? selectedReceivable.personName : "Optional", muted: !receivableId, onTap: () => setSheet("receivable"),
        } as Chip]
      : []),
    ...(subType === "debt_repayment" && unsettledLiabilities.length > 0
      ? [{
          key: "liability", icon: Landmark, iconColor: "#60A5FA", rowLabel: "Link to Liability",
          label: selectedLiability ? selectedLiability.personName : "Optional", muted: !liabilityId, onTap: () => setSheet("liability"),
        } as Chip]
      : []),
    { key: "date", icon: CalendarDays, iconColor: "#8B929C", rowLabel: "Date", label: dateLabel, muted: false, onTap: () => setSheet("date") },
    {
      key: "tag", icon: TagIcon, iconColor: categoryId ? (selectedCategory?.color ?? "#60A5FA") : "#5C636D",
      rowLabel: "Tag", label: selectedCategory ? selectedCategory.name : "Optional", muted: !categoryId, onTap: () => setSheet("tag"),
    },
  ]

  const sheetTitle =
    sheet === "type" ? (type === "outflow" ? "Outflow Type" : "Inflow Type")
      : sheet === "wallet" ? "Wallet"
      : sheet === "segment" ? "Segment"
      : sheet === "tag" ? "Tag"
      : sheet === "receivable" ? "Link to Receivable"
      : sheet === "liability" ? "Link to Liability"
      : "Date"

  const ctaLabel = createTx.isPending ? "Adding..." : type === "outflow" ? "Add Outflow" : "Add Inflow"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          txSans.variable, txMono.variable,
          "gap-0 overflow-hidden border-0 bg-[#08090B] p-0 text-[#ECEEF1]",
          "inset-0 top-0 left-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none",
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-[780px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px] sm:border sm:border-white/[0.08] sm:bg-[#0B0D10]"
        )}
        style={{ fontFamily: "var(--font-tx-sans)" }}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          const mobileEl = amountMobileRef.current
          const target = mobileEl && mobileEl.offsetParent !== null ? mobileEl : amountDesktopRef.current
          target?.focus()
        }}
      >
        <DialogTitle className="sr-only">Add Transaction</DialogTitle>
        <DialogDescription className="sr-only">Record a new inflow or outflow transaction</DialogDescription>
        <style>{`.tx-amount-input::placeholder { color: var(--tx-accent, #5C636D); opacity: 1; }`}</style>

        {/* MOBILE */}
        <div className="flex h-full flex-col sm:hidden">
          <div className="flex h-[52px] shrink-0 items-center justify-between px-1.5 pl-2">
            <button type="button" onClick={() => handleOpenChange(false)} className="flex min-h-11 min-w-11 items-center gap-0.5 pl-0.5" style={{ color: accent }}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-[16px] font-semibold">Add Transaction</div>
            <button type="button" onClick={() => handleOpenChange(false)} className="flex min-h-11 min-w-11 items-center justify-center text-[#8B929C]">
              <X className="h-[19px] w-[19px]" />
            </button>
          </div>

          <div className="shrink-0 px-4 pt-1.5 pb-[18px]">
            <div className="flex rounded-[11px] border border-white/[0.07] bg-[#15181D] p-[3px]">
              <button
                type="button" onClick={() => switchType("inflow")}
                className="min-h-10 flex-1 rounded-lg text-[14.5px] font-semibold"
                style={{ background: type === "inflow" ? "#2A2F36" : "transparent", color: type === "inflow" ? "#A3E635" : "#8B929C" }}
              >
                IN
              </button>
              <button
                type="button" onClick={() => switchType("outflow")}
                className="min-h-10 flex-1 rounded-lg text-[14.5px] font-semibold"
                style={{ background: type === "outflow" ? "#2A2F36" : "transparent", color: type === "outflow" ? "#E5544B" : "#8B929C" }}
              >
                OUT
              </button>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2 px-4 pt-1 pb-10">
            <div className="flex max-w-full items-baseline gap-2">
              <span className="font-mono text-[24px] font-medium" style={{ color: accent, fontFamily: "var(--font-tx-mono)" }}>Rs</span>
              <input
                ref={amountMobileRef}
                value={amount}
                onChange={(e) => setAmount(cleanAmount(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    descriptionMobileRef.current?.focus()
                  }
                }}
                inputMode="decimal"
                enterKeyHint="next"
                placeholder="0.00"
                className="tx-amount-input w-[220px] max-w-[60vw] bg-transparent text-[54px] font-semibold tracking-[-0.03em] outline-none"
                style={{ color: accent, fontFamily: "var(--font-tx-mono)", "--tx-accent": accent } as React.CSSProperties}
              />
            </div>
            <div className="font-mono text-[11.5px] text-[#6E757F]" style={{ fontFamily: "var(--font-tx-mono)" }}>{amountHint}</div>
          </div>

          <div className="shrink-0 px-4 pb-4">
            <input
              ref={descriptionMobileRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              className="min-h-[64px] w-full rounded-[14px] border border-white/[0.08] bg-[#101317] px-4 py-3.5 text-[15.5px] outline-none placeholder:text-[#5C636D]"
            />
          </div>

          {subType === "lending" && (
            <div className="shrink-0 px-4 pb-4">
              <input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Who are you lending to?"
                className="min-h-[52px] w-full rounded-[14px] border border-white/[0.08] bg-[#101317] px-4 py-3.5 text-[15.5px] outline-none placeholder:text-[#5C636D]"
              />
            </div>
          )}

          <div className="shrink-0 px-4 pb-7">
            <div className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101317]">
              {chips.map((c, i) => (
                <button
                  key={c.key} type="button" onClick={c.onTap}
                  className="flex min-h-14 items-center gap-3 px-4 py-2.5"
                  style={{ borderBottom: i < chips.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}
                >
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px]" style={{ background: hexA(c.iconColor, 0.16) }}>
                    <c.icon className="h-4 w-4" style={{ color: c.iconColor }} />
                  </span>
                  <span className="flex-1 text-left text-[15px] text-[#B9C0C9]">{c.rowLabel}</span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="max-w-[150px] truncate text-[15px] font-medium" style={{ color: c.muted ? "#8B929C" : "#ECEEF1" }}>{c.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#4E555F]" />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1" />

          <div className="shrink-0 px-4 pt-2 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
            <button
              type="button" onClick={handleSubmit} disabled={!valid || createTx.isPending}
              className="flex min-h-[54px] w-full items-center justify-center rounded-2xl text-[16.5px] font-semibold"
              style={{ background: accent, color: type === "outflow" ? "#FFF5F4" : "#0B0D10", opacity: valid ? 1 : 0.45 }}
            >
              {ctaLabel}
            </button>
          </div>
        </div>

        {/* DESKTOP */}
        <div className="hidden sm:flex sm:flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
            <div className="flex flex-col gap-0.5">
              <div className="text-[19px] font-semibold tracking-[-0.01em]">Add Transaction</div>
              <div className="text-[13px] text-[#8B929C]">{type === "outflow" ? "Record money leaving a wallet" : "Record money coming in"}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-[10px] border border-white/[0.07] bg-[#15181D] p-[3px]">
                <button
                  type="button" onClick={() => switchType("inflow")}
                  className="flex items-center gap-1.5 rounded-[7px] px-4 py-1.5 text-[13.5px] font-semibold"
                  style={{ background: type === "inflow" ? "#2A2F36" : "transparent", color: type === "inflow" ? "#A3E635" : "#8B929C" }}
                >
                  Inflow
                </button>
                <button
                  type="button" onClick={() => switchType("outflow")}
                  className="flex items-center gap-1.5 rounded-[7px] px-4 py-1.5 text-[13.5px] font-semibold"
                  style={{ background: type === "outflow" ? "#2A2F36" : "transparent", color: type === "outflow" ? "#E5544B" : "#8B929C" }}
                >
                  Outflow
                </button>
              </div>
              <button
                type="button" onClick={() => handleOpenChange(false)}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-white/[0.07] bg-[#15181D] text-[#8B929C]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-stretch">
            <div className="flex min-w-0 flex-1 basis-[340px] flex-col gap-5 border-r border-white/[0.06] px-6 py-[22px]">
              <div className="flex flex-col gap-2">
                <FieldLabel>Amount</FieldLabel>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[19px] font-medium" style={{ color: accent, fontFamily: "var(--font-tx-mono)" }}>
                    {type === "outflow" ? "−" : "+"}Rs
                  </span>
                  <input
                    ref={amountDesktopRef}
                    value={amount}
                    onChange={(e) => setAmount(cleanAmount(e.target.value))}
                    inputMode="decimal"
                    placeholder="0"
                    className="tx-amount-input min-w-0 flex-1 bg-transparent text-[38px] font-semibold tracking-[-0.03em] outline-none"
                    style={{ color: accent, fontFamily: "var(--font-tx-mono)", "--tx-accent": accent } as React.CSSProperties}
                  />
                </div>
                <div className="h-0.5 rounded-full" style={{ background: hexA(accent, 0.32) }} />
                <div className="font-mono text-[11.5px] text-[#6E757F]" style={{ fontFamily: "var(--font-tx-mono)" }}>{amountHint}</div>
              </div>

              <div className="flex flex-col gap-[9px]">
                <FieldLabel>{type === "outflow" ? "Outflow Type" : "Inflow Type"}</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {activeSubtypes.map((s) => {
                    const on = s.value === subType
                    return (
                      <button
                        key={s.value} type="button" onClick={() => setSubType(s.value)}
                        className="flex min-h-[50px] items-center rounded-[11px] border px-3 py-2 text-left"
                        style={{
                          background: on ? hexA(accent, 0.13) : "#101317",
                          borderColor: on ? hexA(accent, 0.55) : "rgba(255,255,255,0.08)",
                          boxShadow: on ? `inset 0 0 0 1px ${hexA(accent, 0.35)}` : "none",
                        }}
                      >
                        <span className={cn("text-[13px] leading-[1.3]", on ? "font-semibold text-[#ECEEF1]" : "font-medium text-[#B9C0C9]")}>{s.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 basis-[340px] flex-col gap-5 px-6 py-[22px]">
              <div className="flex flex-col gap-[9px]">
                <FieldLabel>Wallet</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {walletList.map((w) => {
                    const on = effectiveWalletId === w.id
                    const color = walletColor(w.name)
                    return (
                      <button
                        key={w.id} type="button" onClick={() => { setWalletId(w.id); setSegmentId("") }}
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

              {walletSegments.length > 0 && (
                <div className="flex flex-col gap-[9px]">
                  <FieldLabel>Segment</FieldLabel>
                  <select value={segmentId} onChange={(e) => setSegmentId(e.target.value)} className={selectClass} style={chevronBg}>
                    <option value="" style={optionStyle}>Whole wallet</option>
                    {walletSegments.map((s) => (
                      <option key={s.id} value={s.id} style={optionStyle}>{s.name} — {formatCurrency(Number(s.amount))}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-[9px]">
                <FieldLabel>Description</FieldLabel>
                <input
                  value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?"
                  className="min-h-[52px] w-full rounded-[11px] border border-white/[0.08] bg-[#101317] px-[13px] py-[11px] text-[14.5px] outline-none placeholder:text-[#5C636D]"
                />
              </div>

              {subType === "lending" && (
                <div className="flex flex-col gap-[9px]">
                  <FieldLabel>Person Name</FieldLabel>
                  <input
                    value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Who are you lending to?"
                    className="w-full rounded-[11px] border border-white/[0.08] bg-[#101317] px-[13px] py-[11px] text-[14.5px] outline-none placeholder:text-[#5C636D]"
                  />
                </div>
              )}

              {subType === "receivable_collection" && unsettledReceivables.length > 0 && (
                <div className="flex flex-col gap-[9px]">
                  <FieldLabel>Link to Receivable</FieldLabel>
                  <select value={receivableId} onChange={(e) => setReceivableId(e.target.value)} className={selectClass} style={chevronBg}>
                    <option value="" style={optionStyle}>No link (optional)</option>
                    {unsettledReceivables.map((r) => (
                      <option key={r.id} value={r.id} style={optionStyle}>{r.personName} — {formatCurrency(Number(r.amount) - Number(r.amountPaid))} remaining</option>
                    ))}
                  </select>
                </div>
              )}

              {subType === "debt_repayment" && unsettledLiabilities.length > 0 && (
                <div className="flex flex-col gap-[9px]">
                  <FieldLabel>Link to Liability</FieldLabel>
                  <select value={liabilityId} onChange={(e) => setLiabilityId(e.target.value)} className={selectClass} style={chevronBg}>
                    <option value="" style={optionStyle}>No link (optional)</option>
                    {unsettledLiabilities.map((l) => (
                      <option key={l.id} value={l.id} style={optionStyle}>{l.personName} — {formatCurrency(Number(l.amount) - Number(l.amountPaid))} remaining</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5">
                <div className="min-w-0 flex-1 basis-[150px] flex flex-col gap-[9px]">
                  <FieldLabel>Date</FieldLabel>
                  <input
                    type="date" value={date} onChange={(e) => setDate(e.target.value)} onClick={openDatePicker}
                    className="w-full cursor-pointer rounded-[11px] border border-white/[0.08] bg-[#101317] px-[13px] py-[11px] font-mono text-[14px] outline-none"
                    style={{ colorScheme: "dark", fontFamily: "var(--font-tx-mono)" }}
                  />
                </div>
                <div className="min-w-0 flex-1 basis-[150px] flex flex-col gap-[9px]">
                  <FieldLabel>Tag (optional)</FieldLabel>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass} style={chevronBg}>
                    <option value="" style={optionStyle}>None</option>
                    {categoryList.map((c) => (
                      <option key={c.id} value={c.id} style={optionStyle}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-[#0A0C0F] px-6 py-4">
            <div className="font-mono text-[12px] text-[#6E757F]" style={{ fontFamily: "var(--font-tx-mono)" }}>{summaryText}</div>
            <div className="flex items-center gap-2.5">
              <button
                type="button" onClick={() => handleOpenChange(false)}
                className="rounded-[11px] border border-white/[0.08] bg-[#15181D] px-[18px] py-[11px] text-[14px] text-[#B9C0C9]"
              >
                Cancel
              </button>
              <button
                type="button" onClick={handleSubmit} disabled={!valid || createTx.isPending}
                className="rounded-[11px] px-[22px] py-[11px] text-[14.5px] font-semibold"
                style={{ background: accent, color: type === "outflow" ? "#FFF5F4" : "#0B0D10", opacity: valid ? 1 : 0.45 }}
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

            {sheet === "type" && (
              <div className="overflow-y-auto px-[18px] pb-5">
                <div className="grid grid-cols-3 gap-2.5">
                  {activeSubtypes.map((s) => (
                    <IconTile
                      key={s.value} icon={SUBTYPE_ICONS[s.value] ?? TagIcon} label={s.label} color={accent}
                      active={s.value === subType} onClick={() => { setSubType(s.value); setSheet(null) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {sheet === "wallet" && (
              <div className="overflow-y-auto px-[18px] pb-5">
                <div className="grid grid-cols-3 gap-2.5">
                  {walletList.map((w) => (
                    <IconTile
                      key={w.id} icon={WalletIcon} label={w.name} meta={formatCompact(Number(w.balance))} color={walletColor(w.name)}
                      active={w.id === effectiveWalletId} onClick={() => { setWalletId(w.id); setSegmentId(""); setSheet(null) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {sheet === "tag" && (
              <div className="overflow-y-auto px-[18px] pb-5">
                <div className="grid grid-cols-3 gap-2.5">
                  <IconTile icon={TagIcon} label="None" color="#5C636D" active={!categoryId} onClick={() => { setCategoryId(""); setSheet(null) }} />
                  {categoryList.map((c) => (
                    <IconTile
                      key={c.id} icon={TagIcon} label={c.name} color={c.color ?? "#60A5FA"}
                      active={c.id === categoryId} onClick={() => { setCategoryId(c.id); setSheet(null) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {sheet === "segment" && (
              <div className="flex flex-col gap-2 overflow-y-auto px-[18px] pb-5">
                <SimpleListRow icon={Layers} label="Whole wallet" color="#60A5FA" active={!segmentId} onClick={() => { setSegmentId(""); setSheet(null) }} />
                {walletSegments.map((s) => (
                  <SimpleListRow
                    key={s.id} icon={Layers} label={s.name} meta={formatCurrency(Number(s.amount))} color={s.color ?? "#60A5FA"}
                    active={s.id === segmentId} onClick={() => { setSegmentId(s.id); setSheet(null) }}
                  />
                ))}
              </div>
            )}

            {sheet === "receivable" && (
              <div className="flex flex-col gap-2 overflow-y-auto px-[18px] pb-5">
                <SimpleListRow icon={Users} label="No link (optional)" color="#60A5FA" active={!receivableId} onClick={() => { setReceivableId(""); setSheet(null) }} />
                {unsettledReceivables.map((r) => (
                  <SimpleListRow
                    key={r.id} icon={Users} label={r.personName} meta={`${formatCurrency(Number(r.amount) - Number(r.amountPaid))} remaining`} color="#60A5FA"
                    active={r.id === receivableId} onClick={() => { setReceivableId(r.id); setSheet(null) }}
                  />
                ))}
              </div>
            )}

            {sheet === "liability" && (
              <div className="flex flex-col gap-2 overflow-y-auto px-[18px] pb-5">
                <SimpleListRow icon={Landmark} label="No link (optional)" color="#60A5FA" active={!liabilityId} onClick={() => { setLiabilityId(""); setSheet(null) }} />
                {unsettledLiabilities.map((l) => (
                  <SimpleListRow
                    key={l.id} icon={Landmark} label={l.personName} meta={`${formatCurrency(Number(l.amount) - Number(l.amountPaid))} remaining`} color="#60A5FA"
                    active={l.id === liabilityId} onClick={() => { setLiabilityId(l.id); setSheet(null) }}
                  />
                ))}
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
                        background: date === d.value ? hexA(accent, 0.13) : "#101317",
                        borderColor: date === d.value ? hexA(accent, 0.5) : "rgba(255,255,255,0.08)",
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
