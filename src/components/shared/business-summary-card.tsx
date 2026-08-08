"use client"

import { cn, formatCurrency, formatCompact } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface Row {
  label: string
  value: number
  color?: "emerald" | "red" | "muted"
  /** If true, displays as X.X% instead of currency */
  isPercent?: boolean
}

interface BusinessSummaryCardProps {
  rows: Row[]
  /** Optional bottom callout: "Net Profit" or "Net Loss" */
  net?: number
  className?: string
}

// Subtle SVG background — rings + dots, deterministic
function BgDecor() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Large ring top-right */}
      <circle cx="105%" cy="-10%" r="120" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="105%" cy="-10%" r="80" stroke="currentColor" strokeWidth="1" fill="none" />
      {/* Small ring bottom-left */}
      <circle cx="-5%" cy="110%" r="90" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* Dots */}
      <circle cx="20%" cy="15%" r="2.5" fill="currentColor" />
      <circle cx="75%" cy="70%" r="2" fill="currentColor" />
      <circle cx="85%" cy="20%" r="1.5" fill="currentColor" />
      <circle cx="10%" cy="60%" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function BusinessSummaryCard({ rows, net, className }: BusinessSummaryCardProps) {
  const isProfit = net !== undefined && net >= 0
  const isLoss   = net !== undefined && net < 0

  return (
    <div className={cn(
      "sm:hidden relative overflow-hidden rounded-2xl border p-4 mb-4",
      "bg-gradient-to-br from-card to-muted/20",
      isProfit && "border-emerald-500/20 from-emerald-500/5",
      isLoss   && "border-red-500/20 from-red-500/5",
      !isProfit && !isLoss && "border-border",
      className,
    )}>
      <BgDecor />

      {/* Rows */}
      <div className="relative space-y-0 divide-y divide-border/60">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2.5">
              {/* Icon indicator */}
              <span className={cn(
                "h-2 w-2 rounded-full shrink-0",
                row.color === "emerald" && "bg-emerald-400",
                row.color === "red"     && "bg-red-400",
                row.color === "muted"   && "bg-muted-foreground/40",
                !row.color              && "bg-muted-foreground/40",
              )} />
              <span className="text-sm text-muted-foreground font-medium">{row.label}</span>
            </div>
            <div className="text-right">
              <p className={cn(
                "text-sm font-semibold tabular-nums",
                row.color === "emerald" && "text-emerald-400",
                row.color === "red"     && "text-red-400",
                (!row.color || row.color === "muted") && "text-foreground",
              )}>
                {row.isPercent ? `${row.value.toFixed(1)}%` : formatCompact(Math.abs(row.value))}
              </p>
              {!row.isPercent && row.value !== 0 && (
                <p className="text-[10px] text-muted-foreground tabular-nums">{formatCurrency(Math.abs(row.value))}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Net Profit / Loss callout */}
      {net !== undefined && (
        <div className={cn(
          "relative mt-3 pt-3 border-t flex items-center justify-between",
          isProfit ? "border-emerald-500/30" : "border-red-500/30",
        )}>
          <div className="flex items-center gap-2">
            {isProfit
              ? <TrendingUp className="h-4 w-4 text-emerald-400" />
              : isLoss
              ? <TrendingDown className="h-4 w-4 text-red-400" />
              : <Minus className="h-4 w-4 text-muted-foreground" />
            }
            <span className={cn(
              "text-sm font-bold",
              isProfit && "text-emerald-400",
              isLoss   && "text-red-400",
              !isProfit && !isLoss && "text-foreground",
            )}>
              {isProfit ? "Net Profit" : isLoss ? "Net Loss" : "Break Even"}
            </span>
          </div>
          <div className="text-right">
            <p className={cn(
              "text-base font-bold tabular-nums",
              isProfit && "text-emerald-400",
              isLoss   && "text-red-400",
            )}>
              {formatCompact(Math.abs(net))}
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums">{formatCurrency(Math.abs(net))}</p>
          </div>
        </div>
      )}
    </div>
  )
}
