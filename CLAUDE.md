# Financial Command Center — Project Context

## What This Is

A Next.js 16 app for portfolio tracking with IOL (InvertirOnline) Argentine broker, Binance crypto, Yahoo Finance historical data, and AI-powered insights via Claude API. Uses Supabase (PostgreSQL + Auth + Edge Functions), Drizzle ORM, Zustand, TanStack Query, Tailwind CSS v4, and Radix UI.

**CRITICAL**: Trading endpoints handle REAL MONEY on the IOL broker. Treat all financial code paths with maximum care.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript (strict) | 5.x |
| Database | PostgreSQL via Supabase | - |
| ORM | Drizzle ORM | 0.45.x |
| Auth | Supabase Auth | 2.95.x |
| State | Zustand (persisted) | 5.x |
| Data Fetching | TanStack Query | 5.x |
| Styling | Tailwind CSS v4 | 4.x |
| UI Primitives | Radix UI | latest |
| Forms | React Hook Form + Zod | 7.x / 4.x |
| Icons | lucide-react | 0.563.x |

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (all require auth)
│   │   ├── assets/         # CRUD for portfolio assets
│   │   ├── transactions/   # CRUD for transactions
│   │   ├── alerts/         # Price alert CRUD
│   │   ├── iol/            # IOL broker integration
│   │   │   ├── auth/       # Connect/disconnect IOL
│   │   │   ├── balance/    # Account balance
│   │   │   ├── historical/ # Historical price data
│   │   │   ├── notifications/ # IOL notifications
│   │   │   ├── operations/ # Trade history
│   │   │   ├── portfolio/  # Live portfolio
│   │   │   ├── quote/      # Live quotes (single + batch)
│   │   │   ├── securities/ # Security search/explore
│   │   │   ├── sync/       # Portfolio sync to DB
│   │   │   ├── trade/      # BUY/SELL/CANCEL orders ⚠️ REAL MONEY
│   │   │   └── transactions/ # Transaction sync
│   │   ├── binance/        # Binance crypto integration
│   │   │   ├── auth/       # Store/delete API keys
│   │   │   ├── portfolio/  # Live crypto portfolio
│   │   │   ├── status/     # Connection status
│   │   │   └── sync/       # Portfolio sync to DB
│   │   ├── prices/         # Yahoo Finance historical prices
│   │   └── insights/       # AI analysis (Claude API + PDF)
│   ├── auth/               # Login page + callback
│   ├── explore/            # Browse IOL securities
│   ├── history/            # Trade operations history
│   ├── insights/           # AI market analysis
│   ├── settings/           # Broker connections config
│   ├── layout.tsx          # Root layout (dark mode)
│   ├── page.tsx            # Dashboard
│   └── providers.tsx       # TanStack Query + auto-sync
├── components/
│   ├── portfolio/          # PortfolioTable, Summary, AllocationBar, etc.
│   ├── forms/              # AssetEntry, TransactionEntry, PriceAlerts
│   ├── layout/             # Header, NotificationBell, UserMenu
│   ├── history/            # OperationsTable
│   └── ui/                 # Toast, Skeleton, ErrorBoundary
├── db/
│   ├── schema.ts           # Drizzle tables: assets, transactions, userConnections
│   └── index.ts            # Drizzle client (postgres.js)
├── hooks/                  # TanStack Query hooks (16 files)
├── lib/
│   ├── auth.ts             # getAuthUser(), requireAuth()
│   ├── constants.ts        # Enums, MOCK_PRICES, MOCK_USD_ARS_RATE
│   ├── validators.ts       # Zod schemas
│   ├── utils.ts            # formatCurrency, formatPercent, cn()
│   └── supabase/           # client.ts (browser), server.ts (server)
├── services/
│   ├── iol/                # IOL broker client (auth, trade, quotes, etc.)
│   ├── binance/            # Binance client (HMAC signing, portfolio)
│   └── yahoo/              # Yahoo Finance client (historical prices)
└── stores/
    └── useAppStore.ts      # Zustand: preferences, sync status, UI state
supabase/
└── functions/              # Edge Functions (daily-report, price-alerts, etc.)
```

## Coding Conventions

### API Routes

Every API route MUST follow this pattern:

```typescript
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Business logic here
    // Always scope queries to user.id
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[Route Name] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operation failed" },
      { status: 500 }
    );
  }
}
```

### IOL-Connected Routes

Routes that call the IOL API also need credential loading and token refresh:

```typescript
// Load credentials
const connection = await db.query.userConnections.findFirst({
  where: and(
    eq(userConnections.userId, user.id),
    eq(userConnections.provider, "iol")
  ),
});
if (!connection) {
  return NextResponse.json({ error: "IOL account not connected" }, { status: 400 });
}
const token = JSON.parse(connection.credentials);
const client = new IOLClient(token);

// ... use client ...

// Update token if refreshed
const newToken = client.getToken();
if (newToken && newToken.access_token !== token.access_token) {
  await db.update(userConnections).set({
    credentials: JSON.stringify(newToken),
    updatedAt: new Date(),
  }).where(eq(userConnections.id, connection.id));
}
```

### TanStack Query Hooks

Every hook follows this pattern:

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";

interface ResponseType { /* typed response */ }

async function fetchData(): Promise<ResponseType> {
  const res = await fetch("/api/endpoint");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch");
  return data;
}

export function useMyHook() {
  return useQuery({
    queryKey: ["my-key"],       // Unique, descriptive key
    queryFn: fetchData,
    staleTime: 2 * 60 * 1000,  // 2-5 minutes typical
    refetchOnWindowFocus: true, // true for live data, false for historical
  });
}
```

**Query key conventions**:
- `["assets"]` — portfolio assets
- `["iol-portfolio"]` — IOL live portfolio
- `["iol-balance"]` — IOL account balance
- `["iol-quotes", tickerKey]` — live quotes
- `["iol-operations"]` — trade operations
- `["binance-portfolio"]` — Binance portfolio
- `["price-alerts"]` — user alerts

### Components

- Dark theme: `bg-zinc-950`, `text-zinc-100`, borders `border-zinc-800`
- Cards: `rounded-xl border border-zinc-800 bg-zinc-900/50 p-3`
- Fonts: `font-mono` for numbers/prices, `font-sans` for text
- Colors: green `text-emerald-400` for positive, red `text-red-400` for negative
- Icons: lucide-react, size `h-3.5 w-3.5` to `h-5 w-5`
- Responsive: `hidden sm:table-cell` to hide columns on mobile

### Validation

Use Zod for all input validation. Schemas live in `src/lib/validators.ts`:

```typescript
import { z } from "zod";

export const mySchema = z.object({
  field: z.string().min(1, "Required").max(100),
  amount: z.number({ coerce: true }).positive().finite(),
});
```

## Security Rules

1. **NEVER** commit `.env.local`, `docs/secrets.txt`, or any API keys
2. **NEVER** log credential values — only log that credentials were accessed
3. **ALL** API routes must check `getAuthUser()` first
4. **ALL** database queries must be scoped to `user.id`
5. **Trading endpoints** (`/api/iol/trade`) require extra care:
   - Validate all inputs (action, mercado, simbolo, cantidad, precio)
   - Log all trade attempts for audit
   - Token refresh pattern must be present
6. Credentials in `user_connections.credentials` — currently stored as JSON (encryption TODO)
7. The `docs/secrets.txt` file contains Binance keys and Resend API key — git-ignored

## Known Issues

- `MOCK_USD_ARS_RATE = 1250` is hardcoded in 3 components (needs dynamic rate)
- `MOCK_PRICES` in constants.ts still exists (live quotes are primary now)
- IOL API only works during Argentine market hours (11:00-17:00 ART)
- `useIOLTrade` invalidates wrong query key `["portfolio"]` instead of `["iol-portfolio"]`
- Credentials stored as plaintext JSON (encryption not yet implemented)
- Zero test files exist — testing infrastructure not set up yet
- `next.config.ts` is empty — no optimizations configured
- ErrorBoundary component exists but is not used anywhere

## Environment Variables

Required in `.env.local` (never commit values):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (safe for client)
- `SUPABASE_SERVICE_ROLE_KEY` — Server-only, never expose to client
- `DATABASE_URL` — PostgreSQL connection string (use pooler mode)
- `ANTHROPIC_API_KEY` — For AI insights feature

## Git Workflow

- `master` — production branch
- `dev` — development branch (current)
- Always work on `dev`, PR to `master`
