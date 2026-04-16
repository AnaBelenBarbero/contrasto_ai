/**
 * Server-only Supabase helpers.
 *
 * Imports "next/headers" — must only be used in:
 *   - Server Components
 *   - Route Handlers
 *   - Server Actions
 *
 * Never import this file from a Client Component ("use client").
 */

import {
  createServerClient as _createServerClient,
} from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { AnyIncident, CounterTotals } from "./types";
import { PAGE_SIZE } from "./supabase";
import type { FetchOpts, FetchResult } from "./supabase";

// ── Server client ─────────────────────────────────────────────────────────────

function getEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return { url, anonKey };
}

/**
 * Supabase server client — forwards cookies for session-based auth.
 * Call only from Server Components, Route Handlers, or Server Actions.
 */
export async function createServerClient() {
  const { url, anonKey } = getEnv();
  const cookieStore = await cookies();

  return _createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from Server Components where cookies are read-only — safe to ignore.
        }
      },
    },
  });
}

// ── Server data-fetching ──────────────────────────────────────────────────────

/**
 * Fetch one page of incidents — server-side only.
 * Uses .range() for cursor-based pagination; hasMore = true when a full page
 * was returned (i.e. there may be another page after this one).
 */
export async function fetchIncidents(opts: FetchOpts = {}): Promise<FetchResult> {
  const client = await createServerClient();
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
    console.error("fetchIncidents error:", error.message);
    return { data: [], hasMore: false };
  }

  const rows = (data ?? []) as AnyIncident[];
  return { data: rows, hasMore: rows.length === pageSize };
}

/**
 * Fetch aggregated counter totals from the v_counters view.
 * Returns zeroed-out values if the view is unavailable.
 */
export async function fetchCounters(): Promise<CounterTotals> {
  const client = await createServerClient();

  const { data, error } = await client
    .from("v_counters")
    .select("*")
    .single();

  if (error || !data) {
    console.error("fetchCounters error:", error?.message);
    return {
      total_incidents: 0,
      layoff_events: 0,
      harm_incidents: 0,
      regulatory_actions: 0,
      model_failures: 0,
      total_jobs_lost: 0,
      total_fines_usd: 0,
      total_users_affected: 0,
    };
  }

  return data as CounterTotals;
}

/**
 * Fetch the distinct list of countries across all incidents.
 * Used to populate the country filter dropdown.
 */
export async function fetchCountries(): Promise<string[]> {
  const client = await createServerClient();

  const { data, error } = await client.from("incidents").select("countries");

  if (error || !data) return [];

  const all = data.flatMap((row: { countries: string[] }) => row.countries);
  return Array.from(new Set(all)).sort();
}
