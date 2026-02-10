---
name: create-api-route
description: Scaffold a new Next.js API route with authentication, Zod validation, error handling, and IOL credential loading. Use when the user asks to create a new API endpoint or route handler.
user-invocable: true
argument-hint: [method] [path] [description]
allowed-tools: Write, Read, Grep, Glob
---

# Create API Route

Create a new API route: `$ARGUMENTS`

## Before You Start

1. Read `src/db/schema.ts` to understand the database schema
2. Read `src/lib/auth.ts` for the auth pattern
3. Check if a similar route exists in `src/app/api/` to follow its patterns
4. Read `src/lib/validators.ts` if you need to add a Zod schema

## Route Template

Every route MUST include:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db";
import { eq, and } from "drizzle-orm";

export async function METHOD(request: NextRequest) {
  // 1. Auth check — ALWAYS FIRST
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Input validation with Zod (for POST/PATCH/PUT)
    const body = await request.json();
    const parsed = mySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Business logic — ALWAYS scope to user.id
    const result = await db.query.myTable.findMany({
      where: eq(myTable.userId, user.id),
    });

    // 4. Success response
    return NextResponse.json({ data: result });
  } catch (error) {
    // 5. Error handling — log with route name prefix
    console.error("[RouteName] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operation failed" },
      { status: 500 }
    );
  }
}
```

## If Route Needs IOL API Access

Add this block after auth check, before business logic:

```typescript
import { IOLClient } from "@/services/iol";
import { userConnections } from "@/db/schema";

// Load IOL credentials
const connection = await db.query.userConnections.findFirst({
  where: and(
    eq(userConnections.userId, user.id),
    eq(userConnections.provider, "iol")
  ),
});

if (!connection) {
  return NextResponse.json(
    { error: "IOL account not connected" },
    { status: 400 }
  );
}

const token = JSON.parse(connection.credentials);
const client = new IOLClient(token);

// ... use client ...

// After IOL calls: update token if refreshed
const newToken = client.getToken();
if (newToken && newToken.access_token !== token.access_token) {
  await db.update(userConnections).set({
    credentials: JSON.stringify(newToken),
    updatedAt: new Date(),
  }).where(eq(userConnections.id, connection.id));
}
```

## If Route Needs Binance API Access

Same pattern but with `provider: "binance"` and `BinanceClient`:

```typescript
import { BinanceClient } from "@/services/binance";

// credentials = { apiKey, apiSecret }
const { apiKey, apiSecret } = JSON.parse(connection.credentials);
const client = new BinanceClient({ apiKey, apiSecret });
```

## Zod Schema

If the route accepts POST/PATCH/PUT body, add a Zod schema to `src/lib/validators.ts`:

```typescript
export const myRouteSchema = z.object({
  requiredField: z.string().min(1, "Required"),
  amount: z.number({ coerce: true }).positive("Must be positive").finite(),
  optionalField: z.string().max(500).optional(),
});
```

## Checklist

Before finishing, verify:

- [ ] `getAuthUser()` is called first and returns 401 if null
- [ ] All DB queries are scoped to `user.id`
- [ ] Input is validated with Zod (for POST/PATCH/PUT)
- [ ] Errors are caught and logged with `console.error("[RouteName]", error)`
- [ ] Error responses use proper HTTP status codes (400, 401, 500)
- [ ] No credentials, tokens, or secrets are logged
- [ ] File is placed at `src/app/api/{path}/route.ts`
