import { z } from "zod";
import { NextResponse } from "next/server";

// ── Trade ────────────────────────────────────────────────────────────────────

export const tradeSchema = z.object({
  action: z.enum(["buy", "sell"], { message: "Must be 'buy' or 'sell'" }),
  mercado: z.string().min(1, "mercado is required"),
  simbolo: z.string().min(1, "simbolo is required"),
  cantidad: z.number().positive("cantidad must be positive"),
  precio: z.number().positive("precio must be positive"),
  plazo: z.enum(["t0", "t1", "t2"], { message: "Must be 't0', 't1', or 't2'" }),
  validez: z.string().min(1, "validez is required (YYYY-MM-DD)"),
  tipoOrden: z.enum(["precioLimite", "precioMercado"], {
    message: "Must be 'precioLimite' or 'precioMercado'",
  }),
});

export type TradeInput = z.infer<typeof tradeSchema>;

// ── Alerts ───────────────────────────────────────────────────────────────────

export const createAlertSchema = z.object({
  ticker: z.string().min(1, "ticker is required").max(20),
  condition: z.enum(["above", "below"], { message: "Must be 'above' or 'below'" }),
  targetPrice: z.number().positive("targetPrice must be positive"),
});

export const updateAlertSchema = z.object({
  id: z.string().uuid("Invalid alert id"),
  condition: z.enum(["above", "below"]).optional(),
  targetPrice: z.number().positive("targetPrice must be positive").optional(),
});

// ── Alert Narrative ─────────────────────────────────────────────────────────

export const alertNarrativeRequestSchema = z.object({
  alertId: z.string().uuid("Invalid alert id"),
});

export const alertNarrativeResponseSchema = z.object({
  narrative: z.string().min(10).max(2000),
  factors: z.array(z.string().min(1)).min(1).max(5),
  sentiment: z.enum(["positive", "negative", "neutral"]),
});

// ── Auth ─────────────────────────────────────────────────────────────────────

export const iolAuthSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const binanceAuthSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  apiSecret: z.string().min(1, "API secret is required"),
});

export const ppiAuthSchema = z.object({
  authorizedClient: z.string().min(1, "AuthorizedClient is required"),
  clientKey: z.string().min(1, "ClientKey is required"),
  apiKey: z.string().min(1, "ApiKey is required"),
  apiSecret: z.string().optional().default(""),
});

// ── Batch Quotes ─────────────────────────────────────────────────────────────

export const batchQuoteSchema = z.object({
  tickers: z.array(
    z.object({
      symbol: z.string().min(1),
      market: z.string().optional(),
      category: z.string().optional(),
    })
  ).default([]),
});

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Parse and validate a request body against a Zod schema.
 * Returns [data, null] on success or [null, NextResponse] on validation error.
 */
export function parseBody<T>(
  schema: z.ZodType<T>,
  body: unknown
): [T, null] | [null, NextResponse] {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return [
      null,
      NextResponse.json(
        { error: firstError.message, field: firstError.path.join(".") },
        { status: 400 }
      ),
    ];
  }
  return [result.data, null];
}
