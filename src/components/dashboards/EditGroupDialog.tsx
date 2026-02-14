"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { ColorPicker } from "./ColorPicker";
import type { GroupColor } from "@/lib/constants";
import type { WatchlistGroup } from "@/db/schema";

interface EditGroupDialogProps {
  group: WatchlistGroup | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: GroupColor) => void;
  isPending?: boolean;
}

export function EditGroupDialog({
  group,
  open,
  onClose,
  onSubmit,
  isPending,
}: EditGroupDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<GroupColor>("blue");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && group) {
      setName(group.name);
      setColor(group.color as GroupColor);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, group]);

  if (!open || !group) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, color);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-100">Edit Group</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Name</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isPending}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
