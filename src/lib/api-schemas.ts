import { z } from "zod";
import { NextResponse } from "next/server";

// ── Trade ────────────────────────────────────────────────────────────────────

export const tradeSchema = z.object({
  action: z.enum(["buy", "sell"], { message: "Must be 'buy' or 'sell'" }),
  mercado: z.string().min(1, "mercado is required"),
  simbolo: z.string().min(1, "simbolo is required"),
  cantidad: z.number().int("cantidad must be a whole number").positive("cantidad must be positive").finite().max(1_000_000, "cantidad exceeds maximum of 1,000,000"),
  precio: z.number().positive("precio must be positive").finite().max(100_000_000, "precio exceeds maximum of 100,000,000"),
  plazo: z.enum(["t0", "t1", "t2"], { message: "Must be 't0', 't1', or 't2'" }),
  validez: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "validez must be YYYY-MM-DD format"),
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

// Server-side auth: username + password → IOL API call
const iolAuthCredentials = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Client-side auth: browser already obtained the token (bypasses IP restrictions)
const iolAuthToken = z.object({
  token: z.object({
    access_token: z.string().min(1),
    token_type: z.string(),
    expires_in: z.number().positive(),
    refresh_token: z.string().min(1),
    issued_at: z.number().optional(),
  }),
});

export const iolAuthSchema = z.union([iolAuthCredentials, iolAuthToken]);

export const binanceAuthSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  apiSecret: z.string().min(1, "API secret is required"),
});

export const ppiAuthSchema = z.object({
  apiKey: z.string().min(1, "Public Key is required"),
  apiSecret: z.string().min(1, "Private Key is required"),
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
