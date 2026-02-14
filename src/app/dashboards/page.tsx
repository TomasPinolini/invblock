"use client";

import { useState, useCallback } from "react";
import {
  LayoutDashboard,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GROUP_COLOR_MAP } from "@/lib/constants";
import type { GroupColor } from "@/lib/constants";
import type { WatchlistGroup } from "@/db/schema";
import { useWatchlist } from "@/hooks/useWatchlist";
import {
  useWatchlistGroups,
  useWatchlistGroupPrices,
  useCreateWatchlistGroup,
  useUpdateWatchlistGroup,
  useDeleteWatchlistGroup,
  useAddItemToGroup,
  useRemoveItemFromGroup,
} from "@/hooks/useWatchlistGroups";
import type { WatchlistGroupWithItems } from "@/hooks/useWatchlistGroups";
import { GroupTickerCard } from "@/components/dashboards/GroupTickerCard";
import { CreateGroupDialog } from "@/components/dashboards/CreateGroupDialog";
import { EditGroupDialog } from "@/components/dashboards/EditGroupDialog";
import { AddToGroupDialog } from "@/components/dashboards/AddToGroupDialog";
import { SkeletonCard } from "@/components/ui/Skeleton";

export default function DashboardsPage() {
  const { data: groups, isLoading, error } = useWatchlistGroups();
  const { data: watchlistItems } = useWatchlist();

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editGroup, setEditGroup] = useState<WatchlistGroup | null>(null);
  const [addToGroup, setAddToGroup] = useState<WatchlistGroupWithItems | null>(null);

  const createMutation = useCreateWatchlistGroup();
  const updateMutation = useUpdateWatchlistGroup();
  const deleteMutation = useDeleteWatchlistGroup();
  const addItemMutation = useAddItemToGroup();
  const removeItemMutation = useRemoveItemFromGroup();

  // Auto-select first group if none selected
  const resolvedActiveId =
    activeGroupId && groups?.some((g) => g.id === activeGroupId)
      ? activeGroupId
      : groups?.[0]?.id ?? null;

  const activeGroup = groups?.find((g) => g.id === resolvedActiveId) ?? null;

  const { data: priceData, isLoading: pricesLoading } =
    useWatchlistGroupPrices(resolvedActiveId);

  const handleCreate = useCallback(
    (name: string, color: GroupColor) => {
      createMutation.mutate(
        { name, color },
        {
          onSuccess: (newGroup) => {
            setShowCreate(false);
            setActiveGroupId(newGroup.id);
          },
        }
      );
    },
    [createMutation]
  );

  const handleEdit = useCallback(
    (name: string, color: GroupColor) => {
      if (!editGroup) return;
      updateMutation.mutate(
        { id: editGroup.id, data: { name, color } },
        { onSuccess: () => setEditGroup(null) }
      );
    },
    [editGroup, updateMutation]
  );

  const handleDelete = useCallback(() => {
    if (!activeGroup) return;
    if (!confirm(`Delete "${activeGroup.name}"? Items stay in your watchlist.`)) return;
    deleteMutation.mutate(activeGroup.id, {
      onSuccess: () => setActiveGroupId(null),
    });
  }, [activeGroup, deleteMutation]);

  const handleAddItem = useCallback(
    (watchlistId: string) => {
      if (!resolvedActiveId) return;
      addItemMutation.mutate({ groupId: resolvedActiveId, watchlistId });
    },
    [resolvedActiveId, addItemMutation]
  );

  const handleRemoveItemFromDialog = useCallback(
    (watchlistId: string) => {
      if (!resolvedActiveId) return;
      removeItemMutation.mutate({ groupId: resolvedActiveId, watchlistId });
    },
    [resolvedActiveId, removeItemMutation]
  );

  const handleRemoveItem = useCallback(
    (watchlistId: string) => {
      if (!resolvedActiveId) return;
      removeItemMutation.mutate({ groupId: resolvedActiveId, watchlistId });
    },
    [resolvedActiveId, removeItemMutation]
  );

  return (
    <div className="space-y-3">
      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 w-24 rounded-lg bg-zinc-800/60 animate-pulse" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error.message}
        </div>
      )}

      {/* Empty state — no groups yet */}
      {!isLoading && !error && groups && groups.length === 0 && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30">
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
              <LayoutDashboard className="h-6 w-6 text-blue-400/70" />
            </div>
            <p className="text-sm font-medium text-zinc-200 mb-1">
              Create your first dashboard
            </p>
            <p className="text-xs text-zinc-500 mb-5 max-w-[280px] leading-relaxed">
              Group your watchlist tickers into custom dashboards — like &quot;Tech&quot;, &quot;Dividends&quot;, or &quot;To Buy&quot;
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Group
            </button>
          </div>
        </div>
      )}

      {/* Groups exist */}
      {!isLoading && !error && groups && groups.length > 0 && (
        <>
          {/* Combined tab bar + actions in a card */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-2">
            <div className="flex items-center gap-2">
              {/* Group tabs */}
              <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-none">
                {groups.map((group) => {
                  const isActive = group.id === resolvedActiveId;
                  const colors = GROUP_COLOR_MAP[group.color as GroupColor] ?? GROUP_COLOR_MAP.blue;

                  return (
                    <button
                      key={group.id}
                      onClick={() => setActiveGroupId(group.id)}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap",
                        isActive
                          ? `${colors.bg} ${colors.text} ${colors.border} border`
                          : "text-zinc-400 border border-transparent hover:text-zinc-200 hover:bg-zinc-800/60"
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full shrink-0", colors.dot)} />
                      {group.name}
                      <span className="text-[10px] opacity-50">
                        {group.items.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0 border-l border-zinc-800/60 pl-2 ml-1">
                {activeGroup && (
                  <>
                    <button
                      onClick={() => setAddToGroup(activeGroup)}
                      className="p-1.5 rounded-md text-blue-400 hover:bg-blue-500/10 transition-colors"
                      title="Add tickers"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditGroup(activeGroup)}
                      className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                      title="Edit group"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete group"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowCreate(true)}
                  className="p-1.5 rounded-md text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  title="New group"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Active group content */}
          {activeGroup && (
            <>
              {activeGroup.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-900/20">
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <div className="h-10 w-10 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center mb-3">
                      <Star className="h-5 w-5 text-zinc-600" />
                    </div>
                    <p className="text-xs text-zinc-400 mb-1">
                      No tickers in <span className="font-medium text-zinc-300">{activeGroup.name}</span>
                    </p>
                    <p className="text-[11px] text-zinc-600 mb-4">
                      Add from your watchlist to see live prices here
                    </p>
                    <button
                      onClick={() => setAddToGroup(activeGroup)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add Tickers
                    </button>
                  </div>
                </div>
              ) : pricesLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {Array.from({ length: activeGroup.items.length }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {(priceData?.securities ?? []).map((sec) => (
                    <GroupTickerCard
                      key={sec._watchlistId}
                      security={sec}
                      onRemove={() => handleRemoveItem(sec._watchlistId)}
                      isRemoving={removeItemMutation.isPending}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Dialogs */}
      <CreateGroupDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
      />

      <EditGroupDialog
        group={editGroup}
        open={!!editGroup}
        onClose={() => setEditGroup(null)}
        onSubmit={handleEdit}
        isPending={updateMutation.isPending}
      />

      <AddToGroupDialog
        open={!!addToGroup}
        onClose={() => setAddToGroup(null)}
        group={addToGroup}
        watchlistItems={watchlistItems ?? []}
        onAdd={handleAddItem}
        onRemove={handleRemoveItemFromDialog}
        isPending={addItemMutation.isPending || removeItemMutation.isPending}
      />
    </div>
  );
}
