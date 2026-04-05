"use client"

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { useState, useEffect, useRef, useMemo } from "react"

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

// ─── Portfolio Return ────────────────────────────────────────────────────────

export type ReturnPeriod = "ytd" | "1y" | "3y" | "max"

export interface ReturnPoint {
  timestamp: number
  date: string
  value: number
}

export interface ReturnEvent {
  timestamp: number
  date: string
  trades: { symbol: string; type: string; quantity: number; price: number }[]
}

export function usePortfolioReturn(period: ReturnPeriod) {
  return useQuery({
    queryKey: ["portfolio-return", period],
    queryFn: () => fetcher(`/api/insights/portfolio-return?period=${period}`),
    staleTime: 5 * 60 * 1000,
  })
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
  dayHigh: number
  dayLow: number
}

async function fetchLivePrice(symbol: string): Promise<LivePrice> {
  const res = await fetch(`/api/insights/stock-live?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) return { symbol, price: 0, volume: 0, dayHigh: 0, dayLow: 0 }
  const json = await res.json()
  if (json.s !== "ok" || !json.c || json.c.length === 0) return { symbol, price: 0, volume: 0, dayHigh: 0, dayLow: 0 }
  const price = json.c[json.c.length - 1]
  const volume = (json.v as number[])?.reduce((sum: number, v: number) => sum + v, 0) ?? 0
  const dayHigh = json.h ? Math.max(...(json.h as number[])) : 0
  const dayLow  = json.l ? Math.min(...(json.l as number[])) : 0
  return { symbol, price, volume, dayHigh, dayLow }
}

export function useLivePrices(symbols: string[]) {
  return useQuery({
    queryKey: ["live-prices", symbols],
    queryFn: () => Promise.all(symbols.map(fetchLivePrice)),
    enabled: symbols.length > 0,
    refetchInterval: 10_000,
  })
}

/**
 * Like useLivePrices but fetches one symbol at a time in round-robin order
 * (1.5 s per symbol) so alerts fire individually instead of all at once.
 * Initial load still fetches all symbols in parallel for a fast first render.
 */
export function useRoundRobinPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Map<string, LivePrice>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchingSymbol, setFetchingSymbol] = useState<string | null>(null)
  const indexRef = useRef(0)
  const symbolsRef = useRef(symbols)
  useEffect(() => { symbolsRef.current = symbols }, [symbols])

  const symbolsKey = symbols.join(",")

  // Initial load: fetch all at once so the table populates immediately
  useEffect(() => {
    if (symbols.length === 0) return
    setIsLoading(true)
    indexRef.current = 0
    Promise.all(symbols.map(fetchLivePrice)).then((results) => {
      setPrices(() => {
        const m = new Map<string, LivePrice>()
        for (const r of results) m.set(r.symbol, r)
        return m
      })
      setIsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey])

  // Round-robin: fetch one symbol every 1.5 s
  useEffect(() => {
    const id = setInterval(async () => {
      const syms = symbolsRef.current
      if (syms.length === 0) return
      const sym = syms[indexRef.current % syms.length]
      indexRef.current = (indexRef.current + 1) % syms.length
      setIsFetching(true)
      setFetchingSymbol(sym)
      const lp = await fetchLivePrice(sym)
      setPrices((prev) => { const next = new Map(prev); next.set(sym, lp); return next })
      setIsFetching(false)
      setFetchingSymbol(null)
    }, 1500)
    return () => clearInterval(id)
  }, []) // intentionally empty — symbolsRef always holds the latest list

  const data = useMemo(() => Array.from(prices.values()), [prices])
  return { data, isLoading, isFetching, fetchingSymbol }
}
