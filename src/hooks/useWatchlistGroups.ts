"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { WatchlistGroup, WatchlistGroupItem, WatchlistItem } from "@/db/schema";
import type {
  WatchlistGroupCreateValues,
  WatchlistGroupUpdateValues,
} from "@/lib/validators";

// ── Types ───────────────────────────────────────────────────────────────────

export interface WatchlistGroupWithItems extends WatchlistGroup {
  items: (WatchlistGroupItem & { watchlistEntry: WatchlistItem })[];
}

export interface GroupPriceSecurity {
  simbolo: string;
  descripcion: string;
  ultimoPrecio: number;
  variacionPorcentual: number;
  cierreAnterior?: number;
  _watchlistId: string;
  _groupItemId: string;
  _category: string;
  _notes: string | null;
}

// ── Query Keys ──────────────────────────────────────────────────────────────

const GROUPS_KEY = ["watchlist-groups"] as const;
const groupPricesKey = (groupId: string) =>
  ["watchlist-group-prices", groupId] as const;

// ── Fetchers ────────────────────────────────────────────────────────────────

async function fetchGroups(): Promise<WatchlistGroupWithItems[]> {
  const res = await fetch("/api/watchlist-groups");
  if (!res.ok) throw new Error("Failed to fetch groups");
  return res.json();
}

async function fetchGroupPrices(
  groupId: string
): Promise<{ securities: GroupPriceSecurity[]; count: number }> {
  const res = await fetch(`/api/watchlist-groups/${groupId}/prices`);
  if (!res.ok) throw new Error("Failed to fetch group prices");
  return res.json();
}

async function createGroup(
  data: WatchlistGroupCreateValues
): Promise<WatchlistGroup> {
  const res = await fetch("/api/watchlist-groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to create group");
  }
  return res.json();
}

async function updateGroup({
  id,
  data,
}: {
  id: string;
  data: WatchlistGroupUpdateValues;
}): Promise<WatchlistGroup> {
  const res = await fetch(`/api/watchlist-groups/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to update group");
  }
  return res.json();
}

async function deleteGroup(id: string): Promise<void> {
  const res = await fetch(`/api/watchlist-groups/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to delete group");
  }
}

async function reorderGroups(groupIds: string[]): Promise<void> {
  const res = await fetch("/api/watchlist-groups/reorder", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder groups");
}

async function addItemToGroup({
  groupId,
  watchlistId,
}: {
  groupId: string;
  watchlistId: string;
}): Promise<WatchlistGroupItem> {
  const res = await fetch(`/api/watchlist-groups/${groupId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watchlistId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to add item to group");
  }
  return res.json();
}

async function removeItemFromGroup({
  groupId,
  watchlistId,
}: {
  groupId: string;
  watchlistId: string;
}): Promise<void> {
  const res = await fetch(
    `/api/watchlist-groups/${groupId}/items?watchlistId=${watchlistId}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Failed to remove item from group");
  }
}

async function reorderItems({
  groupId,
  itemIds,
}: {
  groupId: string;
  itemIds: string[];
}): Promise<void> {
  const res = await fetch(`/api/watchlist-groups/${groupId}/items/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder items");
}

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useWatchlistGroups() {
  return useQuery({
    queryKey: GROUPS_KEY,
    queryFn: fetchGroups,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useWatchlistGroupPrices(groupId: string | null) {
  return useQuery({
    queryKey: groupPricesKey(groupId ?? ""),
    queryFn: () => fetchGroupPrices(groupId!),
    enabled: !!groupId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useCreateWatchlistGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useUpdateWatchlistGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useDeleteWatchlistGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteGroup,
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useReorderWatchlistGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reorderGroups,
    onSuccess: () => qc.invalidateQueries({ queryKey: GROUPS_KEY }),
  });
}

export function useAddItemToGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addItemToGroup,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: GROUPS_KEY });
      qc.invalidateQueries({ queryKey: groupPricesKey(vars.groupId) });
    },
  });
}

export function useRemoveItemFromGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeItemFromGroup,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: GROUPS_KEY });
      qc.invalidateQueries({ queryKey: groupPricesKey(vars.groupId) });
    },
  });
}

export function useReorderGroupItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reorderItems,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: GROUPS_KEY });
      qc.invalidateQueries({ queryKey: groupPricesKey(vars.groupId) });
    },
  });
}
