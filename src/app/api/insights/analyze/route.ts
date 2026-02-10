import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { analysisResponseSchema } from "@/lib/validators";

export const maxDuration = 60; // Allow up to 60 seconds for AI processing

// ── System prompt (Fix 1: separate from user message) ───────────────────────

const SYSTEM_PROMPT = `You are a senior financial analyst specializing in Argentine capital markets. You have deep expertise in:
- The IOL (InvertirOnline) broker ecosystem and Argentine securities
- CEDEARs (Argentine depositary receipts of foreign stocks)
- Argentine bonds (Bonares, Globales) and Obligaciones Negociables
- USD/ARS dynamics including MEP (dolar bolsa) and CCL rates
- Merval index composition and sectoral analysis
- Latin American macro trends impacting Argentine markets

Your task is to analyze market reports/newsletters and provide actionable insights. For each recommendation, you MUST include a confidence level:
- "high": the asset is directly mentioned in the report with clear evidence supporting the recommendation
- "medium": the recommendation is inferred from the report's context, sector trends, or indirect references
- "low": the recommendation is speculative, based on general market knowledge rather than the specific report

Always respond with valid JSON matching this exact structure:
{
  "summary": ["point 1", "point 2", ...],
  "mentionedAssets": ["TICKER1", "TICKER2", ...],
  "recommendations": {
    "buy": [{"ticker": "XXX", "reason": "...", "confidence": "high|medium|low"}],
    "sell": [{"ticker": "XXX", "reason": "...", "confidence": "high|medium|low"}],
    "hold": [{"ticker": "XXX", "reason": "...", "confidence": "high|medium|low"}]
  },
  "risks": ["risk 1", "risk 2", ...],
  "sentiment": "Bullish" | "Neutral" | "Bearish",
  "sentimentReason": "Brief explanation of overall sentiment"
}

Important: Only return valid JSON, no markdown code blocks or additional text.`;

// ── Retry helper (Fix 4: exponential backoff for 429 and 5xx) ───────────────

async function callClaudeWithRetry(
  anthropic: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  maxAttempts: number = 3,
): Promise<Anthropic.Message> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (error: unknown) {
      lastError = error;

      // Only retry on rate limit (429) or server errors (5xx)
      const status =
        error instanceof Anthropic.APIError ? error.status : undefined;

      if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
        // 4xx client errors (except 429) — do not retry
        throw error;
      }

      if (attempt < maxAttempts) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(
          `[Insights] Claude API attempt ${attempt}/${maxAttempts} failed (status: ${status ?? "unknown"}), retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

// ── Main handler ────────────────────────────────────────────────────────────

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

    // Get the form data with PDF file
    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;
    const portfolioJson = formData.get("portfolio") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 },
      );
    }

    // Validate MIME type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF files are accepted." },
        { status: 400 },
      );
    }

    // Parse portfolio data
    let portfolio: Array<{
      ticker: string;
      name: string;
      category: string;
      quantity: number;
      currentValue: number;
      pnl: number;
      pnlPercent: number;
    }> = [];

    if (portfolioJson) {
      try {
        portfolio = JSON.parse(portfolioJson);
      } catch {
        // Ignore parse errors, continue without portfolio
      }
    }

    // Extract text from PDF using pdf-parse v1
    // Dynamic import to avoid loading test files at module evaluation
    const pdfParse = (await import("pdf-parse")).default;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate PDF magic bytes (%PDF-)
    if (buffer.length < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return NextResponse.json(
        { error: "Invalid PDF file. File does not contain valid PDF data." },
        { status: 400 },
      );
    }
    const pdfData = await pdfParse(buffer);
    const emailContent = pdfData.text as string;

    if (!emailContent || emailContent.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract sufficient text from PDF" },
        { status: 400 },
      );
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Add ANTHROPIC_API_KEY to environment." },
        { status: 500 },
      );
    }

    // Build portfolio context for user message
    const portfolioContext =
      portfolio.length > 0
        ? `\n## Current Portfolio Holdings:\n${portfolio
            .map(
              (p) =>
                `- ${p.ticker} (${p.name}): ${p.quantity} units, Value: $${p.currentValue.toFixed(2)}, P&L: ${p.pnl >= 0 ? "+" : ""}$${p.pnl.toFixed(2)} (${p.pnlPercent >= 0 ? "+" : ""}${p.pnlPercent.toFixed(2)}%), Category: ${p.category}`,
            )
            .join("\n")}\n`
        : "\n## No portfolio data available - provide general market insights.\n";

    // Call Claude API with retry logic (Fixes 1, 2, 4, 5)
    const anthropic = new Anthropic({ apiKey });

    const message = await callClaudeWithRetry(anthropic, {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.3, // Fix 2: deterministic financial analysis
      system: SYSTEM_PROMPT, // Fix 1: system prompt as dedicated parameter
      messages: [
        {
          role: "user",
          content: `Analyze the following market report and my portfolio holdings. Provide actionable insights with confidence levels for each recommendation.

## Market Report Content:
${emailContent}

${portfolioContext}

## Instructions:
1. Summarize the key points from the market report (3-5 bullet points)
2. Identify any specific stocks, sectors, or assets mentioned
3. Based on the report and the user's current portfolio (if provided):
   - Suggest potential BUY opportunities (with reasoning and confidence)
   - Suggest potential SELL or reduce positions (with reasoning and confidence)
   - Identify HOLD positions that align with the report's outlook (with confidence)
4. Highlight any risks or warnings mentioned
5. Provide an overall market sentiment assessment (Bullish/Neutral/Bearish)`,
        },
      ],
    });

    // Extract the text content
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse and validate JSON response (Fix 3: Zod validation)
    let analysis;
    try {
      // Try to extract JSON if wrapped in code blocks
      const jsonMatch = responseText.match(
        /```(?:json)?\s*([\s\S]*?)\s*```/,
      ) || [null, responseText];
      const parsed = JSON.parse(jsonMatch[1] || responseText);

      // Validate with Zod schema — adds confidence field guarantees
      const validated = analysisResponseSchema.safeParse(parsed);

      if (validated.success) {
        analysis = validated.data;
      } else {
        console.warn(
          "[Insights] Zod validation failed, applying defaults:",
          validated.error.issues,
        );
        // Attempt to salvage the response by backfilling missing confidence
        analysis = {
          summary: Array.isArray(parsed.summary) ? parsed.summary : [responseText],
          mentionedAssets: Array.isArray(parsed.mentionedAssets) ? parsed.mentionedAssets : [],
          recommendations: {
            buy: backfillConfidence(parsed.recommendations?.buy),
            sell: backfillConfidence(parsed.recommendations?.sell),
            hold: backfillConfidence(parsed.recommendations?.hold),
          },
          risks: Array.isArray(parsed.risks) ? parsed.risks : [],
          sentiment: ["Bullish", "Neutral", "Bearish"].includes(parsed.sentiment)
            ? parsed.sentiment
            : "Neutral",
          sentimentReason: parsed.sentimentReason || "Analysis completed",
        };
      }
    } catch {
      // If JSON parsing itself fails, return raw text as fallback
      return NextResponse.json({
        analysis: {
          summary: [responseText],
          mentionedAssets: [],
          recommendations: { buy: [], sell: [], hold: [] },
          risks: [],
          sentiment: "Neutral" as const,
          sentimentReason: "Could not parse structured response",
        },
        raw: responseText,
      });
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("[Insights] Analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 },
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Backfill confidence="low" for recommendations that lack it */
function backfillConfidence(
  recs: unknown,
): Array<{ ticker: string; reason: string; confidence: "high" | "medium" | "low" }> {
  if (!Array.isArray(recs)) return [];
  return recs
    .filter(
      (r): r is { ticker: string; reason: string; confidence?: string } =>
        typeof r === "object" &&
        r !== null &&
        typeof r.ticker === "string" &&
        typeof r.reason === "string",
    )
    .map((r) => ({
      ticker: r.ticker,
      reason: r.reason,
      confidence:
        r.confidence === "high" || r.confidence === "medium" || r.confidence === "low"
          ? r.confidence
          : "low",
    }));
}
