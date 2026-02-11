import { NextResponse } from "next/server";
import { IOLClient, IOLTokenExpiredError } from "@/services/iol";
import type { IOLToken } from "@/services/iol";
import type { IOLInstrumentType, IOLSecurityWithQuote } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { getQuote } from "@/services/yahoo/client";
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

// Static fallback data for when the market is closed
// Covers popular CEDEARs and Argentine stocks so users can still browse & add to watchlist
type FallbackEntry = { simbolo: string; descripcion: string; type: IOLInstrumentType };

const FALLBACK_INSTRUMENTS: FallbackEntry[] = [
  // CEDEARs
  { simbolo: "AAPL", descripcion: "Apple Inc.", type: "cedears" },
  { simbolo: "MSFT", descripcion: "Microsoft Corp.", type: "cedears" },
  { simbolo: "GOOGL", descripcion: "Alphabet Inc.", type: "cedears" },
  { simbolo: "AMZN", descripcion: "Amazon.com Inc.", type: "cedears" },
  { simbolo: "META", descripcion: "Meta Platforms Inc.", type: "cedears" },
  { simbolo: "NVDA", descripcion: "NVIDIA Corp.", type: "cedears" },
  { simbolo: "TSLA", descripcion: "Tesla Inc.", type: "cedears" },
  { simbolo: "MELI", descripcion: "MercadoLibre Inc.", type: "cedears" },
  { simbolo: "GLOB", descripcion: "Globant S.A.", type: "cedears" },
  { simbolo: "BABA", descripcion: "Alibaba Group", type: "cedears" },
  { simbolo: "KO", descripcion: "Coca-Cola Co.", type: "cedears" },
  { simbolo: "DIS", descripcion: "Walt Disney Co.", type: "cedears" },
  { simbolo: "NFLX", descripcion: "Netflix Inc.", type: "cedears" },
  { simbolo: "JPM", descripcion: "JPMorgan Chase & Co.", type: "cedears" },
  { simbolo: "V", descripcion: "Visa Inc.", type: "cedears" },
  { simbolo: "WMT", descripcion: "Walmart Inc.", type: "cedears" },
  { simbolo: "BA", descripcion: "Boeing Co.", type: "cedears" },
  { simbolo: "AMD", descripcion: "Advanced Micro Devices", type: "cedears" },
  { simbolo: "INTC", descripcion: "Intel Corp.", type: "cedears" },
  { simbolo: "PBR", descripcion: "Petrobras S.A.", type: "cedears" },
  { simbolo: "VALE", descripcion: "Vale S.A.", type: "cedears" },
  { simbolo: "BBD", descripcion: "Banco Bradesco S.A.", type: "cedears" },
  { simbolo: "GOLD", descripcion: "Barrick Gold Corp.", type: "cedears" },
  { simbolo: "X", descripcion: "United States Steel Corp.", type: "cedears" },
  // Acciones argentinas
  { simbolo: "GGAL", descripcion: "Grupo Financiero Galicia", type: "acciones" },
  { simbolo: "YPF", descripcion: "YPF S.A.", type: "acciones" },
  { simbolo: "PAMP", descripcion: "Pampa Energía S.A.", type: "acciones" },
  { simbolo: "BBAR", descripcion: "Banco BBVA Argentina", type: "acciones" },
  { simbolo: "BMA", descripcion: "Banco Macro S.A.", type: "acciones" },
  { simbolo: "SUPV", descripcion: "Grupo Supervielle S.A.", type: "acciones" },
  { simbolo: "TECO2", descripcion: "Telecom Argentina S.A.", type: "acciones" },
  { simbolo: "TXAR", descripcion: "Ternium Argentina S.A.", type: "acciones" },
  { simbolo: "ALUA", descripcion: "Aluar Aluminio Argentino", type: "acciones" },
  { simbolo: "CRES", descripcion: "Cresud S.A.", type: "acciones" },
  { simbolo: "MIRG", descripcion: "Mirgor S.A.", type: "acciones" },
  { simbolo: "LOMA", descripcion: "Loma Negra C.I.A.S.A.", type: "acciones" },
  { simbolo: "CEPU", descripcion: "Central Puerto S.A.", type: "acciones" },
  { simbolo: "EDN", descripcion: "Edenor S.A.", type: "acciones" },
  { simbolo: "TGSU2", descripcion: "Transportadora de Gas del Sur", type: "acciones" },
  { simbolo: "TGNO4", descripcion: "Transportadora de Gas del Norte", type: "acciones" },
  { simbolo: "VALO", descripcion: "Grupo Valores S.A.", type: "acciones" },
  { simbolo: "COME", descripcion: "Sociedad Comercial del Plata", type: "acciones" },
  // Bonos
  { simbolo: "AL30", descripcion: "Bono Argentina 2030 (Ley Arg.)", type: "titulosPublicos" },
  { simbolo: "GD30", descripcion: "Bono Argentina 2030 (Ley NY)", type: "titulosPublicos" },
  { simbolo: "AL35", descripcion: "Bono Argentina 2035 (Ley Arg.)", type: "titulosPublicos" },
  { simbolo: "GD35", descripcion: "Bono Argentina 2035 (Ley NY)", type: "titulosPublicos" },
  { simbolo: "AL41", descripcion: "Bono Argentina 2041 (Ley Arg.)", type: "titulosPublicos" },
  { simbolo: "GD41", descripcion: "Bono Argentina 2041 (Ley NY)", type: "titulosPublicos" },
  { simbolo: "AE38", descripcion: "Bono Argentina 2038", type: "titulosPublicos" },
  { simbolo: "GD38", descripcion: "Bono Argentina 2038 (Ley NY)", type: "titulosPublicos" },
  { simbolo: "S31O5", descripcion: "LECAP Oct 2025", type: "titulosPublicos" },
  { simbolo: "TX26", descripcion: "Boncer 2026", type: "titulosPublicos" },
  // ONs
  { simbolo: "YCA6O", descripcion: "ON YPF 2026 USD", type: "obligacionesNegociables" },
  { simbolo: "MRCAO", descripcion: "ON Mirgor 2026", type: "obligacionesNegociables" },
  { simbolo: "TLCHO", descripcion: "ON Telecom 2026", type: "obligacionesNegociables" },
  { simbolo: "PNDCO", descripcion: "ON Pampa Energía", type: "obligacionesNegociables" },
  { simbolo: "YMCHO", descripcion: "ON YPF 2026 clase XLVII", type: "obligacionesNegociables" },
];

// ── Yahoo Finance price cache ─────────────────────────────────────────────
// Cache last-close prices for 6 hours (prices don't change while market is closed)

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface PriceCache {
  prices: Map<string, { price: number; change: number }>;
  fetchedAt: number;
}

let priceCache: PriceCache | null = null;

function mapFallbackCategory(type: IOLInstrumentType): string {
  switch (type) {
    case "cedears": return "cedear";
    case "acciones": return "stock";
    default: return "stock";
  }
}

async function fetchLastClosePrices(): Promise<Map<string, { price: number; change: number }>> {
  // Return cached if still fresh
  if (priceCache && Date.now() - priceCache.fetchedAt < CACHE_TTL_MS) {
    return priceCache.prices;
  }

  const prices = new Map<string, { price: number; change: number }>();

  // Fetch from Yahoo Finance in parallel batches
  const BATCH_SIZE = 8;
  for (let i = 0; i < FALLBACK_INSTRUMENTS.length; i += BATCH_SIZE) {
    const batch = FALLBACK_INSTRUMENTS.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const category = mapFallbackCategory(entry.type);
        const quote = await getQuote(entry.simbolo, category);
        if (quote && quote.price > 0) {
          prices.set(entry.simbolo, {
            price: quote.price,
            change: quote.changePercent,
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
  let entries = FALLBACK_INSTRUMENTS;

  if (instrumentType) {
    entries = entries.filter((e) => e.type === instrumentType);
  }

  // Try to fetch last close prices from Yahoo Finance
  let prices = new Map<string, { price: number; change: number }>();
  try {
    prices = await fetchLastClosePrices();
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
    };
  });
}
