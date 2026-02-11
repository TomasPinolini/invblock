"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React, { useState, useEffect } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { useAutoSync } from "@/hooks/useAutoSync";
import { useAppStore } from "@/stores/useAppStore";

// Component that runs auto-sync on mount
function AutoSyncRunner({ children }: { children: React.ReactNode }) {
  useAutoSync();
  return <>{children}</>;
}

// Sync privacy mode to a data attribute on <body> so CSS can target it globally
function PrivacyModeSync() {
  const privacyMode = useAppStore((s) => s.preferences.privacyMode);
  useEffect(() => {
    document.body.setAttribute("data-privacy", privacyMode ? "on" : "off");
  }, [privacyMode]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <PrivacyModeSync />
        <AutoSyncRunner>{children}</AutoSyncRunner>
      </ToastProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
