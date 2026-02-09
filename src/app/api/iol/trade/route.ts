import { NextResponse } from "next/server";
import { IOLClient } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/db";
import { userConnections } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { IOLOrderRequest, IOLSettlement, IOLOrderType } from "@/services/iol";

interface TradeRequestBody {
  action: "buy" | "sell";
  mercado: string;
  simbolo: string;
  cantidad: number;
  precio: number;
  plazo?: IOLSettlement;
  validez?: string;
  tipoOrden?: IOLOrderType;
}

export async function POST(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: TradeRequestBody = await request.json();

    // Validate required fields
    if (!body.action || !["buy", "sell"].includes(body.action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'buy' or 'sell'" },
        { status: 400 }
      );
    }

    if (!body.mercado || !body.simbolo) {
      return NextResponse.json(
        { error: "Missing mercado or simbolo" },
        { status: 400 }
      );
    }

    if (!body.cantidad || body.cantidad <= 0) {
      return NextResponse.json(
        { error: "Invalid cantidad. Must be positive" },
        { status: 400 }
      );
    }

    if (!body.precio || body.precio <= 0) {
      return NextResponse.json(
        { error: "Invalid precio. Must be positive" },
        { status: 400 }
      );
    }

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

    // Build order request
    const order: IOLOrderRequest = {
      mercado: body.mercado,
      simbolo: body.simbolo.toUpperCase(),
      cantidad: body.cantidad,
      precio: body.precio,
      plazo: body.plazo || "t2", // Default to T+2 settlement
      validez: body.validez || new Date().toISOString().split("T")[0], // Default to today
      tipoOrden: body.tipoOrden || "precioLimite",
    };

    // Execute the trade
    const result =
      body.action === "buy"
        ? await client.placeBuyOrder(order)
        : await client.placeSellOrder(order);

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

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || "Trade failed",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      numeroOperacion: result.numeroOperacion,
      mensaje: result.mensaje,
      order: {
        action: body.action,
        simbolo: order.simbolo,
        cantidad: order.cantidad,
        precio: order.precio,
        plazo: order.plazo,
      },
    });
  } catch (error) {
    console.error("Trade error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Trade execution failed",
      },
      { status: 500 }
    );
  }
}

// Cancel an existing order
export async function DELETE(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const operationNumber = searchParams.get("operationNumber");

    if (!operationNumber) {
      return NextResponse.json(
        { error: "Missing operationNumber parameter" },
        { status: 400 }
      );
    }

    const opNum = parseInt(operationNumber, 10);
    if (isNaN(opNum)) {
      return NextResponse.json(
        { error: "Invalid operationNumber" },
        { status: 400 }
      );
    }

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

    const result = await client.cancelOrder(opNum);

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

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || "Cancel failed",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      mensaje: result.mensaje,
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Cancel failed",
      },
      { status: 500 }
    );
  }
}
