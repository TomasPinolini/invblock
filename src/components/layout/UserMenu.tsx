"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { LogOut, User, Loader2, Settings } from "lucide-react";

export default function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="h-9 w-9 rounded-lg bg-zinc-800 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <button
        onClick={() => router.push("/auth/login")}
        className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500
                   text-white text-sm font-medium transition-colors"
      >
        Sign in
      </button>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800">
        <div className="h-6 w-6 rounded-full bg-blue-600/20 flex items-center justify-center">
          <User className="h-3.5 w-3.5 text-blue-400" />
        </div>
        <span className="text-sm text-zinc-400 max-w-[150px] truncate">
          {user.email}
        </span>
      </div>
      <button
        onClick={() => router.push("/settings")}
        className="h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900/50
                   text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800
                   transition-colors flex items-center justify-center"
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </button>
      <button
        onClick={handleSignOut}
        className="h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900/50
                   text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800
                   transition-colors flex items-center justify-center"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
