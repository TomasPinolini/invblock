import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { fetchMacroData } from "@/services/macro/client";

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

const evaluateTradeInputSchema = z.object({
  ticker: z
    .string()
    .min(1, "Ticker is required")
    .max(20, "Ticker too long")
    .transform((v) => v.toUpperCase().trim()),
  quantity: z.number().positive("Quantity must be positive").optional(),
  portfolio: z.array(portfolioAssetSchema).default([]),
});

// ── Claude Response Validation ────────────────────────────────────────────────

const tradeEvaluationSchema = z.object({
  verdict: z.enum(["buy", "hold", "avoid"]),
  confidence: z.enum(["high", "medium", "low"]),
  score: z.number().min(1).max(10),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  portfolioImpact: z.string(),
  alternativeConsideration: z.string().nullable(),
  summary: z.string(),
});

// ── Server-Side Metrics Computation ───────────────────────────────────────────

interface PortfolioMetrics {
  alreadyHeld: boolean;
  currentAllocation: number;
  estimatedNewAllocation: number;
  category: string | null;
  categoryOverlap: number;
  currencyExposure: { ARS: number; USD: number };
  totalPositions: number;
  topConcentration: number;
}

function computeMetrics(
  ticker: string,
  quantity: number | undefined,
  portfolio: z.infer<typeof portfolioAssetSchema>[]
): PortfolioMetrics {
  const totalValue = portfolio.reduce((sum, a) => sum + a.currentValue, 0);
  const existingPosition = portfolio.find(
    (a) => a.ticker.toUpperCase() === ticker
  );

  const alreadyHeld = !!existingPosition;
  const currentAllocation =
    totalValue > 0 && existingPosition
      ? (existingPosition.currentValue / totalValue) * 100
      : 0;

  // Estimate new allocation if quantity provided
  let estimatedNewAllocation = currentAllocation;
  if (quantity && existingPosition) {
    const additionalValue = quantity * existingPosition.currentPrice;
    const newTotalValue = totalValue + additionalValue;
    const newPositionValue = existingPosition.currentValue + additionalValue;
    estimatedNewAllocation =
      newTotalValue > 0 ? (newPositionValue / newTotalValue) * 100 : 0;
  } else if (quantity && !existingPosition && totalValue > 0) {
    // New position — use a rough estimate (no live price available, assume ~$100 per unit as placeholder)
    const roughPrice = 100;
    const additionalValue = quantity * roughPrice;
    const newTotalValue = totalValue + additionalValue;
    estimatedNewAllocation = (additionalValue / newTotalValue) * 100;
  }

  // Category overlap
  const category = existingPosition?.category || null;
  const categoryOverlap = category
    ? portfolio.filter(
        (a) =>
          a.category === category &&
          a.ticker.toUpperCase() !== ticker
      ).length
    : 0;

  // Currency exposure
  const currencyExposure = { ARS: 0, USD: 0 };
  for (const asset of portfolio) {
    const cur = asset.currency === "ARS" ? "ARS" : "USD";
    currencyExposure[cur] += asset.currentValue;
  }
  // Normalize to percentages
  if (totalValue > 0) {
    currencyExposure.ARS = (currencyExposure.ARS / totalValue) * 100;
    currencyExposure.USD = (currencyExposure.USD / totalValue) * 100;
  }

  // Top concentration
  const topConcentration =
    totalValue > 0
      ? Math.max(...portfolio.map((a) => (a.currentValue / totalValue) * 100), 0)
      : 0;

  return {
    alreadyHeld,
    currentAllocation,
    estimatedNewAllocation,
    category,
    categoryOverlap,
    currencyExposure,
    totalPositions: portfolio.length,
    topConcentration,
  };
}

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a financial analyst specializing in the Argentine securities market. You evaluate trade decisions for retail investors using the IOL (InvertirOnline) broker.

Key context about this market:
- CEDEARs are Argentine-listed certificates representing foreign stocks (e.g., GGAL.BA for Grupo Financiero Galicia, AAPL.BA for Apple). They trade in ARS but track USD-denominated assets, creating implicit USD/ARS exposure.
- The ARS/USD exchange rate (CCL, MEP, blue) heavily impacts CEDEAR pricing. Currency devaluation risk is a constant factor.
- Argentine retail investors often have concentrated portfolios — typically 3-8 positions, frequently overweight in local banks (GGAL, BMA, SUPV) and energy (YPF, PAMP, VIST).
- Liquidity can be thin for smaller tickers. Settlement is T+2 for most instruments.
- Market hours: 11:00-17:00 ART (UTC-3). Pre/post-market liquidity is minimal.
- Tax considerations: Argentine investors pay income tax on capital gains (cedular).
- Political and macroeconomic risk is significant — policy changes can cause 10-20% moves in a single session.

Your evaluation criteria:
1. Portfolio concentration: Flag if any single position exceeds 20% allocation. Ideal is <15% per position.
2. Category diversification: Flag if more than 60% of portfolio is in one category.
3. Currency exposure: Note ARS vs USD balance. Heavy ARS exposure carries devaluation risk.
4. Correlation: Argentine bank stocks (GGAL, BMA, SUPV) are highly correlated — holding multiple adds concentration risk.
5. Position sizing: For retail accounts, suggest keeping individual positions under 15-20% of total portfolio.

IMPORTANT: Respond with ONLY valid JSON matching this exact structure (no markdown, no code blocks, no extra text):
{
  "verdict": "buy" | "hold" | "avoid",
  "confidence": "high" | "medium" | "low",
  "score": <number 1-10>,
  "pros": ["reason1", "reason2", ...],
  "cons": ["reason1", "reason2", ...],
  "portfolioImpact": "description of how this changes portfolio composition",
  "alternativeConsideration": "suggestion or null",
  "summary": "2-3 sentence natural language conclusion"
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

      // Only retry on 429 (rate limit) or 5xx (server errors)
      const status =
        error instanceof Anthropic.APIError ? error.status : null;
      const retryable = status === 429 || (status !== null && status >= 500);

      if (!retryable || attempt === maxAttempts) {
        throw lastError;
      }

      // Exponential backoff: 1s, 2s, 4s
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
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const parsed = evaluateTradeInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { ticker, quantity, portfolio } = parsed.data;

    // 4. Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Add ANTHROPIC_API_KEY to environment." },
        { status: 500 }
      );
    }

    // 5. Compute server-side metrics
    const metrics = computeMetrics(ticker, quantity, portfolio);

    // 5b. Fetch macro context (best-effort)
    let macroContext = "";
    try {
      const macro = await fetchMacroData();
      const blue = macro.dollars.find((d) => d.name === "Blue");
      const mep = macro.dollars.find((d) => d.name === "MEP");
      const ccl = macro.dollars.find((d) => d.name === "CCL");
      macroContext = `\n## Argentine Macro Context (live data)
- Dollar Blue: ${blue?.sell ? `$${blue.sell.toFixed(0)}` : "N/A"} | MEP: ${mep?.sell ? `$${mep.sell.toFixed(0)}` : "N/A"} | CCL: ${ccl?.sell ? `$${ccl.sell.toFixed(0)}` : "N/A"}
- Country Risk (EMBI+): ${macro.countryRisk ? `${macro.countryRisk} bp` : "N/A"}
- Interest Rate: ${macro.interestRate ? `${macro.interestRate.toFixed(1)}%` : "N/A"}
- Monthly CPI: ${macro.monthlyCpi ? `${macro.monthlyCpi.toFixed(1)}%` : "N/A"}`;
    } catch (e) {
      console.warn("[evaluate-trade] Failed to fetch macro context:", e);
    }

    // 6. Build user message with portfolio context
    const portfolioSummary =
      portfolio.length > 0
        ? portfolio
            .map(
              (a) =>
                `- ${a.ticker}: ${a.quantity} units, Value: $${a.currentValue.toFixed(2)}, ` +
                `Avg Price: $${a.averagePrice.toFixed(2)}, P&L: ${a.pnlPercent >= 0 ? "+" : ""}${a.pnlPercent.toFixed(1)}%, ` +
                `Category: ${a.category || "unknown"}, Currency: ${a.currency}`
            )
            .join("\n")
        : "No current holdings.";

    const quantityContext = quantity
      ? `The investor wants to buy ${quantity} units of ${ticker}.`
      : `The investor is considering buying ${ticker} (no specific quantity yet).`;

    const existingHoldingContext = metrics.alreadyHeld
      ? `\n\nIMPORTANT: The investor ALREADY holds ${ticker} with ${metrics.currentAllocation.toFixed(1)}% allocation. ` +
        (quantity
          ? `Adding ${quantity} more units would bring allocation to approximately ${metrics.estimatedNewAllocation.toFixed(1)}%.`
          : `Any additional purchase increases concentration in this position.`)
      : "";

    const userMessage = `Evaluate whether this trade makes sense for the investor's portfolio.

## Trade Under Evaluation
Ticker: ${ticker}
${quantityContext}
${existingHoldingContext}

## Current Portfolio (${portfolio.length} positions)
${portfolioSummary}

## Computed Metrics
- Already held: ${metrics.alreadyHeld ? "Yes" : "No"}
- Current allocation to ${ticker}: ${metrics.currentAllocation.toFixed(1)}%
- Estimated new allocation if purchased: ${metrics.estimatedNewAllocation.toFixed(1)}%
- Category: ${metrics.category || "unknown"}
- Same-category positions (excluding ${ticker}): ${metrics.categoryOverlap}
- Currency exposure: ARS ${metrics.currencyExposure.ARS.toFixed(1)}% / USD ${metrics.currencyExposure.USD.toFixed(1)}%
- Total positions: ${metrics.totalPositions}
- Highest single-position concentration: ${metrics.topConcentration.toFixed(1)}%
${macroContext}

Provide your evaluation as JSON.`;

    // 7. Call Claude with retry
    const anthropic = new Anthropic({ apiKey });
    const responseText = await callClaudeWithRetry(anthropic, userMessage);

    // 8. Parse and validate Claude's response
    let rawParsed: unknown;
    try {
      // Handle potential markdown code block wrapping
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      rawParsed = JSON.parse(jsonMatch ? jsonMatch[1] : responseText);
    } catch {
      console.error("[evaluate-trade] Failed to parse Claude response:", responseText);
      return NextResponse.json(
        { error: "AI returned an invalid response. Please try again." },
        { status: 502 }
      );
    }

    const validated = tradeEvaluationSchema.safeParse(rawParsed);
    if (!validated.success) {
      console.error(
        "[evaluate-trade] Claude response failed validation:",
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
      currentExposure: {
        alreadyHeld: metrics.alreadyHeld,
        currentAllocation: Math.round(metrics.currentAllocation * 100) / 100,
        category: metrics.category,
      },
    });
  } catch (error) {
    console.error("[evaluate-trade] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Trade evaluation failed" },
      { status: 500 }
    );
  }
}
