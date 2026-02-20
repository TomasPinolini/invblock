"use client";

import { useState, useMemo } from "react";
import { X, Search, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { WatchlistItem } from "@/db/schema";
import type { WatchlistGroupWithItems } from "@/hooks/useWatchlistGroups";

interface AddToGroupDialogProps {
  open: boolean;
  onClose: () => void;
  group: WatchlistGroupWithItems | null;
  watchlistItems: WatchlistItem[];
  onAdd: (watchlistId: string) => void;
  onRemove: (watchlistId: string) => void;
  isPending?: boolean;
}

export function AddToGroupDialog({
  open,
  onClose,
  group,
  watchlistItems,
  onAdd,
  onRemove,
  isPending,
}: AddToGroupDialogProps) {
  const [search, setSearch] = useState("");

  const memberIds = useMemo(
    () => new Set(group?.items.map((i) => i.watchlistId) ?? []),
    [group]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return watchlistItems;
    const q = search.toLowerCase();
    return watchlistItems.filter(
      (item) =>
        item.ticker.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q)
    );
  }, [watchlistItems, search]);

  if (!open || !group) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/60">
          <h3 className="text-sm font-semibold text-zinc-100">
            Agregar a {group.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en watchlist..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">
              {watchlistItems.length === 0
                ? "No hay items en tu watchlist todavia"
                : "No se encontraron resultados"}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((item) => {
                const isMember = memberIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      isMember ? onRemove(item.id) : onAdd(item.id)
                    }
                    disabled={isPending}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                      isMember
                        ? "bg-blue-500/10 hover:bg-blue-500/15"
                        : "hover:bg-zinc-800/60"
                    )}
                  >
                    <div
                      className={cn(
                        "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                        isMember
                          ? "bg-blue-600 border-blue-500"
                          : "border-zinc-700 bg-zinc-800/60"
                      )}
                    >
                      {isMember && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold text-zinc-100">
                        {item.ticker}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {item.name}
                      </p>
                    </div>
                    <span className="text-[10px] text-zinc-600 shrink-0">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
