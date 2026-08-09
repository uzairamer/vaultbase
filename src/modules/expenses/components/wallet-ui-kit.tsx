"use client"

import { Instrument_Sans, JetBrains_Mono } from "next/font/google"
import { Check, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export const txSans = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-tx-sans" })
export const txMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-tx-mono" })

export function hexA(hex: string, a: number) {
  const h = hex.replace("#", "")
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`
}

export function cleanAmount(v: string) {
  return (v || "").replace(/[^0-9.]/g, "")
}
export function groupAmount(v: string) {
  const s = cleanAmount(v)
  if (!s) return ""
  const [intPart, dec] = s.split(".")
  const grouped = Number(intPart || 0).toLocaleString("en-US")
  return dec !== undefined ? `${grouped}.${dec.slice(0, 2)}` : grouped
}

export function openDatePicker(e: React.MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget
  if (typeof el.showPicker === "function") el.showPicker()
}

export const chevronBg: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,transparent 50%,#7A818B 50%),linear-gradient(135deg,#7A818B 50%,transparent 50%)",
  backgroundPosition: "calc(100% - 17px) 50%, calc(100% - 12px) 50%",
  backgroundSize: "5px 5px, 5px 5px",
  backgroundRepeat: "no-repeat",
}
export const selectClass =
  "w-full box-border rounded-[11px] bg-[#101317] border border-white/[0.08] px-[13px] py-[11px] text-[14.5px] cursor-pointer appearance-none"
export const optionStyle: React.CSSProperties = { background: "#15181D" }

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#6E757F]">{children}</div>
  )
}

export function IconTile({
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

export function SimpleListRow({
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

const WALLET_COLORS = ["#818CF8", "#38BDF8", "#34D399", "#FBBF24", "#F472B6", "#94A3B8"]
export function walletColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return WALLET_COLORS[Math.abs(hash) % WALLET_COLORS.length]
}
