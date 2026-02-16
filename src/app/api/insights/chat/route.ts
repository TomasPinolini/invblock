import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { fetchMacroData } from "@/services/macro/client";

export const maxDuration = 120;

// ── Input Validation ──────────────────────────────────────────────────────────

const portfolioAssetSchema = z.object({
  ticker: z.string().min(1),
  name: z.string().optional().default(""),
  category: z.string().optional().default(""),
  currency: z.string().optional().default("USD"),
  quantity: z.number().nonnegative(),
  currentValue: z.number().nonnegative(),
  pnl: z.number().optional().default(0),
  pnlPercent: z.number().optional().default(0),
  allocation: z.number().nonnegative().optional().default(0),
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(10000),
});

const chatInputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(50),
  portfolio: z.array(portfolioAssetSchema).default([]),
});

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

    // 2. Rate limit
    const rateLimited = checkRateLimit(user.id, "chat", RATE_LIMITS.chat);
    if (rateLimited) return rateLimited;

    // 3. Parse input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = chatInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { messages, portfolio } = parsed.data;

    // 4. API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured." },
        { status: 500 }
      );
    }

    // 5. Build system prompt with portfolio + macro context
    const portfolioSummary =
      portfolio.length > 0
        ? portfolio
            .map(
              (a) =>
                `- ${a.ticker} (${a.name || a.category}): $${a.currentValue.toFixed(2)}, ${(a.pnlPercent ?? 0) >= 0 ? "+" : ""}${(a.pnlPercent ?? 0).toFixed(1)}%, ${(a.allocation ?? 0).toFixed(1)}% of portfolio`
            )
            .join("\n")
        : "No portfolio data provided.";

    let macroBlock = "";
    try {
      const macro = await fetchMacroData();
      const blue = macro.dollars.find((d) => d.name === "Blue");
      const mep = macro.dollars.find((d) => d.name === "MEP");
      macroBlock = `\nLive Argentine Macro Data:
- Dollar Blue: ${blue?.sell ? `$${blue.sell.toFixed(0)}` : "N/A"} | MEP: ${mep?.sell ? `$${mep.sell.toFixed(0)}` : "N/A"}
- Country Risk: ${macro.countryRisk ? `${macro.countryRisk} bp` : "N/A"}
- Monthly CPI: ${macro.monthlyCpi ? `${macro.monthlyCpi.toFixed(1)}%` : "N/A"}`;
    } catch {
      // Macro unavailable, continue without it
    }

    const systemPrompt = `You are a knowledgeable Argentine investment analyst having a conversation with a retail investor. You have access to their portfolio and real-time macro data.

Portfolio (${portfolio.length} positions):
${portfolioSummary}
${macroBlock}

Guidelines:
- Be concise but thorough. Use specific numbers from the portfolio.
- When discussing CEDEARs, consider the underlying USD asset and ARS/USD dynamics.
- For Argentine stocks, consider local macro conditions (inflation, interest rates, political risk).
- Always caveat that this is not financial advice.
- Answer in the same language the user writes in (Spanish or English).
- Use markdown formatting for readability (bold, lists, code for numbers).`;

    // 6. Stream response via SSE
    const anthropic = new Anthropic({ apiKey });

    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.5,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Convert Anthropic stream to SSE ReadableStream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const data = JSON.stringify({ text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("[chat] Streaming error:", error);
          const errMsg = JSON.stringify({
            error: error instanceof Error ? error.message : "Stream error",
          });
          controller.enqueue(encoder.encode(`data: ${errMsg}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[chat] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 }
    );
  }
}
