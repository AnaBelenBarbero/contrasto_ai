/**
 * Browser-safe Supabase helpers.
 *
 * This file must NOT import from "next/headers" or any server-only module.
 * It is imported by both Server and Client Components.
 *
 * Server-only helpers (fetchIncidents, fetchCounters, fetchCountries) live in
 * supabase.server.ts — import from there only in Server Components / Route Handlers.
 */

import {
  createBrowserClient as _createBrowserClient,
} from "@supabase/ssr";
import type { AnyIncident } from "./types";

// ── Shared constants ──────────────────────────────────────────────────────────

/** Rows returned per page by both server and browser fetch functions. */
export const PAGE_SIZE = 100;

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

// ── Browser client ────────────────────────────────────────────────────────────

function getEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy .env.local.example to .env.local and fill in your credentials."
    );
  }
  return { url, anonKey };
}

/**
 * Supabase browser client — safe to instantiate in Client Components.
 * Uses the public anon key; RLS prevents unauthorised writes.
 */
export function createBrowserClient() {
  const { url, anonKey } = getEnv();
  return _createBrowserClient(url, anonKey);
}

// ── Browser data-fetching ─────────────────────────────────────────────────────

/**
 * Fetch one page of incidents from the browser (anon key, no cookies).
 * Call from Client Components — e.g. inside IncidentFeed for infinite scroll.
 */
export async function fetchIncidentsBrowser(opts: FetchOpts = {}): Promise<FetchResult> {
  const client = createBrowserClient();
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const from = (opts.page ?? 0) * pageSize;

  let query = client
    .from("incidents")
    .select("*")
    .order("date", { ascending: false })
    .range(from, from + pageSize - 1);

  if (opts.type && opts.type !== "all") query = query.eq("incident_type", opts.type);
  if (opts.country && opts.country !== "all") query = query.contains("countries", [opts.country]);

  const { data, error } = await query;

  if (error) {
    console.error("fetchIncidentsBrowser error:", error.message);
    return { data: [], hasMore: false };
  }

  const rows = (data ?? []) as AnyIncident[];
  return { data: rows, hasMore: rows.length === pageSize };
}
