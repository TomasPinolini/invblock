import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
// Use pdf-parse/lib/pdf-parse.js directly to avoid test file loading issue
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export const maxDuration = 60; // Allow up to 60 seconds for AI processing

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the form data with PDF file
    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;
    const portfolioJson = formData.get("portfolio") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
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
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);
    const emailContent = pdfData.text as string;

    if (!emailContent || emailContent.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract sufficient text from PDF" },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service not configured. Add ANTHROPIC_API_KEY to environment." },
        { status: 500 }
      );
    }

    // Build portfolio context
    const portfolioContext = portfolio.length > 0
      ? `
## Current Portfolio Holdings:
${portfolio.map(p =>
  `- ${p.ticker} (${p.name}): ${p.quantity} units, Value: $${p.currentValue.toFixed(2)}, P&L: ${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)} (${p.pnlPercent >= 0 ? '+' : ''}${p.pnlPercent.toFixed(2)}%), Category: ${p.category}`
).join('\n')}
`
      : "\n## No portfolio data available - provide general market insights.\n";

    // Call Claude API
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are a financial analyst assistant. Analyze the following market report/newsletter and provide actionable insights.

## Market Report Content:
${emailContent}

${portfolioContext}

## Instructions:
1. Summarize the key points from the market report (3-5 bullet points)
2. Identify any specific stocks, sectors, or assets mentioned
3. Based on the report and the user's current portfolio (if provided):
   - Suggest potential BUY opportunities (with reasoning)
   - Suggest potential SELL or reduce positions (with reasoning)
   - Identify HOLD positions that align with the report's outlook
4. Highlight any risks or warnings mentioned
5. Provide an overall market sentiment assessment (Bullish/Neutral/Bearish)

Format your response as JSON with this structure:
{
  "summary": ["point 1", "point 2", ...],
  "mentionedAssets": ["TICKER1", "TICKER2", ...],
  "recommendations": {
    "buy": [{"ticker": "XXX", "reason": "..."}],
    "sell": [{"ticker": "XXX", "reason": "..."}],
    "hold": [{"ticker": "XXX", "reason": "..."}]
  },
  "risks": ["risk 1", "risk 2", ...],
  "sentiment": "Bullish" | "Neutral" | "Bearish",
  "sentimentReason": "Brief explanation of overall sentiment"
}

Important: Only return valid JSON, no markdown code blocks or additional text.`,
        },
      ],
    });

    // Extract the text content
    const responseText = message.content[0].type === "text"
      ? message.content[0].text
      : "";

    // Parse JSON response
    let analysis;
    try {
      // Try to extract JSON if wrapped in code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                        [null, responseText];
      analysis = JSON.parse(jsonMatch[1] || responseText);
    } catch {
      // If JSON parsing fails, return raw text
      return NextResponse.json({
        analysis: {
          summary: [responseText],
          mentionedAssets: [],
          recommendations: { buy: [], sell: [], hold: [] },
          risks: [],
          sentiment: "Neutral",
          sentimentReason: "Could not parse structured response",
        },
        raw: responseText,
      });
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Insights analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
