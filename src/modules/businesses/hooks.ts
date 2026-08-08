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

// ── Businesses ────────────────────────────────────────────────────────────────

export function useBusinesses() {
  return useQuery({ queryKey: ["businesses"], queryFn: () => fetcher("/api/businesses") })
}

export function useCreateBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator("/api/businesses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  })
}

export function useUpdateBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator("/api/businesses", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  })
}

export function useDeleteBusiness() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mutator(`/api/businesses?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  })
}

// ── Ledger ────────────────────────────────────────────────────────────────────

export function useLedger(businessId: string, params?: Record<string, string>) {
  const query = params ? "?" + new URLSearchParams(params).toString() : ""
  return useQuery({
    queryKey: ["ledger", businessId, params],
    queryFn: () => fetcher(`/api/businesses/${businessId}/ledger${query}`),
    enabled: !!businessId,
  })
}

export function useCreateEntry(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator(`/api/businesses/${businessId}/ledger`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger", businessId] })
      qc.invalidateQueries({ queryKey: ["inventory", businessId] })
    },
  })
}

export function useUpdateEntry(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator(`/api/businesses/${businessId}/ledger`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger", businessId] })
      qc.invalidateQueries({ queryKey: ["inventory", businessId] })
    },
  })
}

export function useDeleteEntry(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      mutator(`/api/businesses/${businessId}/ledger?id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ledger", businessId] })
      qc.invalidateQueries({ queryKey: ["inventory", businessId] })
    },
  })
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export function useInventory(businessId: string, params?: Record<string, string>) {
  const query = params ? "?" + new URLSearchParams(params).toString() : ""
  return useQuery({
    queryKey: ["inventory", businessId, params],
    queryFn: () => fetcher(`/api/businesses/${businessId}/inventory${query}`),
    enabled: !!businessId,
  })
}

export function useCreateInventoryItem(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator(`/api/businesses/${businessId}/inventory`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", businessId] }),
  })
}

export function useUpdateInventoryItem(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator(`/api/businesses/${businessId}/inventory`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", businessId] }),
  })
}

export function useDeleteInventoryItem(businessId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      mutator(`/api/businesses/${businessId}/inventory?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", businessId] }),
  })
}
