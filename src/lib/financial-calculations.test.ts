import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercent } from "./utils";

// ---------------------------------------------------------------------------
// Pure calculation helpers extracted from src/app/api/transactions/route.ts
// These mirror the exact logic used in the POST handler's db.transaction block.
// ---------------------------------------------------------------------------

/**
 * Calculate new quantity and average price after a BUY transaction.
 *
 * From transactions/route.ts:
 *   totalCost = currentQty * currentAvgPrice + quantity * pricePerUnit
 *   newQty    = currentQty + quantity
 *   newAvgPrice = newQty > 0 ? totalCost / newQty : 0
 */
function calculateBuy(
  currentQty: number,
  currentAvgPrice: number,
  buyQty: number,
  buyPrice: number
): { newQty: number; newAvgPrice: number } {
  const totalCost = currentQty * currentAvgPrice + buyQty * buyPrice;
  const newQty = currentQty + buyQty;
  const newAvgPrice = newQty > 0 ? totalCost / newQty : 0;
  return { newQty, newAvgPrice };
}

/**
 * Calculate new quantity and average price after a SELL transaction.
 *
 * From transactions/route.ts:
 *   newQty      = Math.max(0, currentQty - quantity)
 *   newAvgPrice = currentAvgPrice  (unchanged)
 */
function calculateSell(
  currentQty: number,
  currentAvgPrice: number,
  sellQty: number
): { newQty: number; newAvgPrice: number } {
  const newQty = Math.max(0, currentQty - sellQty);
  const newAvgPrice = currentAvgPrice;
  return { newQty, newAvgPrice };
}

// ===========================================================================
// 1. Average Price Calculation Tests
// ===========================================================================

describe("Average Price Calculation — Buy Logic", () => {
  it("first buy: 0 shares -> buy 10 at $100 -> avg = $100", () => {
    const { newQty, newAvgPrice } = calculateBuy(0, 0, 10, 100);
    expect(newQty).toBe(10);
    expect(newAvgPrice).toBe(100);
  });

  it("second buy: 10 shares at $100 -> buy 10 at $200 -> avg = $150", () => {
    const { newQty, newAvgPrice } = calculateBuy(10, 100, 10, 200);
    expect(newQty).toBe(20);
    expect(newAvgPrice).toBe(150);
  });

  it("third buy: 20 shares at $150 -> buy 5 at $50 -> avg = $130", () => {
    const { newQty, newAvgPrice } = calculateBuy(20, 150, 5, 50);
    expect(newQty).toBe(25);
    // (20*150 + 5*50) / 25 = (3000+250)/25 = 3250/25 = 130
    expect(newAvgPrice).toBe(130);
  });

  it("buying zero shares does not change anything", () => {
    const { newQty, newAvgPrice } = calculateBuy(10, 100, 0, 500);
    expect(newQty).toBe(10);
    expect(newAvgPrice).toBe(100);
  });

  it("handles very cheap per-unit price", () => {
    const { newQty, newAvgPrice } = calculateBuy(0, 0, 1000, 0.01);
    expect(newQty).toBe(1000);
    expect(newAvgPrice).toBeCloseTo(0.01, 10);
  });

  it("handles very expensive per-unit price", () => {
    const { newQty, newAvgPrice } = calculateBuy(0, 0, 1, 500_000);
    expect(newQty).toBe(1);
    expect(newAvgPrice).toBe(500_000);
  });

  it("weighted average favors larger position", () => {
    // 100 shares at $10, buy 1 share at $110 => avg shifts slightly
    const { newQty, newAvgPrice } = calculateBuy(100, 10, 1, 110);
    expect(newQty).toBe(101);
    // (100*10 + 1*110) / 101 = 1110/101 ~ 10.99
    expect(newAvgPrice).toBeCloseTo(10.9901, 3);
  });

  it("equal quantities produces simple average of prices", () => {
    const { newAvgPrice } = calculateBuy(50, 80, 50, 120);
    // (50*80 + 50*120) / 100 = (4000+6000)/100 = 100
    expect(newAvgPrice).toBe(100);
  });
});

describe("Average Price Calculation — Sell Logic", () => {
  it("sell does not change average price", () => {
    const { newQty, newAvgPrice } = calculateSell(25, 130, 10);
    expect(newQty).toBe(15);
    expect(newAvgPrice).toBe(130);
  });

  it("sell all shares: quantity becomes 0, avg price preserved", () => {
    // The route keeps currentAvgPrice on sell, even when newQty = 0
    const { newQty, newAvgPrice } = calculateSell(25, 130, 25);
    expect(newQty).toBe(0);
    expect(newAvgPrice).toBe(130);
  });

  it("oversell is clamped to 0 (Math.max guard)", () => {
    const { newQty, newAvgPrice } = calculateSell(10, 50, 15);
    expect(newQty).toBe(0);
    expect(newAvgPrice).toBe(50);
  });

  it("sell zero shares changes nothing", () => {
    const { newQty, newAvgPrice } = calculateSell(10, 100, 0);
    expect(newQty).toBe(10);
    expect(newAvgPrice).toBe(100);
  });

  it("partial sell preserves exact average", () => {
    const { newQty, newAvgPrice } = calculateSell(1000, 42.37, 999);
    expect(newQty).toBe(1);
    expect(newAvgPrice).toBe(42.37);
  });
});

describe("Average Price Calculation — Tiny Crypto Quantities", () => {
  it("buy 0.00001 BTC at $100,000", () => {
    const { newQty, newAvgPrice } = calculateBuy(0, 0, 0.00001, 100_000);
    expect(newQty).toBeCloseTo(0.00001, 10);
    expect(newAvgPrice).toBeCloseTo(100_000, 5);
  });

  it("accumulate tiny BTC buys at different prices", () => {
    // First buy: 0.001 BTC at $95,000
    const after1 = calculateBuy(0, 0, 0.001, 95_000);
    expect(after1.newQty).toBeCloseTo(0.001, 10);
    expect(after1.newAvgPrice).toBe(95_000);

    // Second buy: 0.002 BTC at $100,000
    const after2 = calculateBuy(after1.newQty, after1.newAvgPrice, 0.002, 100_000);
    expect(after2.newQty).toBeCloseTo(0.003, 10);
    // (0.001*95000 + 0.002*100000) / 0.003 = (95+200)/0.003 = 295/0.003 = 98333.33...
    expect(after2.newAvgPrice).toBeCloseTo(98_333.3333, 2);
  });

  it("sell fractional crypto preserves average", () => {
    const { newQty, newAvgPrice } = calculateSell(0.5, 60_000, 0.123);
    expect(newQty).toBeCloseTo(0.377, 10);
    expect(newAvgPrice).toBe(60_000);
  });
});

describe("Average Price Calculation — Multi-Step Scenarios", () => {
  it("full lifecycle: buy -> buy -> sell partial -> buy -> sell all", () => {
    // Step 1: buy 10 at $100
    const s1 = calculateBuy(0, 0, 10, 100);
    expect(s1.newQty).toBe(10);
    expect(s1.newAvgPrice).toBe(100);

    // Step 2: buy 10 at $200
    const s2 = calculateBuy(s1.newQty, s1.newAvgPrice, 10, 200);
    expect(s2.newQty).toBe(20);
    expect(s2.newAvgPrice).toBe(150);

    // Step 3: sell 5 (avg stays at 150)
    const s3 = calculateSell(s2.newQty, s2.newAvgPrice, 5);
    expect(s3.newQty).toBe(15);
    expect(s3.newAvgPrice).toBe(150);

    // Step 4: buy 5 at $50
    const s4 = calculateBuy(s3.newQty, s3.newAvgPrice, 5, 50);
    expect(s4.newQty).toBe(20);
    // (15*150 + 5*50) / 20 = (2250+250)/20 = 2500/20 = 125
    expect(s4.newAvgPrice).toBe(125);

    // Step 5: sell all
    const s5 = calculateSell(s4.newQty, s4.newAvgPrice, 20);
    expect(s5.newQty).toBe(0);
    expect(s5.newAvgPrice).toBe(125);
  });

  it("ARS bond scenario with large quantities", () => {
    // Buy 10,000 AL30 at ARS 68,000
    const s1 = calculateBuy(0, 0, 10_000, 68_000);
    expect(s1.newAvgPrice).toBe(68_000);

    // Buy 5,000 more at ARS 70,000
    const s2 = calculateBuy(s1.newQty, s1.newAvgPrice, 5_000, 70_000);
    expect(s2.newQty).toBe(15_000);
    // (10000*68000 + 5000*70000) / 15000 = (680M + 350M) / 15000 = 68666.67
    expect(s2.newAvgPrice).toBeCloseTo(68_666.6667, 2);
  });
});

describe("Average Price Calculation — Edge Cases", () => {
  it("division by zero guard: buy 0 qty when starting from 0", () => {
    const { newQty, newAvgPrice } = calculateBuy(0, 0, 0, 100);
    expect(newQty).toBe(0);
    expect(newAvgPrice).toBe(0); // guarded by newQty > 0 check
  });

  it("handles floating point precision reasonably", () => {
    // 3 shares at $33.33 each -> totalCost = 99.99
    // Buy 1 at $33.34 -> totalCost = 99.99 + 33.34 = 133.33
    // newAvg = 133.33 / 4 = 33.3325
    const { newAvgPrice } = calculateBuy(3, 33.33, 1, 33.34);
    expect(newAvgPrice).toBeCloseTo(33.3325, 4);
  });

  it("buy at $0 price lowers the average", () => {
    // E.g., stock split or bonus shares at zero cost
    const { newQty, newAvgPrice } = calculateBuy(10, 100, 10, 0);
    expect(newQty).toBe(20);
    // (10*100 + 10*0) / 20 = 1000/20 = 50
    expect(newAvgPrice).toBe(50);
  });
});

// ===========================================================================
// 2. formatCurrency Edge Cases
// ===========================================================================

describe("formatCurrency — edge cases", () => {
  it("formats zero value", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative value", () => {
    expect(formatCurrency(-1234.56)).toBe("-$1,234.56");
  });

  it("formats very large value (> 1 billion)", () => {
    const result = formatCurrency(1_500_000_000);
    expect(result).toBe("$1,500,000,000.00");
  });

  it("formats very small value (< 0.01)", () => {
    // Intl.NumberFormat with max 2 decimals rounds to $0.00
    expect(formatCurrency(0.001)).toBe("$0.00");
    expect(formatCurrency(0.005)).toBe("$0.01"); // rounds up
  });

  it("handles NaN input", () => {
    const result = formatCurrency(NaN);
    expect(result).toBe("$NaN");
  });

  it("handles Infinity", () => {
    const result = formatCurrency(Infinity);
    // Intl.NumberFormat throws on Infinity, but in some environments returns a string
    expect(typeof result).toBe("string");
  });

  it("formats exactly $0.01", () => {
    expect(formatCurrency(0.01)).toBe("$0.01");
  });

  it("formats exactly $1,000,000", () => {
    expect(formatCurrency(1_000_000)).toBe("$1,000,000.00");
  });
});

// ===========================================================================
// 3. formatPercent Edge Cases
// ===========================================================================

describe("formatPercent — edge cases", () => {
  it("formats zero with + sign", () => {
    expect(formatPercent(0)).toBe("+0.00%");
  });

  it("formats positive percentage", () => {
    expect(formatPercent(25.5)).toBe("+25.50%");
  });

  it("formats negative percentage", () => {
    expect(formatPercent(-10.75)).toBe("-10.75%");
  });

  it("formats very large percentage (> 1000%)", () => {
    expect(formatPercent(1500)).toBe("+1500.00%");
  });

  it("formats extremely large percentage", () => {
    expect(formatPercent(99999.99)).toBe("+99999.99%");
  });

  it("handles NaN input", () => {
    const result = formatPercent(NaN);
    // NaN.toFixed(2) returns "NaN" in JS
    expect(result).toContain("NaN");
  });

  it("formats very small positive percentage", () => {
    expect(formatPercent(0.001)).toBe("+0.00%");
  });

  it("formats -0 the same as 0 (IEEE 754 negative zero)", () => {
    // -0 >= 0 is true in JS, so sign should be "+"
    expect(formatPercent(-0)).toBe("+0.00%");
  });

  it("formats fractional negative percentage", () => {
    expect(formatPercent(-0.5)).toBe("-0.50%");
  });

  it("formats 100% exactly", () => {
    expect(formatPercent(100)).toBe("+100.00%");
  });
});
