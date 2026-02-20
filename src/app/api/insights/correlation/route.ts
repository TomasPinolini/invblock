import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getTickerMeta } from "@/lib/ticker-metadata";

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

const correlationInputSchema = z.object({
  portfolio: z.array(portfolioAssetSchema).min(1, "Portfolio must have at least one asset"),
});

// ── Claude Response Validation ────────────────────────────────────────────────

const correlationResponseSchema = z.object({
  concentrationScore: z.number().min(0).max(100),
  rating: z.enum(["Well Diversified", "Moderate Risk", "Concentrated", "Highly Concentrated"]),
  hiddenRisks: z.array(z.string()),
  decorrelationSuggestions: z.array(z.string()),
  summary: z.string(),
});

// ── Server-Side Grouping ──────────────────────────────────────────────────────

interface GroupAllocation {
  name: string;
  tickers: string[];
  totalValue: number;
  allocation: number;
  isConcentrated: boolean;
}

interface CorrelationMetrics {
  bySector: GroupAllocation[];
  byCountry: GroupAllocation[];
  byCorrelationGroup: GroupAllocation[];
  totalValue: number;
  concentratedGroups: number;
}

function computeCorrelationMetrics(
  portfolio: z.infer<typeof portfolioAssetSchema>[]
): CorrelationMetrics {
  const totalValue = portfolio.reduce((sum, a) => sum + a.currentValue, 0);
  if (totalValue === 0) {
    return { bySector: [], byCountry: [], byCorrelationGroup: [], totalValue: 0, concentratedGroups: 0 };
  }

  const sectorMap = new Map<string, { tickers: string[]; value: number }>();
  const countryMap = new Map<string, { tickers: string[]; value: number }>();
  const corrGroupMap = new Map<string, { tickers: string[]; value: number }>();

  for (const asset of portfolio) {
    const meta = getTickerMeta(asset.ticker);
    const ticker = asset.ticker.toUpperCase();

    // Sector grouping
    const sectorEntry = sectorMap.get(meta.sector) ?? { tickers: [], value: 0 };
    sectorEntry.tickers.push(ticker);
    sectorEntry.value += asset.currentValue;
    sectorMap.set(meta.sector, sectorEntry);

    // Country grouping
    const countryEntry = countryMap.get(meta.country) ?? { tickers: [], value: 0 };
    countryEntry.tickers.push(ticker);
    countryEntry.value += asset.currentValue;
    countryMap.set(meta.country, countryEntry);

    // Correlation group
    const corrEntry = corrGroupMap.get(meta.correlationGroup) ?? { tickers: [], value: 0 };
    corrEntry.tickers.push(ticker);
    corrEntry.value += asset.currentValue;
    corrGroupMap.set(meta.correlationGroup, corrEntry);
  }

  const CONCENTRATION_THRESHOLD = 30;

  function toGroupArray(map: Map<string, { tickers: string[]; value: number }>): GroupAllocation[] {
    return Array.from(map.entries())
      .map(([name, { tickers, value }]) => ({
        name,
        tickers,
        totalValue: Math.round(value * 100) / 100,
        allocation: Math.round((value / totalValue) * 10000) / 100,
        isConcentrated: (value / totalValue) * 100 > CONCENTRATION_THRESHOLD,
      }))
      .sort((a, b) => b.allocation - a.allocation);
  }

  const bySector = toGroupArray(sectorMap);
  const byCountry = toGroupArray(countryMap);
  const byCorrelationGroup = toGroupArray(corrGroupMap);

  const concentratedGroups = [
    ...bySector.filter((g) => g.isConcentrated),
    ...byCorrelationGroup.filter((g) => g.isConcentrated),
  ].length;

  return { bySector, byCountry, byCorrelationGroup, totalValue, concentratedGroups };
}

// ── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a portfolio diversification analyst specializing in correlation and concentration risk for Argentine retail investors.

Your job is to analyze groupings of portfolio positions by sector, country, and correlation clusters to identify hidden concentration risks that simple category-level analysis would miss.

Key context:
- CEDEARs provide implicit USD exposure even when denominated in ARS.
- Argentine bank stocks (GGAL, BMA, BBAR, SUPV) are highly correlated — holding multiple adds hidden concentration.
- Holding QQQ + individual Nasdaq stocks = double-counting tech exposure.
- Semiconductor stocks (NVDA, AMD, TSM, AVGO, etc.) move together — combined >30% is a concentration risk.
- Any single correlation group >30% allocation is a concentration flag.
- Country risk: >60% in one country (especially Argentina or China) is notable.

IMPORTANT: Respond with ONLY valid JSON matching this exact structure (no markdown, no code blocks, no extra text):
{
  "concentrationScore": <number 0-100, where 0 = maximally concentrated, 100 = perfectly diversified>,
  "rating": "Well Diversified" | "Moderate Risk" | "Concentrated" | "Highly Concentrated",
  "hiddenRisks": ["risk description 1", "risk description 2", ...],
  "decorrelationSuggestions": ["suggestion 1", "suggestion 2", ...],
  "summary": "2-3 sentence assessment of the portfolio's correlation profile"
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

    // 2. Rate limit
    const rateLimited = await checkRateLimit(user.id, "insights", RATE_LIMITS.insights);
    if (rateLimited) return rateLimited;

    // 3. Parse input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = correlationInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { portfolio } = parsed.data;

    // 4. API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Add ANTHROPIC_API_KEY to environment." },
        { status: 500 }
      );
    }

    // 5. Compute groupings
    const metrics = computeCorrelationMetrics(portfolio);

    // 6. Build user message
    const formatGroup = (groups: GroupAllocation[]) =>
      groups
        .map(
          (g) =>
            `  - ${g.name}: ${g.allocation.toFixed(1)}% (${g.tickers.join(", ")})${g.isConcentrated ? " ⚠️ CONCENTRATED" : ""}`
        )
        .join("\n");

    const userMessage = `Analyze this portfolio for hidden correlation and concentration risks.

## Portfolio (${portfolio.length} positions, total value: $${metrics.totalValue.toFixed(2)})

## By Sector
${formatGroup(metrics.bySector)}

## By Country
${formatGroup(metrics.byCountry)}

## By Correlation Group (tickers that move together)
${formatGroup(metrics.byCorrelationGroup)}

## Flags
- Concentrated groups (>30%): ${metrics.concentratedGroups}

Provide your analysis as JSON.`;

    // 7. Call Claude
    const anthropic = new Anthropic({ apiKey });
    const responseText = await callClaudeWithRetry(anthropic, userMessage);

    // 8. Parse response
    let rawParsed: unknown;
    try {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      rawParsed = JSON.parse(jsonMatch ? jsonMatch[1] : responseText);
    } catch {
      console.error("[correlation] Failed to parse Claude response:", responseText);
      return NextResponse.json(
        { error: "AI returned an invalid response. Please try again." },
        { status: 502 }
      );
    }

    const validated = correlationResponseSchema.safeParse(rawParsed);
    if (!validated.success) {
      console.error("[correlation] Validation failed:", validated.error.flatten());
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 502 }
      );
    }

    // 9. Return
    return NextResponse.json({
      ...validated.data,
      groups: {
        bySector: metrics.bySector,
        byCountry: metrics.byCountry,
        byCorrelationGroup: metrics.byCorrelationGroup,
      },
    });
  } catch (error) {
    console.error("[correlation] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Correlation analysis failed" },
      { status: 500 }
    );
  }
}
