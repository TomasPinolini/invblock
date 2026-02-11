"use client";

import { Eye, EyeOff } from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";
import { cn } from "@/lib/utils";

export default function PrivacyToggle() {
  const privacyMode = useAppStore((s) => s.preferences.privacyMode);
  const toggle = useAppStore((s) => s.togglePrivacyMode);

  return (
    <button
      onClick={toggle}
      className={cn(
        "p-2 rounded-lg border transition-all duration-200",
        privacyMode
          ? "border-violet-500/40 bg-violet-500/15 text-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.1)]"
          : "border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
      )}
      title={privacyMode ? "Show values" : "Hide values (privacy mode)"}
      aria-label={privacyMode ? "Disable privacy mode" : "Enable privacy mode"}
      aria-pressed={privacyMode}
    >
      {privacyMode ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </button>
  );
}
