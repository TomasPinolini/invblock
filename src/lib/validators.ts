import { z } from "zod";
import { ASSET_CATEGORIES, CURRENCIES, TRANSACTION_TYPES } from "./constants";

// ── Asset Validation ────────────────────────────────────────────────────────

export const assetFormSchema = z.object({
  ticker: z
    .string()
    .min(1, "Ticker is required")
    .max(20)
    .transform((v) => v.toUpperCase().trim()),
  name: z
    .string()
    .min(1, "Name is required")
    .max(120)
    .transform((v) => v.trim()),
  category: z.enum(ASSET_CATEGORIES, {
    message: "Select a valid category",
  }),
  currency: z.enum(CURRENCIES).default("USD"),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v) && v >= 0, "Quantity must be >= 0"),
  averagePrice: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v) && v >= 0, "Price must be >= 0"),
});

export type AssetFormValues = z.infer<typeof assetFormSchema>;

// ── Transaction Validation ──────────────────────────────────────────────────

export const transactionFormSchema = z.object({
  assetId: z.string().uuid("Select a valid asset"),
  type: z.enum(TRANSACTION_TYPES, {
    message: "Select buy or sell",
  }),
  quantity: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v) && v > 0, "Quantity must be > 0"),
  pricePerUnit: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v) && v > 0, "Price must be > 0"),
  currency: z.enum(CURRENCIES).default("USD"),
  executedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

// ── Derived: the total is always computed, never user-entered ───────────────

export const transactionInsertSchema = transactionFormSchema.transform(
  (data) => ({
    ...data,
    totalAmount: data.quantity * data.pricePerUnit,
  })
);

// ── AI Analysis Response Validation ─────────────────────────────────────────

const recommendationSchema = z.object({
  ticker: z.string().min(1),
  reason: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
});

export const analysisResponseSchema = z.object({
  summary: z.array(z.string()).min(1),
  mentionedAssets: z.array(z.string()),
  recommendations: z.object({
    buy: z.array(recommendationSchema),
    sell: z.array(recommendationSchema),
    hold: z.array(recommendationSchema),
  }),
  risks: z.array(z.string()),
  sentiment: z.enum(["Bullish", "Neutral", "Bearish"]),
  sentimentReason: z.string(),
});

export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
export type RecommendationItem = z.infer<typeof recommendationSchema>;
