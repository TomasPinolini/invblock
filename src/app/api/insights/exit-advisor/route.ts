import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const maxDuration = 60;

// ── Input Validation ──────────────────────────────────────────────────────────

const portfolioAssetSchema = z.object({
  ticker: z.string().min(1),
  name: z.string().optional().default(""),
  category: z.string().optional().default(""),
  currency: z.string().optional().default("USD"),
  quantity: z.number().nonnegative(),
  averagePrice: z.number().nonnegative(),
  currentPrice: z.number().nonnegative(),
  currentValue: z.number().nonnegative(),
  pnl: z.number().optional().default(0),
  pnlPercent: z.number().optional().default(0),
  allocation: z.number().nonnegative().optional().default(0),
});

const exitAdvisorInputSchema = z.object({
  ticker: z
    .string()
    .min(1, "Ticker is required")
    .max(20, "Ticker too long")
    .transform((v) => v.toUpperCase().trim()),
  entryDate: z.string().optional(),
  targetReturn: z.number().optional(),
  portfolio: z.array(portfolioAssetSchema).default([]),
});

// ── Claude Response Validation ────────────────────────────────────────────────

const exitAdvisorResponseSchema = z.object({
  recommendation: z.enum(["hold", "trim", "exit"]),
  confidence: z.enum(["high", "medium", "low"]),
  holdingAnalysis: z.string(),
  taxConsiderations: z.string(),
  timingFactors: z.array(z.string()),
  risks: z.array(z.string()),
  targetAction: z.string(),
  summary: z.string(),
});

// ── Server-Side Metrics Computation ───────────────────────────────────────────

interface ExitMetrics {
  held: boolean;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  positionWeight: number;
  categoryExposure: number;
  category: string;
  holdingPeriodDays: number | null;
}

function computeExitMetrics(
  ticker: string,
  entryDate: string | undefined,
  portfolio: z.infer<typeof portfolioAssetSchema>[]
): ExitMetrics {
  const totalValue = portfolio.reduce((sum, a) => sum + a.currentValue, 0);
  const position = portfolio.find((a) => a.ticker.toUpperCase() === ticker);

  if (!position) {
    return {
      held: false,
      quantity: 0,
      averagePrice: 0,
      currentPrice: 0,
      unrealizedPnl: 0,
      unrealizedPnlPercent: 0,
      positionWeight: 0,
      categoryExposure: 0,
      category: "unknown",
      holdingPeriodDays: null,
    };
  }

  const unrealizedPnl = (position.currentPrice - position.averagePrice) * position.quantity;
  const unrealizedPnlPercent =
    position.averagePrice > 0
      ? ((position.currentPrice - position.averagePrice) / position.averagePrice) * 100
      : 0;

  const positionWeight = totalValue > 0 ? (position.currentValue / totalValue) * 100 : 0;

  const category = position.category || "unknown";
  const categoryExposure = totalValue > 0
    ? (portfolio
        .filter((a) => (a.category || "").toLowerCase() === category.toLowerCase())
        .reduce((sum, a) => sum + a.currentValue, 0) / totalValue) * 100
    : 0;

  let holdingPeriodDays: number | null = null;
  if (entryDate) {
    const entry = new Date(entryDate);
    if (!isNaN(entry.getTime())) {
      holdingPeriodDays = Math.floor((Date.now() - entry.getTime()) / 86400000);
    }
  }

  return {
    held: true,
    quantity: position.quantity,
    averagePrice: position.averagePrice,
    currentPrice: position.currentPrice,
    unrealizedPnl,
    unrealizedPnlPercent,
    positionWeight,
    categoryExposure,
    category,
    holdingPeriodDays,
  };
}

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a position exit strategy advisor specializing in the Argentine securities market. You help retail investors decide when to sell or trim positions.

Key context about this market:
- CEDEARs are Argentine-listed certificates representing foreign stocks. They trade in ARS but track USD-denominated assets.
- Argentine investors pay income tax (cedular) on capital gains. Holding period affects tax treatment.
- The ARS/USD exchange rate (CCL, MEP, blue) heavily impacts CEDEAR pricing.
- Political and macroeconomic risk is significant — policy changes can cause 10-20% moves.
- Liquidity can be thin — exiting large positions may require multiple sessions.

Exit evaluation criteria:
1. Unrealized P&L: Large unrealized gains (>30%) may warrant taking profits. Losses >15% may need reassessment.
2. Position concentration: >20% of portfolio in one position is risky. Consider trimming.
3. Category exposure: >40% in one category suggests sector risk.
4. Holding period: Short-term (<30 days) exits have different tax implications than long-term.
5. Target return: If the investor has a target, evaluate proximity to it.
6. Risk/reward: Assess whether the remaining upside justifies the current risk.

IMPORTANT: Respond with ONLY valid JSON matching this exact structure (no markdown, no code blocks, no extra text):
{
  "recommendation": "hold" | "trim" | "exit",
  "confidence": "high" | "medium" | "low",
  "holdingAnalysis": "analysis of current position and P&L",
  "taxConsiderations": "relevant tax implications for this exit",
  "timingFactors": ["factor1", "factor2", ...],
  "risks": ["risk1", "risk2", ...],
  "targetAction": "specific action recommendation with amounts/percentages",
  "summary": "2-3 sentence conclusion"
}`;

// ── Retry Logic ───────────────────────────────────────────────────────────────

async function callClaudeWithRetry(
  anthropic: Anthropic,
  userMessage: string,
  maxAttempts: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      return textBlock?.text ?? "";
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const status =
        error instanceof Anthropic.APIError ? error.status : null;
      const retryable = status === 429 || (status !== null && status >= 500);

      if (!retryable || attempt === maxAttempts) {
        throw lastError;
      }

      const backoff = Math.pow(2, attempt - 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError ?? new Error("Claude API call failed after retries");
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Rate limit check
    const rateLimited = await checkRateLimit(user.id, "insights", RATE_LIMITS.insights);
    if (rateLimited) return rateLimited;

    // 3. Parse and validate input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const parsed = exitAdvisorInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { ticker, entryDate, targetReturn, portfolio } = parsed.data;

    // 4. Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Add ANTHROPIC_API_KEY to environment." },
        { status: 500 }
      );
    }

    // 5. Compute server-side metrics
    const metrics = computeExitMetrics(ticker, entryDate, portfolio);

    if (!metrics.held) {
      return NextResponse.json(
        { error: `${ticker} is not in your portfolio` },
        { status: 400 }
      );
    }

    // 6. Build user message
    const portfolioSummary =
      portfolio.length > 0
        ? portfolio
            .map(
              (a) =>
                `- ${a.ticker}: ${a.quantity} units, Value: $${a.currentValue.toFixed(2)}, ` +
                `P&L: ${(a.pnlPercent ?? 0) >= 0 ? "+" : ""}${(a.pnlPercent ?? 0).toFixed(1)}%, ` +
                `Category: ${a.category || "unknown"}, Currency: ${a.currency}`
            )
            .join("\n")
        : "No other holdings.";

    const userMessage = `Evaluate whether the investor should exit or trim this position.

## Position Under Evaluation
Ticker: ${ticker}
Quantity: ${metrics.quantity} units
Average Price: $${metrics.averagePrice.toFixed(2)}
Current Price: $${metrics.currentPrice.toFixed(2)}
Unrealized P&L: ${metrics.unrealizedPnl >= 0 ? "+" : ""}$${metrics.unrealizedPnl.toFixed(2)} (${metrics.unrealizedPnlPercent >= 0 ? "+" : ""}${metrics.unrealizedPnlPercent.toFixed(1)}%)
Position Weight: ${metrics.positionWeight.toFixed(1)}% of portfolio
Category: ${metrics.category} (total category exposure: ${metrics.categoryExposure.toFixed(1)}%)
${metrics.holdingPeriodDays !== null ? `Holding Period: ${metrics.holdingPeriodDays} days` : "Holding Period: unknown"}
${targetReturn !== undefined ? `Target Return: ${targetReturn}%` : "No specific target return set"}

## Full Portfolio (${portfolio.length} positions)
${portfolioSummary}

Provide your exit analysis as JSON.`;

    // 7. Call Claude with retry
    const anthropic = new Anthropic({ apiKey });
    const responseText = await callClaudeWithRetry(anthropic, userMessage);

    // 8. Parse and validate Claude's response
    let rawParsed: unknown;
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      rawParsed = JSON.parse(jsonMatch ? jsonMatch[1] : responseText);
    } catch {
      console.error("[exit-advisor] Failed to parse Claude response:", responseText);
      return NextResponse.json(
        { error: "AI returned an invalid response. Please try again." },
        { status: 502 }
      );
    }

    const validated = exitAdvisorResponseSchema.safeParse(rawParsed);
    if (!validated.success) {
      console.error(
        "[exit-advisor] Claude response failed validation:",
        validated.error.flatten()
      );
      return NextResponse.json(
        { error: "AI returned an unexpected response format. Please try again." },
        { status: 502 }
      );
    }

    // 9. Return combined response
    return NextResponse.json({
      ticker,
      ...validated.data,
      metrics: {
        unrealizedPnl: Math.round(metrics.unrealizedPnl * 100) / 100,
        unrealizedPnlPercent: Math.round(metrics.unrealizedPnlPercent * 100) / 100,
        positionWeight: Math.round(metrics.positionWeight * 100) / 100,
        holdingPeriodDays: metrics.holdingPeriodDays,
      },
    });
  } catch (error) {
    console.error("[exit-advisor] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Exit analysis failed" },
      { status: 500 }
    );
  }
}
