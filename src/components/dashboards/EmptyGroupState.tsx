"use client";

import { Inbox } from "lucide-react";

interface EmptyGroupStateProps {
  onAdd: () => void;
}

export function EmptyGroupState({ onAdd }: EmptyGroupStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center mb-4">
        <Inbox className="h-6 w-6 text-zinc-500" />
      </div>
      <p className="text-sm text-zinc-400 mb-1">This group is empty</p>
      <p className="text-xs text-zinc-500 mb-4">
        Add tickers from your watchlist to start tracking
      </p>
      <button
        onClick={onAdd}
        className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-colors"
      >
        Add Tickers
      </button>
    </div>
  );
}
