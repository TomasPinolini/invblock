import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { fetchMacroData } from "@/services/macro/client";

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
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).default("moderate"),
  investmentHorizon: z.enum(["short", "medium", "long"]).default("long"),
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

const recommendationSchema = z.object({
  action: z.enum(["buy", "sell", "rebalance", "hold"]),
  ticker: z.string(),
  reason: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  priority: z.enum(["high", "medium", "low"]),
});

const advisorResponseSchema = z.object({
  score: z.number().min(0).max(100),
  rating: z.enum(["Excellent", "Good", "Fair", "Poor"]),
  findings: z.array(findingSchema).min(1).max(10),
  suggestions: z.array(suggestionSchema).min(1).max(10),
  recommendations: z.array(recommendationSchema).min(1).max(10),
  marketOutlook: z.string(),
  strategy: z.string(),
});

// Validated portfolio asset — stricter than the canonical PortfolioAsset
// because the Zod schema guarantees all fields are present after parsing.
type ValidatedPortfolioAsset = z.infer<typeof portfolioAssetSchema>;

// --- Types ---

interface PortfolioMetrics {
  totalValue: number;
  hhi: number;
  positionCount: number;
  categoryWeights: Record<string, number>;
  currencyExposure: { usd: number; ars: number };
  topHoldings: Array<{ ticker: string; weight: number }>;
}

// --- Server-side metric computation ---

function computeMetrics(portfolio: ValidatedPortfolioAsset[]): PortfolioMetrics {
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
        `[Advisor] Claude API attempt ${attempt} failed (status ${error instanceof Anthropic.APIError ? error.status : "unknown"}), retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // TypeScript: unreachable but satisfies return type
  throw new Error("Max retry attempts exceeded");
}

// --- System prompt ---

const SYSTEM_PROMPT = `You are a senior portfolio advisor and stock market analyst specializing in Argentine retail investors.
You have extensive experience in financial markets, stock analysis, and portfolio optimization.

Your job is to:
1. Evaluate portfolio health (diversification, concentration, currency exposure)
2. Analyze holdings performance and identify trends
3. Identify specific opportunities and risks in the current portfolio
4. Provide actionable, ticker-level recommendations (buy/sell/rebalance/hold)
5. Tailor advice to the investor's risk tolerance and investment horizon

Context about the Argentine market:
- CEDEARs are Argentine depository receipts of US stocks, traded in ARS on the BCBA (Buenos Aires Stock Exchange). They provide USD exposure via ARS-denominated instruments.
- Argentine investors face ARS devaluation risk, making USD-linked positions (CEDEARs, crypto, USD cash) important hedges.
- Typical retail investors in Argentina hold a mix of CEDEARs (for US stock exposure), local stocks, crypto, and cash (ARS and/or USD).
- High concentration in a single CEDEAR is common but risky if the underlying US stock drops.
- Having some ARS cash or short-term ARS instruments is needed for liquidity, but excessive ARS exposure is a devaluation risk.
- ONs (Obligaciones Negociables) are corporate bonds that can provide stable USD-linked income.
- Argentine government bonds (bonos) carry sovereign risk but can offer high yields.

Risk profiles:
- "conservative": Prioritize capital preservation, prefer USD-linked assets, low volatility. Suggest defensive positions.
- "moderate": Balance growth and safety. Diversified across categories. Accept some volatility for returns.
- "aggressive": Maximize growth potential. Accept higher concentration in high-conviction positions. Okay with volatility.

Investment horizons:
- "short" (< 6 months): Focus on liquidity, avoid illiquid positions, protect against near-term risks.
- "medium" (6-24 months): Balance current positioning with medium-term catalysts.
- "long" (> 2 years): Focus on structural positioning, compounding, and long-term macro trends.

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
  ],
  "recommendations": [
    { "action": "buy" | "sell" | "rebalance" | "hold", "ticker": "<ticker>", "reason": "<specific reason with percentages/amounts>", "confidence": "high" | "medium" | "low", "priority": "high" | "medium" | "low" }
  ],
  "marketOutlook": "<2-3 sentence market context summary relevant to this portfolio>",
  "strategy": "<1-2 sentence personalized strategy based on risk tolerance and investment horizon>"
}

Rules:
- Provide 3-5 findings and exactly 3 suggestions.
- Provide 3-5 recommendations, each with a confidence level.
- Base analysis on factual portfolio data and computed metrics — avoid speculation without data support.
- Be specific: mention actual tickers, percentages, and dollar amounts.
- Recommendations must be actionable: "Buy X", "Sell Y", "Rebalance Z from A% to B%".
- Tailor recommendations to the investor's risk tolerance and time horizon.
- Write all text in English.`;

// --- Route handler ---

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimited = await checkRateLimit(user.id, "insights", RATE_LIMITS.insights);
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

    const { portfolio, riskTolerance, investmentHorizon } = parsed.data;

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

    // Fetch macro context (best-effort, don't fail if unavailable)
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
- Reserves: ${macro.reserves ? `$${(macro.reserves / 1000).toFixed(1)}B USD` : "N/A"}
- Monthly CPI: ${macro.monthlyCpi ? `${macro.monthlyCpi.toFixed(1)}%` : "N/A"}`;
    } catch (e) {
      console.warn("[Advisor] Failed to fetch macro context:", e);
    }

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

    const userMessage = `Analyze this portfolio and provide advisor recommendations.

## Investor Profile
- Risk tolerance: ${riskTolerance}
- Investment horizon: ${investmentHorizon}

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
${holdingsList}
${macroContext}`;

    // Call Claude with retry logic
    const anthropic = new Anthropic({ apiKey });

    const message = await callClaudeWithRetry(anthropic, {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2500,
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
      console.error("[Advisor] Failed to parse Claude response as JSON:", responseText.slice(0, 500));
      return NextResponse.json(
        { error: "AI returned an invalid response. Please try again." },
        { status: 502 }
      );
    }

    const validated = advisorResponseSchema.safeParse(rawParsed);

    if (!validated.success) {
      console.error("[Advisor] Claude response failed validation:", validated.error.flatten());
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 502 }
      );
    }

    const { score, rating, findings, suggestions, recommendations, marketOutlook, strategy } = validated.data;

    return NextResponse.json({
      score,
      rating,
      findings,
      suggestions,
      recommendations,
      marketOutlook,
      strategy,
      metrics,
    });
  } catch (error) {
    console.error("[Advisor] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Advisor analysis failed" },
      { status: 500 }
    );
  }
}
