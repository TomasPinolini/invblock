"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React, { useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { useAutoSync } from "@/hooks/useAutoSync";

// Component that runs auto-sync on mount
function AutoSyncRunner({ children }: { children: React.ReactNode }) {
  useAutoSync();
  return <>{children}</>;
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
        <AutoSyncRunner>{children}</AutoSyncRunner>
      </ToastProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
