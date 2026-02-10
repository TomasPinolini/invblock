---
name: create-hook
description: Create a new TanStack Query hook following project conventions (staleTime, query keys, error handling, TypeScript types). Use when adding a new data fetching hook.
user-invocable: true
argument-hint: [hook-name] [api-endpoint]
allowed-tools: Write, Read, Grep, Glob
---

# Create TanStack Query Hook

Create a new hook: `$ARGUMENTS`

## Before You Start

1. Check existing hooks in `src/hooks/` for naming conventions
2. Verify the API endpoint exists (or create it first with `/create-api-route`)
3. Read the API response shape to define TypeScript types

## Query Key Conventions

Use descriptive, unique keys. Existing keys in this project:

| Key | Hook | Purpose |
|-----|------|---------|
| `["assets"]` | useAssets | Portfolio assets from DB |
| `["iol-portfolio"]` | useIOLPortfolio | Live IOL portfolio |
| `["iol-balance"]` | useIOLBalance | Account balance |
| `["iol-quotes", tickerKey]` | useIOLQuotes | Live quotes (batch) |
| `["iol-quote", symbol, market]` | useIOLQuote | Single quote |
| `["iol-operations"]` | useIOLOperations | Trade history |
| `["iol-securities"]` | useIOLSecurities | Security search |
| `["iol-historical", symbol]` | useIOLHistorical | IOL price history |
| `["binance-portfolio"]` | useBinancePortfolio | Binance portfolio |
| `["price-alerts"]` | usePriceAlerts | User alerts |
| `["historical-prices", ticker]` | useHistoricalPrices | Yahoo price history |

## Hook Template

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";

// ── Types ──────────────────────────────────────────────────────────

interface MyResponse {
  data: MyData;
  error?: string;
}

interface MyData {
  // Typed fields matching API response
}

// ── Fetch function ─────────────────────────────────────────────────

async function fetchMyData(params?: MyParams): Promise<MyResponse> {
  const searchParams = new URLSearchParams();
  if (params?.filter) searchParams.set("filter", params.filter);

  const res = await fetch(`/api/my-endpoint?${searchParams}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch data");
  }

  return data;
}

// ── Hook ───────────────────────────────────────────────────────────

export function useMyHook(params?: MyParams, enabled = true) {
  return useQuery({
    queryKey: ["my-key", params],
    queryFn: () => fetchMyData(params),
    enabled,
    staleTime: 2 * 60 * 1000,      // 2 minutes (adjust per data type)
    refetchOnWindowFocus: true,      // true for live data
  });
}
```

## StaleTime Guidelines

| Data Type | staleTime | refetchOnWindowFocus | refetchInterval |
|-----------|-----------|---------------------|-----------------|
| Live prices/quotes | 2 min | true | 3 min |
| Account balance | 5 min | true | — |
| Historical data | 5 min | false | — |
| Static lists (types, managers) | 30 min | false | — |
| User config (alerts, settings) | 2 min | true | — |
| Operations/trades | 2 min | true | — |

## For Mutation Hooks (POST/PUT/DELETE)

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useMyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: MyInput) => {
      const res = await fetch("/api/my-endpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Operation failed");
      return result;
    },
    onSuccess: () => {
      // Invalidate related queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["affected-key"] });
    },
  });
}
```

## Checklist

- [ ] File starts with `"use client";`
- [ ] Response types are fully defined (no `any`)
- [ ] Fetch function checks `res.ok` and throws with error message
- [ ] Query key is unique and descriptive (check list above for conflicts)
- [ ] `staleTime` is set explicitly (never rely on default 0)
- [ ] `enabled` parameter exists if hook should be conditional
- [ ] Mutations invalidate all affected query keys
- [ ] IMPORTANT: Use correct query keys for invalidation:
  - IOL portfolio = `["iol-portfolio"]` (NOT `["portfolio"]`)
  - Binance portfolio = `["binance-portfolio"]`
- [ ] File placed at `src/hooks/useMyHook.ts`
- [ ] Hook is exported (named export, not default)
