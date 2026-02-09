# Inngest - Background Jobs

This directory is reserved for Inngest background job functions.

## Planned Functions

```
inngest/
├── client.ts
└── functions/
    ├── sync-prices.ts      → Cron: fetch prices every 5 min
    ├── recalc-portfolio.ts → Event: on transaction, recalc avg price
    └── alert-threshold.ts  → Event: P&L exceeds threshold
```

## Setup

1. Install Inngest:
   ```bash
   npm install inngest
   ```

2. Create the client:
   ```typescript
   // inngest/client.ts
   import { Inngest } from "inngest";

   export const inngest = new Inngest({
     id: "financial-command-center",
   });
   ```

3. Create API route:
   ```typescript
   // src/app/api/inngest/route.ts
   import { serve } from "inngest/next";
   import { inngest } from "@/inngest/client";
   import { syncPrices, recalcPortfolio, alertThreshold } from "@/inngest/functions";

   export const { GET, POST, PUT } = serve({
     client: inngest,
     functions: [syncPrices, recalcPortfolio, alertThreshold],
   });
   ```

## Example Function

```typescript
// inngest/functions/sync-prices.ts
import { inngest } from "../client";
import { PriceService } from "@/services/prices";

export const syncPrices = inngest.createFunction(
  { id: "sync-prices" },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    const prices = await step.run("fetch-prices", async () => {
      return PriceService.fetchAll();
    });

    await step.run("update-cache", async () => {
      // Update price cache in database or Redis
    });

    return { updated: prices.length };
  }
);
```
