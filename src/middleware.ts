import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// State-changing HTTP methods that require CSRF validation
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

export async function middleware(request: NextRequest) {
  // ------------------------------------------------------------------
  // SEC-1: CSRF Protection for state-changing requests on /api/* routes
  // ------------------------------------------------------------------
  if (
    request.nextUrl.pathname.startsWith("/api/") &&
    STATE_CHANGING_METHODS.has(request.method)
  ) {
    const origin = request.headers.get("origin");

    // Allow requests with no Origin header (non-browser clients like curl)
    if (origin) {
      const requestHost = request.nextUrl.host; // e.g. "localhost:3000" or "invblock.vercel.app"

      let originHost: string;
      try {
        originHost = new URL(origin).host;
      } catch {
        // Malformed Origin header — reject
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (originHost !== requestHost) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  // ------------------------------------------------------------------
  // SEC-2: Supabase Auth Session Refresh
  // Keeps auth cookies fresh on every request to prevent stale sessions.
  // Uses the same @supabase/ssr createServerClient as server.ts but
  // adapted for the middleware context (reads/writes via request/response).
  // ------------------------------------------------------------------
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request so downstream server components see them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Re-create the response with the updated request
          supabaseResponse = NextResponse.next({ request });

          // Set cookies on the response so the browser receives them
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Calling getUser() triggers the session refresh and updates cookies
  // if the access token is about to expire. Do NOT use getSession() here
  // as it doesn't validate the token with the Supabase Auth server.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
