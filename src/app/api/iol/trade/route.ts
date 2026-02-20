import { NextResponse } from "next/server";
import { IOLClient } from "@/services/iol";
import { getAuthUser } from "@/lib/auth";
import { decryptCredentials, encryptCredentials } from "@/lib/crypto";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { tradeSchema, parseBody } from "@/lib/api-schemas";
import { db } from "@/db";
import { userConnections, tradeAuditLog } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { IOLToken, IOLOrderRequest } from "@/services/iol";

function getClientIp(request: Request): string {
  const headers = new Headers(request.headers);
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: max 5 trades per minute
  const rateLimited = await checkRateLimit(user.id, "trade", RATE_LIMITS.trade);
  if (rateLimited) return rateLimited;

  try {
    const raw = await request.json();
    const [body, validationError] = parseBody(tradeSchema, raw);
    if (validationError) return validationError;

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

    // For sell orders, verify the user holds enough shares
    if (body.action === "sell") {
      const { argentina, us } = await client.getAllPortfolios();
      const allAssets = [
        ...(argentina.activos || []),
        ...(us.activos || []),
      ];
      const symbolUpper = body.simbolo.toUpperCase();
      const holding = allAssets.find(
        (item) => item.titulo?.simbolo?.toUpperCase() === symbolUpper
      );
      const heldQuantity = holding?.cantidad ?? 0;

      if (heldQuantity < body.cantidad) {
        return NextResponse.json(
          {
            error: `Insufficient holdings: you have ${heldQuantity} shares of ${symbolUpper}`,
          },
          { status: 400 }
        );
      }
    }

    // Build order request
    const order: IOLOrderRequest = {
      mercado: body.mercado,
      simbolo: body.simbolo.toUpperCase(),
      cantidad: body.cantidad,
      precio: body.precio,
      plazo: body.plazo,
      validez: body.validez,
      tipoOrden: body.tipoOrden,
    };

    const clientIp = getClientIp(request);

    // Log trade attempt
    await db.insert(tradeAuditLog).values({
      userId: user.id,
      action: body.action,
      mercado: body.mercado,
      simbolo: order.simbolo,
      cantidad: String(order.cantidad),
      precio: String(order.precio),
      plazo: order.plazo,
      tipoOrden: order.tipoOrden,
      status: "attempted",
      ip: clientIp,
    });

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
          credentials: encryptCredentials(newToken),
          updatedAt: new Date(),
        })
        .where(eq(userConnections.id, connection.id));
    }

    if (!result.ok) {
      // Log failed trade
      await db.insert(tradeAuditLog).values({
        userId: user.id,
        action: body.action,
        mercado: body.mercado,
        simbolo: order.simbolo,
        cantidad: String(order.cantidad),
        precio: String(order.precio),
        plazo: order.plazo,
        tipoOrden: order.tipoOrden,
        status: "failed",
        responseMessage: result.error || "Trade failed",
        ip: clientIp,
      });

      return NextResponse.json(
        {
          ok: false,
          error: result.error || "Trade failed",
        },
        { status: 400 }
      );
    }

    // Log successful trade
    await db.insert(tradeAuditLog).values({
      userId: user.id,
      action: body.action,
      mercado: body.mercado,
      simbolo: order.simbolo,
      cantidad: String(order.cantidad),
      precio: String(order.precio),
      plazo: order.plazo,
      tipoOrden: order.tipoOrden,
      status: "success",
      numeroOperacion: result.numeroOperacion ? String(result.numeroOperacion) : undefined,
      responseMessage: result.mensaje,
      ip: clientIp,
    });

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

    const token = decryptCredentials<IOLToken>(connection.credentials);
    const client = new IOLClient(token);

    const clientIp = getClientIp(request);

    // Log cancel attempt
    await db.insert(tradeAuditLog).values({
      userId: user.id,
      action: "cancel",
      simbolo: String(opNum),
      status: "attempted",
      ip: clientIp,
    });

    const result = await client.cancelOrder(opNum);

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

    if (!result.ok) {
      await db.insert(tradeAuditLog).values({
        userId: user.id,
        action: "cancel",
        simbolo: String(opNum),
        status: "failed",
        responseMessage: result.error || "Cancel failed",
        ip: clientIp,
      });

      return NextResponse.json(
        {
          ok: false,
          error: result.error || "Cancel failed",
        },
        { status: 400 }
      );
    }

    await db.insert(tradeAuditLog).values({
      userId: user.id,
      action: "cancel",
      simbolo: String(opNum),
      status: "success",
      responseMessage: result.mensaje,
      ip: clientIp,
    });

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
