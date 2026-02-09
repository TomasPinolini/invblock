"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Transaction } from "@/db/schema";
import type { TransactionFormValues } from "@/lib/validators";

const TRANSACTIONS_KEY = ["transactions"] as const;
const ASSETS_KEY = ["assets"] as const;

async function fetchTransactions(assetId?: string): Promise<Transaction[]> {
  const url = assetId
    ? `/api/transactions?assetId=${assetId}`
    : "/api/transactions";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

async function createTransaction(
  data: TransactionFormValues
): Promise<Transaction> {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to create transaction");
  }
  return res.json();
}

async function deleteTransaction(id: string): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to delete transaction");
  }
}

export function useTransactions(assetId?: string) {
  return useQuery({
    queryKey: assetId ? [...TRANSACTIONS_KEY, assetId] : TRANSACTIONS_KEY,
    queryFn: () => fetchTransactions(assetId),
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      // Also refresh assets since transaction affects quantity/avg price
      qc.invalidateQueries({ queryKey: ASSETS_KEY });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      qc.invalidateQueries({ queryKey: ASSETS_KEY });
    },
  });
}
