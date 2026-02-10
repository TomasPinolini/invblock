import { NextResponse } from "next/server";

interface DolarApiResponse {
  moneda: string;
  casa: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

// Cache the rate server-side (5 minutes)
let cachedRate: { rate: number; updatedAt: string } | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function GET() {
  const now = Date.now();

  // Return cached if fresh
  if (cachedRate && now < cacheExpiry) {
    return NextResponse.json(cachedRate);
  }

  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/blue", {
      next: { revalidate: 300 }, // ISR cache 5 min
    });

    if (!res.ok) {
      throw new Error(`dolarapi returned ${res.status}`);
    }

    const data: DolarApiResponse = await res.json();

    cachedRate = {
      rate: data.venta, // Sell rate (USD→ARS)
      updatedAt: data.fechaActualizacion,
    };
    cacheExpiry = now + CACHE_TTL;

    return NextResponse.json(cachedRate);
  } catch (error) {
    // If fetch fails but we have a stale cache, use it
    if (cachedRate) {
      return NextResponse.json(cachedRate);
    }

    console.error("Exchange rate fetch error:", error);
    // Fallback — better to show approximate than nothing
    return NextResponse.json(
      { rate: null, updatedAt: null, error: "Could not fetch exchange rate" },
      { status: 502 }
    );
  }
}
