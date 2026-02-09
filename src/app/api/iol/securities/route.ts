import { NextResponse } from "next/server";
import { IOLClient } from "@/services/iol";
import type { IOLInstrumentType } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
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

    const token = JSON.parse(connection.credentials);
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
          credentials: JSON.stringify(newToken),
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
    console.error("Securities list error:", error);
    return NextResponse.json(
      {
        securities: [],
        error: error instanceof Error ? error.message : "Failed to fetch securities",
      },
      { status: 500 }
    );
  }
}
