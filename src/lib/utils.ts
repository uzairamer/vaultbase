import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, currency = "PKR"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
}

// Compact currency for tiles / stat cards where space is limited.
// Uses Pakistani conventions: K (thousand), L (lakh = 100K), Cr (crore = 10M).
export function formatCompact(amount: number | string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount
  if (!isFinite(n)) return "Rs 0"
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  const fmt = (val: number, unit: string) => {
    const fixed = val % 1 === 0 ? val.toString() : val.toFixed(1).replace(/\.0$/, "")
    return `${sign}Rs ${fixed}${unit}`
  }
  if (abs >= 10_000_000) return fmt(abs / 10_000_000, "Cr")
  if (abs >= 100_000)    return fmt(abs / 100_000,    "L")
  if (abs >= 1_000)      return fmt(abs / 1_000,      "K")
  return `${sign}Rs ${abs.toLocaleString("en-PK")}`
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-PK").format(num)
}

export function formatPercent(num: number): string {
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`
}
