"use client"

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"

async function fetcher(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json()
}

async function mutator(url: string, options: RequestInit) {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json" } })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || "Request failed")
  }
  return res.json()
}

export function useInsightsData() {
  return useQuery({ queryKey: ["insights"], queryFn: () => fetcher("/api/insights") })
}

// ─── Stock History ──────────────────────────────────────────────────────────

export interface StockHistoryPoint {
  date: string
  close: number
  timestamp: number
  open: number
  high: number
  low: number
  volume: number
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
    open: json.o?.[i] ?? json.c[i],
    high: json.h?.[i] ?? json.c[i],
    low: json.l?.[i] ?? json.c[i],
    volume: json.v?.[i] ?? 0,
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

// ─── Watchlist ───────────────────────────────────────────────────────────────

export interface WatchlistItem {
  id: string
  symbol: string
  addedAt: string
}

export function useWatchlist() {
  return useQuery({
    queryKey: ["watchlist"],
    queryFn: () => fetcher("/api/insights/watchlist"),
  })
}

export function useAddToWatchlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (symbol: string) =>
      mutator("/api/insights/watchlist", { method: "POST", body: JSON.stringify({ symbol }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  })
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (symbol: string) =>
      mutator(`/api/insights/watchlist?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  })
}

// ─── Live Prices ─────────────────────────────────────────────────────────────

export interface LivePrice {
  symbol: string
  price: number
  volume: number
}

async function fetchLivePrice(symbol: string): Promise<LivePrice> {
  const res = await fetch(`/api/insights/stock-live?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) return { symbol, price: 0, volume: 0 }
  const json = await res.json()
  if (json.s !== "ok" || !json.c || json.c.length === 0) return { symbol, price: 0, volume: 0 }
  const price = json.c[json.c.length - 1]
  const volume = (json.v as number[])?.reduce((sum: number, v: number) => sum + v, 0) ?? 0
  return { symbol, price, volume }
}

export function useLivePrices(symbols: string[]) {
  return useQuery({
    queryKey: ["live-prices", symbols],
    queryFn: () => Promise.all(symbols.map(fetchLivePrice)),
    enabled: symbols.length > 0,
    refetchInterval: 10_000,
  })
}
