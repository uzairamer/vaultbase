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
    throw new Error((body as { error?: string }).error || "Request failed")
  }
  return res.json()
}

export function useIncomeSources() {
  return useQuery({ queryKey: ["income-sources"], queryFn: () => fetcher("/api/incomes/sources") })
}

export function useCreateIncomeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator("/api/incomes/sources", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-sources"] }),
  })
}

export function useUpdateIncomeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator("/api/incomes/sources", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-sources"] }),
  })
}

export function useDeleteIncomeSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      mutator(`/api/incomes/sources?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-sources"] }),
  })
}

export function useCreateBreakdown() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator("/api/incomes/breakdown", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-sources"] }),
  })
}

export function useUpdateBreakdown() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      mutator("/api/incomes/breakdown", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-sources"] }),
  })
}

export function useDeleteBreakdown() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      mutator(`/api/incomes/breakdown?id=${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income-sources"] }),
  })
}
