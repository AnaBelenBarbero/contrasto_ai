/**
 * Browser-safe helpers shared between Server and Client Components.
 *
 * This file must NOT import from "next/headers" or any server-only module.
 *
 * Supabase is never called directly from the browser — all paginated fetches
 * go through /api/incidents so the anon key stays server-side only.
 */

import type { AnyIncident } from "./types";

// ── Shared constants ──────────────────────────────────────────────────────────

/** Rows returned per page by both server and browser fetch functions. */
export const PAGE_SIZE = 50;

// ── Shared types ──────────────────────────────────────────────────────────────

export interface FetchOpts {
  type?: string;
  country?: string;
  /** Zero-based page index. */
  page?: number;
  pageSize?: number;
}

export interface FetchResult {
  data: AnyIncident[];
  /** True when more rows may exist beyond this page. */
  hasMore: boolean;
}

// ── Client data-fetching (via Route Handler) ──────────────────────────────────

/**
 * Fetch one page of incidents from the browser via the /api/incidents Route Handler.
 * The Supabase anon key never leaves the server — this is a plain fetch to our own API.
 * Sends the HMAC page token issued at render time so the Route Handler can verify
 * the request originated from a real page load.
 * Call from Client Components — e.g. inside IncidentFeed for infinite scroll.
 */
export async function fetchIncidentsApi(
  opts: FetchOpts = {},
  pageToken?: string,
): Promise<FetchResult> {
  const params = new URLSearchParams();
  if (opts.type) params.set("type", opts.type);
  if (opts.country) params.set("country", opts.country);
  if (opts.page !== undefined) params.set("page", String(opts.page));
  if (opts.pageSize !== undefined) params.set("pageSize", String(opts.pageSize));

  const headers: HeadersInit = {};
  if (pageToken) headers["x-page-token"] = pageToken;

  const res = await fetch(`/api/incidents?${params}`, { headers });
  if (!res.ok) {
    console.error("fetchIncidentsApi error:", res.status, res.statusText);
    return { data: [], hasMore: false };
  }

  return res.json() as Promise<FetchResult>;
}
