import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const maxDuration = 60;

// --- Input validation ---

const portfolioAssetSchema = z.object({
  ticker: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  currency: z.string().min(1).max(10),
  quantity: z.number().finite(),
  currentValue: z.number().finite(),
  pnl: z.number().finite(),
  pnlPercent: z.number().finite(),
});

const requestSchema = z.object({
  portfolio: z.array(portfolioAssetSchema).min(1, "Portfolio must have at least one asset").max(200),
});

// --- Claude response validation ---

const findingSchema = z.object({
  type: z.enum(["strength", "warning", "critical"]),
  title: z.string(),
  description: z.string(),
});

const suggestionSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  action: z.string(),
});

const healthResponseSchema = z.object({
  score: z.number().min(0).max(100),
  rating: z.enum(["Excellent", "Good", "Fair", "Poor"]),
  findings: z.array(findingSchema).min(1).max(10),
  suggestions: z.array(suggestionSchema).min(1).max(10),
});

// --- Types ---

type PortfolioAsset = z.infer<typeof portfolioAssetSchema>;

interface PortfolioMetrics {
  totalValue: number;
  hhi: number;
  positionCount: number;
  categoryWeights: Record<string, number>;
  currencyExposure: { usd: number; ars: number };
  topHoldings: Array<{ ticker: string; weight: number }>;
}

// --- Server-side metric computation ---

function computeMetrics(portfolio: PortfolioAsset[]): PortfolioMetrics {
  const totalValue = portfolio.reduce((sum, a) => sum + Math.abs(a.currentValue), 0);

  // Allocation percentages per asset
  const weights = portfolio.map((a) => ({
    ticker: a.ticker,
    weight: totalValue > 0 ? (Math.abs(a.currentValue) / totalValue) * 100 : 0,
    category: a.category.toLowerCase(),
    currency: a.currency.toUpperCase(),
    currentValue: a.currentValue,
  }));

  // Herfindahl-Hirschman Index: sum of squared allocation percentages
  const hhi = weights.reduce((sum, w) => sum + w.weight * w.weight, 0);

  // Category weights
  const categoryWeights: Record<string, number> = {};
  for (const w of weights) {
    categoryWeights[w.category] = (categoryWeights[w.category] || 0) + w.weight;
  }

  // Currency exposure
  let usdValue = 0;
  let arsValue = 0;
  for (const w of weights) {
    if (w.currency === "USD") {
      usdValue += Math.abs(w.currentValue);
    } else {
      arsValue += Math.abs(w.currentValue);
    }
  }
  const currencyExposure = {
    usd: totalValue > 0 ? (usdValue / totalValue) * 100 : 0,
    ars: totalValue > 0 ? (arsValue / totalValue) * 100 : 0,
  };

  // Top 3 holdings by weight
  const topHoldings = [...weights]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((w) => ({ ticker: w.ticker, weight: Math.round(w.weight * 100) / 100 }));

  return {
    totalValue: Math.round(totalValue * 100) / 100,
    hhi: Math.round(hhi * 100) / 100,
    positionCount: portfolio.length,
    categoryWeights: Object.fromEntries(
      Object.entries(categoryWeights).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    currencyExposure: {
      usd: Math.round(currencyExposure.usd * 100) / 100,
      ars: Math.round(currencyExposure.ars * 100) / 100,
    },
    topHoldings,
  };
}

// --- Retry logic ---

async function callClaudeWithRetry(
  anthropic: Anthropic,
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  maxAttempts = 3
): Promise<Anthropic.Messages.Message> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (error: unknown) {
      const isRetryable =
        error instanceof Anthropic.APIError &&
        (error.status === 429 || (error.status !== undefined && error.status >= 500));

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.warn(
        `[Health] Claude API attempt ${attempt} failed (status ${error instanceof Anthropic.APIError ? error.status : "unknown"}), retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // TypeScript: unreachable but satisfies return type
  throw new Error("Max retry attempts exceeded");
}

// --- System prompt ---

const SYSTEM_PROMPT = `You are a portfolio health analyst specializing in Argentine retail investors. Your job is to analyze a portfolio and return a structured health score.

Context about the Argentine market:
- CEDEARs are Argentine depository receipts of US stocks, traded in ARS on the BCBA (Buenos Aires Stock Exchange). They provide USD exposure via ARS-denominated instruments.
- Argentine investors face ARS devaluation risk, making USD-linked positions (CEDEARs, crypto, USD cash) important hedges.
- Typical retail investors in Argentina hold a mix of CEDEARs (for US stock exposure), local stocks, crypto, and cash (ARS and/or USD).
- High concentration in a single CEDEAR is common but risky if the underlying US stock drops.
- Having some ARS cash or short-term ARS instruments is needed for liquidity, but excessive ARS exposure is a devaluation risk.

Scoring guidelines:
- 80-100 "Excellent": Well-diversified across categories and currencies, reasonable position sizes, healthy mix of growth and defensive assets.
- 60-79 "Good": Decent diversification with minor concentration issues, acceptable currency balance.
- 40-59 "Fair": Notable concentration risks, imbalanced currency exposure, or too few positions.
- 0-39 "Poor": Severe concentration, almost no diversification, extreme currency mismatch, or very few positions.

You MUST respond with ONLY valid JSON matching this exact structure (no markdown, no code blocks, no extra text):
{
  "score": <number 0-100>,
  "rating": "Excellent" | "Good" | "Fair" | "Poor",
  "findings": [
    { "type": "strength" | "warning" | "critical", "title": "<short title>", "description": "<1-2 sentence explanation>" }
  ],
  "suggestions": [
    { "priority": "high" | "medium" | "low", "action": "<specific actionable suggestion>" }
  ]
}

Rules:
- Provide 3-5 findings and exactly 3 suggestions.
- Base the score on the pre-computed metrics AND your own qualitative analysis of the holdings.
- Be specific: mention actual tickers and percentages in your findings and suggestions.
- Write findings and suggestions in English.`;

// --- Route handler ---

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimited = checkRateLimit(user.id, "insights", RATE_LIMITS.insights);
    if (rateLimited) return rateLimited;

    // Parse and validate request body
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { portfolio } = parsed.data;

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Add ANTHROPIC_API_KEY to environment." },
        { status: 500 }
      );
    }

    // Compute server-side metrics
    const metrics = computeMetrics(portfolio);

    // Determine HHI classification
    let hhiLabel: string;
    if (metrics.hhi > 2500) {
      hhiLabel = "highly concentrated";
    } else if (metrics.hhi > 1500) {
      hhiLabel = "moderately concentrated";
    } else {
      hhiLabel = "diversified";
    }

    // Build user message with metrics + holdings
    const holdingsList = portfolio
      .map(
        (a) =>
          `- ${a.ticker} (${a.name}): ${a.quantity} units, Value: $${a.currentValue.toFixed(2)}, P&L: ${a.pnl >= 0 ? "+" : ""}$${a.pnl.toFixed(2)} (${a.pnlPercent >= 0 ? "+" : ""}${a.pnlPercent.toFixed(2)}%), Category: ${a.category}, Currency: ${a.currency}`
      )
      .join("\n");

    const userMessage = `Analyze this portfolio and provide a health score.

## Pre-computed Metrics
- Total portfolio value: $${metrics.totalValue.toFixed(2)}
- Number of positions: ${metrics.positionCount}
- HHI (Herfindahl-Hirschman Index): ${metrics.hhi.toFixed(2)} (${hhiLabel})
- Category weights: ${Object.entries(metrics.categoryWeights)
      .map(([cat, pct]) => `${cat}: ${pct.toFixed(1)}%`)
      .join(", ")}
- Currency exposure: USD ${metrics.currencyExposure.usd.toFixed(1)}%, ARS ${metrics.currencyExposure.ars.toFixed(1)}%
- Top 3 holdings: ${metrics.topHoldings.map((h) => `${h.ticker} (${h.weight.toFixed(1)}%)`).join(", ")}

## Portfolio Holdings
${holdingsList}`;

    // Call Claude with retry logic
    const anthropic = new Anthropic({ apiKey });

    const message = await callClaudeWithRetry(anthropic, {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // Extract text content
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse and validate Claude's response
    let rawParsed: unknown;
    try {
      // Handle potential markdown code block wrapping
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      rawParsed = JSON.parse(jsonMatch ? jsonMatch[1] : responseText);
    } catch {
      console.error("[Health] Failed to parse Claude response as JSON:", responseText.slice(0, 500));
      return NextResponse.json(
        { error: "AI returned an invalid response. Please try again." },
        { status: 502 }
      );
    }

    const validated = healthResponseSchema.safeParse(rawParsed);

    if (!validated.success) {
      console.error("[Health] Claude response failed validation:", validated.error.flatten());
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 502 }
      );
    }

    const { score, rating, findings, suggestions } = validated.data;

    return NextResponse.json({
      score,
      rating,
      findings,
      suggestions,
      metrics,
    });
  } catch (error) {
    console.error("[Health] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Health analysis failed" },
      { status: 500 }
    );
  }
}
