import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { alertNarrativeRequestSchema, alertNarrativeResponseSchema } from "@/lib/api-schemas";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

// --- Retry logic (same as health route) ---

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

      const delay = Math.pow(2, attempt - 1) * 1000;
      console.warn(
        `[AlertNarrative] Claude API attempt ${attempt} failed (status ${error instanceof Anthropic.APIError ? error.status : "unknown"}), retrying in ${delay}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error("Max retry attempts exceeded");
}

// --- System prompt ---

const SYSTEM_PROMPT = `You are a financial market analyst specializing in the Argentine market. Your job is to explain why a price alert was triggered — what likely caused the price movement.

Context about the Argentine market:
- CEDEARs are Argentine depository receipts of US stocks, traded in ARS on the BCBA. Price movements can reflect both the underlying US stock AND ARS/USD exchange rate changes.
- The Merval index tracks Argentine stocks. Political events, central bank decisions, and IMF negotiations heavily impact local markets.
- Crypto assets (BTC, ETH, etc.) are influenced by global crypto market sentiment, regulatory news, and macro events.
- Argentine markets are highly sensitive to: inflation data, currency controls ("cepo"), sovereign debt negotiations, and political developments.

Important: You are providing plausible explanations based on common market dynamics. You cannot verify real-time news. Frame explanations as likely causes, not definitive facts.

You MUST respond with ONLY valid JSON matching this exact structure (no markdown, no code blocks, no extra text):
{
  "narrative": "<2-4 sentence explanation of why the price likely moved>",
  "factors": ["<factor 1>", "<factor 2>", ...],
  "sentiment": "positive" | "negative" | "neutral"
}

Rules:
- The narrative should be concise but informative (2-4 sentences).
- Provide 1-3 factors (short phrases) that likely contributed to the price movement.
- Sentiment reflects the market move direction: "positive" if price went up, "negative" if price went down, "neutral" if unclear.
- Write in English.
- Be specific to the ticker and market context when possible.`;

// --- Route handler ---

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Parse and validate request body
    const body = await request.json();
    const parsed = alertNarrativeRequestSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError.message, field: firstError.path.join(".") },
        { status: 400 }
      );
    }

    const { alertId } = parsed.data;

    // Fetch alert and verify ownership
    const { data: alert, error: fetchError } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("id", alertId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    // Only triggered alerts can have narratives
    if (alert.is_active) {
      return NextResponse.json(
        { error: "Alert is still active. Narratives are only available for triggered alerts." },
        { status: 400 }
      );
    }

    // Cache check — return existing narrative without consuming rate limit
    if (alert.narrative) {
      return NextResponse.json({
        narrative: alert.narrative.narrative,
        factors: alert.narrative.factors,
        sentiment: alert.narrative.sentiment,
        cached: true,
      });
    }

    // Rate limit (shared insights bucket)
    const rateLimited = await checkRateLimit(user.id, "insights", RATE_LIMITS.insights);
    if (rateLimited) return rateLimited;

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Add ANTHROPIC_API_KEY to environment." },
        { status: 500 }
      );
    }

    // Compute price delta
    const currentPrice = alert.current_price ?? alert.target_price;
    const delta = currentPrice - alert.target_price;
    const deltaPct = alert.target_price > 0
      ? ((delta / alert.target_price) * 100).toFixed(2)
      : "0.00";

    // Build user message
    const triggeredDate = alert.triggered_at
      ? new Date(alert.triggered_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "unknown date";

    const userMessage = `A price alert was triggered. Please explain the likely cause of this price movement.

## Alert Details
- Ticker: ${alert.ticker}
- Condition: Price went ${alert.condition} ${alert.target_price}
- Target price: $${alert.target_price}
- Price at trigger: $${currentPrice}
- Price delta: ${delta >= 0 ? "+" : ""}$${delta.toFixed(2)} (${delta >= 0 ? "+" : ""}${deltaPct}%)
- Triggered on: ${triggeredDate}
- Alert created: ${new Date(alert.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;

    // Call Claude
    const anthropic = new Anthropic({ apiKey });

    const message = await callClaudeWithRetry(anthropic, {
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
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
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      rawParsed = JSON.parse(jsonMatch ? jsonMatch[1] : responseText);
    } catch {
      console.error("[AlertNarrative] Failed to parse Claude response:", responseText.slice(0, 500));
      return NextResponse.json(
        { error: "AI returned an invalid response. Please try again." },
        { status: 502 }
      );
    }

    const validated = alertNarrativeResponseSchema.safeParse(rawParsed);

    if (!validated.success) {
      console.error("[AlertNarrative] Claude response failed validation:", validated.error.flatten());
      return NextResponse.json(
        { error: "AI returned an unexpected format. Please try again." },
        { status: 502 }
      );
    }

    // Save narrative to DB (cache for future requests)
    const narrativeData = {
      narrative: validated.data.narrative,
      factors: validated.data.factors,
      sentiment: validated.data.sentiment,
    };

    const { error: updateError } = await supabase
      .from("price_alerts")
      .update({
        narrative: narrativeData,
        narrative_generated_at: new Date().toISOString(),
      })
      .eq("id", alertId);

    if (updateError) {
      console.error("[AlertNarrative] Failed to save narrative:", updateError);
      // Still return the narrative even if saving fails
    }

    return NextResponse.json({
      narrative: validated.data.narrative,
      factors: validated.data.factors,
      sentiment: validated.data.sentiment,
      cached: false,
    });
  } catch (error) {
    console.error("[AlertNarrative] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Narrative generation failed" },
      { status: 500 }
    );
  }
}
