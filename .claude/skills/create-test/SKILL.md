---
name: create-test
description: Generate Vitest unit tests for a given file. Creates comprehensive tests covering happy paths, edge cases, error scenarios, and financial calculation accuracy. Use when writing tests for hooks, utils, services, or API routes.
user-invocable: true
argument-hint: [file-path]
allowed-tools: Write, Read, Grep, Glob
---

# Create Tests

Write tests for: `$ARGUMENTS`

## Before You Start

1. Read the target file thoroughly — understand every function and branch
2. Check if Vitest is configured. If not, check for `vitest.config.ts` and `vitest` in package.json. If missing, tell the user they need to run:
   ```
   npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
   ```
3. Determine test type:
   - **Utility functions** (`src/lib/`) → Pure unit tests
   - **Hooks** (`src/hooks/`) → React Testing Library + mock fetch
   - **Services** (`src/services/`) → Mock fetch/crypto, test logic
   - **API routes** (`src/app/api/`) → Mock DB + auth, test handlers
   - **Components** (`src/components/`) → React Testing Library + render

## Test File Location

Place tests next to the source file with `.test.ts` or `.test.tsx` suffix:
- `src/lib/utils.ts` → `src/lib/utils.test.ts`
- `src/hooks/useIOLBalance.ts` → `src/hooks/useIOLBalance.test.ts`
- `src/services/iol/client.ts` → `src/services/iol/client.test.ts`
- `src/components/portfolio/AccountBalanceCards.tsx` → `src/components/portfolio/AccountBalanceCards.test.tsx`

## Test Template — Utility Functions

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "./myFile";

describe("myFunction", () => {
  // Happy path
  it("returns expected result for valid input", () => {
    expect(myFunction("input")).toBe("expected");
  });

  // Edge cases
  it("handles empty input", () => {
    expect(myFunction("")).toBe("");
  });

  it("handles null/undefined", () => {
    expect(myFunction(null as any)).toBe(/* fallback */);
  });

  // Boundary values
  it("handles zero", () => {
    expect(myFunction(0)).toBe("$0.00");
  });

  it("handles negative numbers", () => {
    expect(myFunction(-100)).toBe("-$100.00");
  });

  it("handles very large numbers", () => {
    expect(myFunction(999999999.99)).toMatch(/999,999,999/);
  });
});
```

## Test Template — TanStack Query Hooks

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMyHook } from "./useMyHook";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useMyHook", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("fetches data successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: "test" }),
    });

    const { result } = renderHook(() => useMyHook(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ data: "test" });
  });

  it("handles API errors", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not found" }),
    });

    const { result } = renderHook(() => useMyHook(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("Not found");
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useMyHook(undefined, false), {
      wrapper: createWrapper(),
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

## Financial Calculation Tests — CRITICAL

When testing code that handles money (formatCurrency, convertToDisplay, P&L calculations), be exhaustive:

```typescript
describe("formatCurrency", () => {
  // Precision matters for money
  it("rounds to 2 decimal places", () => {
    expect(formatCurrency(10.005, "USD")).toBe("$10.01");
    expect(formatCurrency(10.004, "USD")).toBe("$10.00");
  });

  // ARS formatting uses es-AR locale
  it("formats ARS with Argentine locale", () => {
    expect(formatCurrency(1250.5, "ARS")).toMatch(/1\.250,50/);
  });

  // Edge: zero, negative, very small
  it("formats zero correctly", () => {
    expect(formatCurrency(0, "USD")).toBe("$0.00");
  });

  // Crypto: high precision needed
  it("handles crypto-scale decimals", () => {
    expect(formatQuantity(0.00000001, 8)).toBe("0.00000001");
  });
});

describe("P&L calculations", () => {
  it("calculates positive P&L", () => {
    const costBasis = 100 * 50; // 100 shares at $50
    const currentValue = 100 * 60; // Now at $60
    const pnl = currentValue - costBasis;
    expect(pnl).toBe(1000);
    expect((pnl / costBasis) * 100).toBe(20); // 20%
  });

  it("handles zero cost basis without division by zero", () => {
    const pnlPercent = 0 > 0 ? (100 / 0) * 100 : 0;
    expect(pnlPercent).toBe(0);
  });
});
```

## What to Test for Each File Type

### `src/lib/utils.ts`
- formatCurrency: USD + ARS, zero, negative, large numbers, rounding
- formatPercent: positive sign, negative, zero
- formatQuantity: integer, decimals, crypto precision
- cn: combines classes, filters falsy values

### `src/lib/validators.ts`
- Valid inputs pass
- Empty required fields fail
- Negative amounts fail
- Overflow values fail
- SQL injection attempts in strings are handled
- XSS attempts in strings are sanitized by transform

### `src/services/iol/client.ts`
- Token refresh triggers at 5-min buffer
- 401 response triggers token refresh
- Retry only happens once (no infinite loop)
- API methods construct correct URLs
- IOLTokenExpiredError is thrown when refresh fails

### `src/services/binance/client.ts`
- HMAC signature generation is correct
- Stablecoin filtering works
- Dust balance filtering (< $1) works
- Zero-balance assets are excluded

## Checklist

- [ ] Test file is next to source file with `.test.ts(x)` extension
- [ ] All exported functions have at least one test
- [ ] Happy path, edge cases, and error scenarios covered
- [ ] Financial calculations tested with precision checks
- [ ] Mock fetch/DB properly reset between tests (`beforeEach`)
- [ ] No hardcoded API responses that could go stale
- [ ] Tests are independent (no shared mutable state)
