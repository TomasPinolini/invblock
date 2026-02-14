import { NextResponse } from "next/server";
import { IOLClient, IOLTokenExpiredError } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import type { IOLInstrumentType, IOLSecurityWithQuote } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { getQuote } from "@/services/yahoo/client";
import { getTickersByType } from "@/lib/tickers";
import type { TickerEntry } from "@/lib/tickers";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const VALID_INSTRUMENT_TYPES: IOLInstrumentType[] = [
  "cedears",
  "acciones",
  "aDRs",
  "titulosPublicos",
  "obligacionesNegociables",
  "letras",
  "cauciones",
  "opciones",
  "futuros",
  "cHPD",
];

export async function GET(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = checkRateLimit(user.id, "securities", RATE_LIMITS.securities);
  if (rateLimited) return rateLimited;

  const { searchParams } = new URL(request.url);
  const country = (searchParams.get("country") as "argentina" | "estados_Unidos") || "argentina";
  const instrumentType = searchParams.get("type") as IOLInstrumentType | null;
  const panel = searchParams.get("panel"); // For BCBA panels like "lideres", "general"
  const search = searchParams.get("search")?.toLowerCase();

  // Validate instrument type if provided
  if (instrumentType && !VALID_INSTRUMENT_TYPES.includes(instrumentType)) {
    return NextResponse.json(
      { error: `Invalid instrument type. Valid types: ${VALID_INSTRUMENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // Get IOL credentials
    const connection = await db.query.userConnections.findFirst({
      where: and(
        eq(userConnections.userId, user.id),
        eq(userConnections.provider, "iol")
      ),
    });

    if (!connection) {
      return NextResponse.json(
        { error: "IOL account not connected" },
        { status: 400 }
      );
    }

    const token = decryptCredentials<IOLToken>(connection.credentials);
    const client = new IOLClient(token);

    let securities;

    if (panel) {
      // Fetch by panel (BCBA only)
      securities = await client.getPanel(panel);
    } else {
      // Fetch by country and optionally by instrument type
      securities = await client.listInstruments(
        country,
        instrumentType ?? undefined
      );
    }

    // Update token if refreshed
    const newToken = client.getToken();
    if (newToken && newToken.access_token !== token.access_token) {
      await db
        .update(userConnections)
        .set({
          credentials: encryptCredentials(newToken),
          updatedAt: new Date(),
        })
        .where(eq(userConnections.id, connection.id));
    }

    // Apply search filter if provided
    let filteredSecurities = securities;
    if (search) {
      filteredSecurities = securities.filter(
        (s) =>
          s.simbolo.toLowerCase().includes(search) ||
          s.descripcion.toLowerCase().includes(search)
      );
    }

    // Sort by daily change (most active first)
    filteredSecurities.sort((a, b) => {
      const aChange = Math.abs(a.variacionPorcentual || 0);
      const bChange = Math.abs(b.variacionPorcentual || 0);
      return bChange - aChange;
    });

    return NextResponse.json({
      securities: filteredSecurities,
      count: filteredSecurities.length,
      country,
      instrumentType: instrumentType || "all",
      panel: panel || null,
    });
  } catch (error) {
    if (error instanceof IOLTokenExpiredError) {
      return NextResponse.json({ expired: true, securities: [], error: "Session expired" });
    }
    console.error("Securities list error:", error);

    // When IOL API returns 500 (market closed), return a static fallback list
    // so the page is still browsable for watchlist/discovery
    const isMarketClosed =
      error instanceof Error && error.message.includes("500");

    if (isMarketClosed) {
      let fallback = await getFallbackSecurities(instrumentType || undefined);

      if (search) {
        fallback = fallback.filter(
          (s) =>
            s.simbolo.toLowerCase().includes(search) ||
            s.descripcion.toLowerCase().includes(search)
        );
      }

      return NextResponse.json({
        securities: fallback,
        count: fallback.length,
        country,
        instrumentType: instrumentType || "all",
        panel: panel || null,
        marketClosed: true,
      });
    }

    return NextResponse.json(
      {
        securities: [],
        error: error instanceof Error ? error.message : "Failed to fetch securities",
      },
      { status: 500 }
    );
  }
}

// Fallback ticker data is centralized in src/lib/tickers.ts

// ── Yahoo Finance price cache ─────────────────────────────────────────────
// Cache last-close prices for 6 hours (prices don't change while market is closed)

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface PriceEntry {
  price: number;
  change: number;
  currency: string;
}

interface PriceCache {
  prices: Map<string, PriceEntry>;
  fetchedAt: number;
}

let priceCache: PriceCache | null = null;

function mapFallbackCategory(type: string): string {
  switch (type) {
    case "cedears": return "cedear";
    case "acciones": return "stock";
    default: return "stock";
  }
}

async function fetchLastClosePrices(entries: TickerEntry[]): Promise<Map<string, PriceEntry>> {
  // Return cached if still fresh
  if (priceCache && Date.now() - priceCache.fetchedAt < CACHE_TTL_MS) {
    return priceCache.prices;
  }

  const prices = new Map<string, PriceEntry>();

  // Fetch from Yahoo Finance in parallel batches
  const BATCH_SIZE = 8;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const category = mapFallbackCategory(entry.type);
        const quote = await getQuote(entry.simbolo, category);
        if (quote && quote.price > 0) {
          prices.set(entry.simbolo, {
            price: quote.price,
            change: quote.changePercent,
            currency: quote.currency,
          });
        }
      })
    );
    // Log failures but don't block
    for (const r of results) {
      if (r.status === "rejected") {
        console.warn("[Fallback price fetch] Failed:", r.reason);
      }
    }
  }

  // Cache the results
  priceCache = { prices, fetchedAt: Date.now() };
  return prices;
}

async function getFallbackSecurities(
  instrumentType?: IOLInstrumentType
): Promise<IOLSecurityWithQuote[]> {
  const entries = getTickersByType(instrumentType || undefined);

  // Try to fetch last close prices from Yahoo Finance
  let prices = new Map<string, PriceEntry>();
  try {
    prices = await fetchLastClosePrices(entries);
  } catch (err) {
    console.warn("[Fallback] Yahoo Finance price fetch failed, returning without prices:", err);
  }

  return entries.map((e) => {
    const priceData = prices.get(e.simbolo);
    return {
      simbolo: e.simbolo,
      descripcion: e.descripcion,
      ultimoPrecio: priceData?.price ?? 0,
      variacionPorcentual: priceData?.change ?? 0,
      moneda: priceData?.currency,
    };
  });
}
