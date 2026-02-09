"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Asset } from "@/db/schema";
import type { AssetFormValues } from "@/lib/validators";

const ASSETS_KEY = ["assets"] as const;

async function fetchAssets(): Promise<Asset[]> {
  const res = await fetch("/api/assets");
  if (!res.ok) throw new Error("Failed to fetch assets");
  return res.json();
}

async function createAsset(data: AssetFormValues): Promise<Asset> {
  const res = await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to create asset");
  }
  return res.json();
}

async function updateAsset({
  id,
  data,
}: {
  id: string;
  data: Partial<AssetFormValues>;
}): Promise<Asset> {
  const res = await fetch(`/api/assets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to update asset");
  }
  return res.json();
}

async function deleteAsset(id: string): Promise<void> {
  const res = await fetch(`/api/assets/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to delete asset");
  }
}

export function useAssets() {
  return useQuery({
    queryKey: ASSETS_KEY,
    queryFn: fetchAssets,
    staleTime: 1000 * 60 * 2, // 2 min — prices are mock anyway
    refetchOnWindowFocus: true,
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ASSETS_KEY }),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ASSETS_KEY }),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ASSETS_KEY }),
  });
}
