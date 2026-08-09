"use client"

import { useEffect, useRef } from "react"
import { Building, Banknote, Smartphone, Wallet as WalletIcon, Wifi } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { WALLET_TYPES } from "@/lib/constants"

// Muted, low-saturation tones — read as premium bank-card material rather than app-icon brights,
// but bright enough to stay legible against the dark stage behind them.
const CARD_ACCENTS = [
  { from: "#3f6a95", to: "#1c3350" }, // navy
  { from: "#5a616c", to: "#2a2f37" }, // graphite
  { from: "#3f6b57", to: "#1c3327" }, // forest
  { from: "#7a3f52", to: "#3a1f28" }, // wine
  { from: "#7a5c37", to: "#3a2c1c" }, // bronze
  { from: "#48566c", to: "#212832" }, // slate blue
]
function cardAccent(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return CARD_ACCENTS[Math.abs(hash) % CARD_ACCENTS.length]
}

const walletIcons: Record<string, React.ElementType> = {
  bank: Building,
  cash: Banknote,
  digital_wallet: Smartphone,
  other: WalletIcon,
}

export interface WalletStackItem {
  id: string
  name: string
  type: string
  bankName?: string | null
  balance: number | string
  segments?: { id: string; name: string; amount: number | string; color?: string }[]
  _count?: { transactions?: number }
}

const CONTAINER_H = 400
const CARD_H = 256
const STEP = 112
const CARD_TOP = 64
const DEPTH_OFFSET = 84

export function WalletCardStack({
  wallets, activeId, onActiveChange,
}: { wallets: WalletStackItem[]; activeId: string | null; onActiveChange: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const lastActiveIndexRef = useRef(-1)
  const rafRef = useRef<number | null>(null)

  function applyTransforms() {
    const container = containerRef.current
    if (!container) return
    const scrollTop = container.scrollTop
    const continuous = scrollTop / STEP

    wallets.forEach((w, i) => {
      const el = cardRefs.current[w.id]
      if (!el) return
      const depth = i - continuous
      const absDepth = Math.min(Math.abs(depth), 4)
      const translateY = depth * DEPTH_OFFSET
      const scale = 1 - absDepth * 0.06
      const opacity = Math.max(1 - absDepth * 0.55, 0)
      const blur = absDepth * 3.5
      el.style.transform = `translateY(${translateY}px) scale(${scale})`
      el.style.opacity = String(opacity)
      el.style.filter = blur > 0.4 ? `blur(${blur}px)` : "none"
      el.style.zIndex = String(Math.round(1000 - absDepth * 10))
      el.style.pointerEvents = absDepth > 1.2 ? "none" : "auto"
    })

    const nearest = Math.min(Math.max(Math.round(continuous), 0), wallets.length - 1)
    if (nearest !== lastActiveIndexRef.current && wallets[nearest]) {
      lastActiveIndexRef.current = nearest
      onActiveChange(wallets[nearest].id)
    }
  }

  function handleScroll() {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      applyTransforms()
    })
  }

  useEffect(() => {
    applyTransforms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets.length])

  function scrollToIndex(i: number) {
    containerRef.current?.scrollTo({ top: i * STEP, behavior: "smooth" })
  }

  return (
    <div className="wallet-stack-scroll relative">
      <style>{`.wallet-stack-scroll .wallet-stack-scroller::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="wallet-stack-scroller snap-y snap-mandatory overflow-x-hidden overflow-y-scroll rounded-[28px] border border-white/10 bg-gradient-to-b from-[#1c2027] to-[#0b0d10]"
        style={{ height: CONTAINER_H, scrollbarWidth: "none" }}
      >
        <div className="sticky top-0 z-0 h-0 pointer-events-none">
          {wallets.map((w, i) => {
            const Icon = walletIcons[w.type] || WalletIcon
            const accent = cardAccent(w.name)
            const balance = Number(w.balance)
            const segs = w.segments ?? []
            const typeLabel = (WALLET_TYPES.find((t) => t.value === w.type) || { label: w.type }).label
            const txCount = w._count?.transactions ?? 0
            return (
              <div
                key={w.id}
                ref={(el) => { cardRefs.current[w.id] = el }}
                onClick={() => scrollToIndex(i)}
                className="pointer-events-auto absolute inset-x-6 flex cursor-pointer flex-col overflow-hidden rounded-[22px] p-5 text-white will-change-[transform,opacity,filter]"
                style={{
                  top: CARD_TOP, height: CARD_H,
                  background: `linear-gradient(150deg, ${accent.from} 0%, ${accent.to} 55%, #171b21 100%)`,
                  transformOrigin: "50% 0%",
                  boxShadow: "0 20px 40px -12px rgba(0,0,0,0.55)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold leading-tight">{w.name}</p>
                    <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
                      {w.bankName ? `${typeLabel as string} · ${w.bankName}` : (typeLabel as string)}
                    </p>
                  </div>
                  <Icon className="h-5 w-5 shrink-0 text-white/35" />
                </div>

                {w.type === "bank" && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex h-6 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#d8c398] to-[#a8895a]">
                      <div className="grid h-3.5 w-6 grid-cols-2 gap-px rounded-sm border border-[#8a6f42]/40 p-0.5">
                        <div className="rounded-[1px] bg-[#8a6f42]/50" />
                        <div className="rounded-[1px] bg-[#8a6f42]/50" />
                        <div className="rounded-[1px] bg-[#8a6f42]/50" />
                        <div className="rounded-[1px] bg-[#8a6f42]/50" />
                      </div>
                    </div>
                    <Wifi className="h-3.5 w-3.5 rotate-90 text-white/35" />
                  </div>
                )}

                <p className="mt-4 w-full text-center text-[38px] font-bold leading-none tracking-tight tabular-nums">{formatCurrency(balance)}</p>

                <div className="mt-auto flex items-center gap-6 border-t border-white/10 pt-3">
                  <div>
                    <p className="text-[9.5px] uppercase tracking-widest text-white/40">Transactions</p>
                    <p className="text-[13px] font-semibold tabular-nums">{txCount}</p>
                  </div>
                  <div>
                    <p className="text-[9.5px] uppercase tracking-widest text-white/40">Segments</p>
                    <p className="text-[13px] font-semibold tabular-nums">{segs.length || "—"}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {wallets.map((w) => (
          <div key={w.id} className="snap-start" style={{ height: STEP }} />
        ))}
        <div style={{ height: Math.max(CONTAINER_H - STEP, 0) }} />
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5">
        {wallets.map((w) => (
          <span
            key={w.id}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: w.id === activeId ? 16 : 6,
              background: w.id === activeId ? "#ECEEF1" : "rgba(255,255,255,0.18)",
            }}
          />
        ))}
      </div>
    </div>
  )
}
