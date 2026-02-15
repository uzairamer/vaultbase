"use client"

import { useQuery } from "@tanstack/react-query"

async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

export function useInsightsData() {
  return useQuery({ queryKey: ["insights"], queryFn: () => fetcher("/api/insights") })
}

export interface StockHistoryPoint {
  date: string
  close: number
  timestamp: number
}

export interface StockHistory {
  symbol: string
  data: StockHistoryPoint[]
}

export type HistoryPeriod = "ytd" | "1y" | "3y" | "5y" | "max"

function periodToFromTimestamp(period: HistoryPeriod): number | undefined {
  const now = Math.floor(Date.now() / 1000)
  switch (period) {
    case "ytd": {
      const jan1 = new Date(new Date().getFullYear(), 0, 1)
      return Math.floor(jan1.getTime() / 1000)
    }
    case "1y": return now - 365 * 24 * 60 * 60
    case "3y": return now - 3 * 365 * 24 * 60 * 60
    case "5y": return now - 5 * 365 * 24 * 60 * 60
    case "max": return undefined // API default handles it
  }
}

export async function fetchStockHistory(symbol: string, period: HistoryPeriod = "max"): Promise<StockHistory> {
  const from = periodToFromTimestamp(period)
  const url = from
    ? `/api/insights/stock-history?symbol=${encodeURIComponent(symbol)}&from=${from}`
    : `/api/insights/stock-history?symbol=${encodeURIComponent(symbol)}`
  const res = await fetch(url)
  if (!res.ok) return { symbol, data: [] }
  const json = await res.json()
  if (json.s !== "ok" || !json.t) return { symbol, data: [] }
  const points: StockHistoryPoint[] = (json.t as number[]).map((t: number, i: number) => ({
    date: new Date(t * 1000).toLocaleDateString("en-PK", {
      year: period === "ytd" || period === "1y" ? undefined : "2-digit",
      month: "short",
      day: "numeric",
    }),
    close: json.c[i],
    timestamp: t,
  }))
  return { symbol, data: points }
}

export function useStockHistories(symbols: string[], period: HistoryPeriod = "max") {
  return useQuery({
    queryKey: ["stock-histories", symbols, period],
    queryFn: () => Promise.all(symbols.map((s) => fetchStockHistory(s, period))),
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}
