import { describe, it, expect } from "vitest";
import { assetFormSchema, transactionFormSchema, transactionInsertSchema } from "./validators";

describe("assetFormSchema", () => {
  it("accepts valid input", () => {
    const result = assetFormSchema.safeParse({
      ticker: "ggal",
      name: "Galicia",
      category: "cedear",
      quantity: "100",
      averagePrice: "50.5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ticker).toBe("GGAL"); // uppercased
      expect(result.data.currency).toBe("USD"); // default
      expect(result.data.quantity).toBe(100); // parsed to number
    }
  });

  it("rejects empty ticker", () => {
    const result = assetFormSchema.safeParse({
      ticker: "",
      name: "Test",
      category: "stock",
      quantity: 1,
      averagePrice: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const result = assetFormSchema.safeParse({
      ticker: "AAPL",
      name: "Apple",
      category: "stock",
      quantity: -5,
      averagePrice: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category", () => {
    const result = assetFormSchema.safeParse({
      ticker: "AAPL",
      name: "Apple",
      category: "bond",
      quantity: 1,
      averagePrice: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero quantity (asset with no holdings)", () => {
    const result = assetFormSchema.safeParse({
      ticker: "AAPL",
      name: "Apple",
      category: "stock",
      quantity: 0,
      averagePrice: 0,
    });
    expect(result.success).toBe(true);
  });

  it("trims whitespace from name", () => {
    const result = assetFormSchema.safeParse({
      ticker: "AAPL",
      name: "  Apple Inc  ",
      category: "stock",
      quantity: 1,
      averagePrice: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Apple Inc");
    }
  });

  it("accepts string numbers (from form inputs)", () => {
    const result = assetFormSchema.safeParse({
      ticker: "BTC",
      name: "Bitcoin",
      category: "crypto",
      quantity: "0.5",
      averagePrice: "60000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(0.5);
      expect(result.data.averagePrice).toBe(60000);
    }
  });
});

describe("transactionFormSchema", () => {
  const validTx = {
    assetId: "550e8400-e29b-41d4-a716-446655440000",
    type: "buy" as const,
    quantity: 10,
    pricePerUnit: 100,
  };

  it("accepts valid transaction", () => {
    const result = transactionFormSchema.safeParse(validTx);
    expect(result.success).toBe(true);
  });

  it("rejects zero quantity", () => {
    const result = transactionFormSchema.safeParse({ ...validTx, quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = transactionFormSchema.safeParse({ ...validTx, pricePerUnit: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for assetId", () => {
    const result = transactionFormSchema.safeParse({ ...validTx, assetId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid transaction type", () => {
    const result = transactionFormSchema.safeParse({ ...validTx, type: "transfer" });
    expect(result.success).toBe(false);
  });

  it("accepts optional notes", () => {
    const result = transactionFormSchema.safeParse({ ...validTx, notes: "Test note" });
    expect(result.success).toBe(true);
  });

  it("rejects notes over 500 chars", () => {
    const result = transactionFormSchema.safeParse({ ...validTx, notes: "x".repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe("transactionInsertSchema", () => {
  it("computes totalAmount from quantity * pricePerUnit", () => {
    const result = transactionInsertSchema.safeParse({
      assetId: "550e8400-e29b-41d4-a716-446655440000",
      type: "buy",
      quantity: 10,
      pricePerUnit: 50.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalAmount).toBe(505);
    }
  });
});
