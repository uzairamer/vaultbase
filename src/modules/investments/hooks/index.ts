"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

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

// Real Estate
export function useProperties() {
  return useQuery({ queryKey: ["properties"], queryFn: () => fetcher("/api/investments/real-estate") })
}

export function useProperty(id: string) {
  return useQuery({ queryKey: ["properties", id], queryFn: () => fetcher(`/api/investments/real-estate?id=${id}`) })
}

export function useCreateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => mutator("/api/investments/real-estate", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  })
}

export function useUpdateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => mutator("/api/investments/real-estate", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  })
}

export function useDeleteProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mutator(`/api/investments/real-estate?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  })
}

export function useUpdateInstallment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { installmentId: string; status?: "paid" | "unpaid" | "pending"; paidDate?: string; receiptNote?: string; amount?: number; dueDate?: string }) =>
      mutator("/api/investments/real-estate", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] })
      qc.invalidateQueries({ queryKey: ["insights"] })
    },
  })
}

export function useSaveLedger() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      propertyId: string
      rows: Array<{ type: string; amount: number; dueDate: string; status: string; paidDate?: string | null; receiptNote?: string | null }>
    }) => mutator("/api/investments/real-estate/ledger/save", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] })
      qc.invalidateQueries({ queryKey: ["insights"] })
    },
  })
}

export function useUnlockLedger() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId: string) =>
      mutator(`/api/investments/real-estate/ledger/save?propertyId=${propertyId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["properties"] }),
  })
}

export function useRegenerateLedger() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      propertyId: string
      downPayment?: number
      purchaseDate?: string
      monthlyInstallment?: number | null
      balloonAmount?: number | null
      balloonEveryNMonths?: number | null
      installmentStartDate?: string | null
      installmentDueDay?: number | null
      installmentMonths?: number | null
    }) => mutator("/api/investments/real-estate/regenerate-ledger", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] })
      qc.invalidateQueries({ queryKey: ["insights"] })
    },
  })
}

export function useSyncStockPrices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prices: Array<{ symbol: string; price: number }>) =>
      mutator("/api/investments/stocks/sync-prices", { method: "POST", body: JSON.stringify({ prices }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stocks"] }),
  })
}

export function useAutoMarkInstallments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (propertyId?: string) =>
      mutator("/api/investments/real-estate/installments/auto-mark", {
        method: "POST",
        body: JSON.stringify(propertyId ? { propertyId } : {}),
      }),
    onSuccess: (data: { marked: number }) => {
      if (data.marked > 0) {
        qc.invalidateQueries({ queryKey: ["properties"] })
        qc.invalidateQueries({ queryKey: ["insights"] })
      }
    },
  })
}

// Stocks
export function useStocks() {
  return useQuery({ queryKey: ["stocks"], queryFn: () => fetcher("/api/investments/stocks") })
}

export function useStock(id: string) {
  return useQuery({ queryKey: ["stocks", id], queryFn: () => fetcher(`/api/investments/stocks?id=${id}`) })
}

export function useCreateStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => mutator("/api/investments/stocks", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stocks"] }),
  })
}

export function useUpdateStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => mutator("/api/investments/stocks", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stocks"] }),
  })
}

export function useDeleteStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mutator(`/api/investments/stocks?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stocks"] }),
  })
}

export function useSellStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator("/api/investments/stocks/sell", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stocks"] })
      qc.invalidateQueries({ queryKey: ["wallets"] })
    },
  })
}

export function useSellAllStocks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator("/api/investments/stocks/sell-all", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stocks"] })
      qc.invalidateQueries({ queryKey: ["wallets"] })
      qc.invalidateQueries({ queryKey: ["insights"] })
      qc.invalidateQueries({ queryKey: ["financial-report"] })
    },
  })
}

// Commodities
export function useCommodities() {
  return useQuery({ queryKey: ["commodities"], queryFn: () => fetcher("/api/investments/commodities") })
}

export function useCommodity(id: string) {
  return useQuery({ queryKey: ["commodities", id], queryFn: () => fetcher(`/api/investments/commodities?id=${id}`) })
}

export function useCreateCommodity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => mutator("/api/investments/commodities", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commodities"] }),
  })
}

export function useUpdateCommodity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => mutator("/api/investments/commodities", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commodities"] }),
  })
}

export function useDeleteCommodity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mutator(`/api/investments/commodities?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commodities"] }),
  })
}

// Archive (stocks / commodities / realestate)
export function useArchiveInvestments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (type: "stocks" | "commodities" | "realestate") =>
      mutator("/api/investments/archive", { method: "POST", body: JSON.stringify({ type }) }),
    onSuccess: (_data, type) => {
      if (type === "stocks") qc.invalidateQueries({ queryKey: ["stocks"] })
      if (type === "commodities") qc.invalidateQueries({ queryKey: ["commodities"] })
      if (type === "realestate") qc.invalidateQueries({ queryKey: ["properties"] })
      qc.invalidateQueries({ queryKey: ["insights"] })
      qc.invalidateQueries({ queryKey: ["financial-report"] })
    },
  })
}

// Side Investments
export function useSideInvestments() {
  return useQuery({ queryKey: ["side-investments"], queryFn: () => fetcher("/api/investments/other") })
}

export function useSideInvestment(id: string) {
  return useQuery({ queryKey: ["side-investments", id], queryFn: () => fetcher(`/api/investments/other?id=${id}`) })
}

export function useCreateSideInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => mutator("/api/investments/other", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["side-investments"] }),
  })
}

export function useUpdateSideInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => mutator("/api/investments/other", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["side-investments"] }),
  })
}

export function useDeleteSideInvestment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mutator(`/api/investments/other?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["side-investments"] }),
  })
}

// Static Prices
export function useStaticPrices() {
  return useQuery({ queryKey: ["static-prices"], queryFn: () => fetcher("/api/settings/static-prices") })
}

export function useCreateStaticPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => mutator("/api/settings/static-prices", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["static-prices"] }),
  })
}

export function useDeleteStaticPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mutator(`/api/settings/static-prices?id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["static-prices"] })
      qc.invalidateQueries({ queryKey: ["commodities"] })
    },
  })
}

export function useAddStaticPriceEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { staticPriceId: string; pricePerTola: number; date: string; note?: string }) =>
      mutator("/api/settings/static-prices/entries", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["static-prices"] })
      qc.invalidateQueries({ queryKey: ["commodities"] })
      qc.invalidateQueries({ queryKey: ["insights"] })
    },
  })
}

export function useDeleteStaticPriceEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mutator(`/api/settings/static-prices/entries?id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["static-prices"] })
      qc.invalidateQueries({ queryKey: ["commodities"] })
      qc.invalidateQueries({ queryKey: ["insights"] })
    },
  })
}
