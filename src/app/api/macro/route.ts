import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchMacroData, type MacroData } from "@/services/macro/client";

// In-memory cache with 5-min TTL
let cachedData: MacroData | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return cached data if fresh
    const now = Date.now();
    if (cachedData && now - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json(cachedData);
    }

    // Fetch fresh data
    const data = await fetchMacroData();

    // Cache it
    cachedData = data;
    cachedAt = now;

    return NextResponse.json(data);
  } catch (error) {
    console.error("[macro] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch macro data" },
      { status: 500 }
    );
  }
}
