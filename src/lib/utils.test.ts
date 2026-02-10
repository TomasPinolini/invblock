import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercent, formatQuantity, cn, relativeDate } from "./utils";

describe("formatCurrency", () => {
  // USD formatting
  it("formats USD with 2 decimals", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("formats zero USD", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative USD", () => {
    expect(formatCurrency(-50.5)).toBe("-$50.50");
  });

  it("formats large USD values with commas", () => {
    expect(formatCurrency(999999.99)).toBe("$999,999.99");
  });

  it("rounds to 2 decimals", () => {
    expect(formatCurrency(10.005)).toBe("$10.01"); // banker's rounding
    expect(formatCurrency(10.004)).toBe("$10.00");
  });

  it("defaults to USD", () => {
    expect(formatCurrency(100)).toBe("$100.00");
  });

  // ARS formatting
  it("formats ARS with 0 decimals", () => {
    const result = formatCurrency(1250, "ARS");
    // ARS uses es-AR locale: "ARS" currency symbol + no decimals
    expect(result).toMatch(/1\.250/); // Thousand separator is .
    expect(result).not.toMatch(/,\d\d$/); // No decimal places
  });

  it("formats zero ARS", () => {
    const result = formatCurrency(0, "ARS");
    expect(result).toContain("0");
  });
});

describe("formatPercent", () => {
  it("adds + sign for positive values", () => {
    expect(formatPercent(12.5)).toBe("+12.50%");
  });

  it("shows - sign for negative values", () => {
    expect(formatPercent(-3.2)).toBe("-3.20%");
  });

  it("shows +0.00% for zero", () => {
    expect(formatPercent(0)).toBe("+0.00%");
  });

  it("handles very small percentages", () => {
    expect(formatPercent(0.01)).toBe("+0.01%");
  });

  it("handles large percentages", () => {
    expect(formatPercent(150.75)).toBe("+150.75%");
  });

  it("handles very negative percentages", () => {
    expect(formatPercent(-99.99)).toBe("-99.99%");
  });
});

describe("formatQuantity", () => {
  it("formats integer without trailing decimals", () => {
    expect(formatQuantity(100)).toBe("100");
  });

  it("respects custom decimal parameter", () => {
    expect(formatQuantity(0.123456, 6)).toContain("0.123456");
  });

  it("uses default 4 decimals", () => {
    const result = formatQuantity(1.123456789);
    // Should truncate/round to 4 decimal places
    expect(result).toContain("1.1235");
  });

  it("formats crypto-scale small numbers", () => {
    expect(formatQuantity(0.00000001, 8)).toContain("0.00000001");
  });

  it("formats zero", () => {
    expect(formatQuantity(0)).toBe("0");
  });

  it("strips unnecessary trailing zeros", () => {
    expect(formatQuantity(1.5)).toBe("1.5");
  });
});

describe("relativeDate", () => {
  it("returns a relative time string", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = relativeDate(fiveMinutesAgo);
    expect(result).toContain("minutes ago");
  });

  it("handles Date objects", () => {
    const result = relativeDate(new Date());
    expect(result).toContain("second");
  });
});

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters false", () => {
    expect(cn("a", false, "b")).toBe("a b");
  });

  it("filters undefined", () => {
    expect(cn("a", undefined, "b")).toBe("a b");
  });

  it("filters null", () => {
    expect(cn("a", null, "b")).toBe("a b");
  });

  it("returns empty string for no arguments", () => {
    expect(cn()).toBe("");
  });

  it("handles single class", () => {
    expect(cn("only-class")).toBe("only-class");
  });
});
