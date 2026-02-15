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
