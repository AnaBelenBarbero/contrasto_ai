import { type NextRequest, NextResponse } from "next/server";
import { fetchIncidents } from "@/lib/supabase.server";
import { PAGE_SIZE } from "@/lib/supabase";
import { verifyPageToken } from "@/lib/page-token";

const MAX_PAGE = 20; // hard cap — page 20 × 50 rows = 1 000 rows max per session

const FORBIDDEN = NextResponse.json({ error: "Forbidden" }, { status: 403 });

/**
 * GET /api/incidents
 *
 * Proxies paginated incident fetches through the server so the Supabase anon
 * key never appears in the browser bundle.  Query params mirror FetchOpts:
 *   ?type=ai_harm|layoff|regulatory|all
 *   ?country=US|GB|all
 *   ?page=0          (zero-based)
 *   ?pageSize=50
 *
 * Two-layer access control:
 *   1. Sec-Fetch-Site must be absent or "same-origin" (blocks cross-origin browser scripts).
 *   2. X-Page-Token must be a valid HMAC token issued by this server (blocks curl / Python
 *      scripts that haven't first loaded the page).
 */
export async function GET(req: NextRequest) {
  // ── Layer 1: Sec-Fetch-Site ───────────────────────────────────────────────
  // Browsers set this automatically and forbid JS from overriding it.
  // A value other than "same-origin" means the request came from a different
  // origin (or a tool that forged the header — caught by Layer 2).
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") {
    return FORBIDDEN;
  }

  // ── Layer 2: HMAC page token ──────────────────────────────────────────────
  // The token is embedded in the server-rendered page and sent back as a
  // header by fetchIncidentsApi.  Valid for two 5-minute windows.
  const token = req.headers.get("x-page-token") ?? "";
  if (!verifyPageToken(token)) {
    return FORBIDDEN;
  }

  // ── Normal handling ───────────────────────────────────────────────────────
  const sp = req.nextUrl.searchParams;

  const type = sp.get("type") ?? "all";
  const country = sp.get("country") ?? "all";
  const page = Math.max(0, Number(sp.get("page") ?? "0"));
  const pageSize = Math.min(Number(sp.get("pageSize") ?? PAGE_SIZE), PAGE_SIZE);

  if (page > MAX_PAGE) {
    return NextResponse.json({ data: [], hasMore: false });
  }

  const result = await fetchIncidents({ type, country, page, pageSize });

  return NextResponse.json(result, {
    headers: {
      // Allow browsers to cache each page for 60 s; CDN for 5 min
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
