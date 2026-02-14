"use client";

import { useRef } from "react";
import { GROUP_COLOR_MAP } from "@/lib/constants";
import type { GroupColor } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { WatchlistGroupWithItems } from "@/hooks/useWatchlistGroups";

interface GroupTabBarProps {
  groups: WatchlistGroupWithItems[];
  activeGroupId: string | null;
  onSelect: (groupId: string) => void;
}

export function GroupTabBar({ groups, activeGroupId, onSelect }: GroupTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (groups.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none"
      role="tablist"
    >
      {groups.map((group) => {
        const isActive = group.id === activeGroupId;
        const colors = GROUP_COLOR_MAP[group.color as GroupColor] ?? GROUP_COLOR_MAP.blue;

        return (
          <button
            key={group.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(group.id)}
            className={cn(
              "shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 whitespace-nowrap",
              isActive
                ? `${colors.bg} ${colors.text} ${colors.border}`
                : "text-zinc-400 border-transparent hover:text-zinc-200 hover:bg-zinc-800/60 hover:border-zinc-700/40"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full shrink-0", colors.dot)} />
            {group.name}
            <span className="text-[10px] opacity-60">
              {group.items.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}
