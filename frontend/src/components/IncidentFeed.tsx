"use client";

/**
 * IncidentFeed — client component that owns the infinite-scroll logic.
 *
 * The server passes the first page of incidents (PAGE_SIZE rows).
 * An IntersectionObserver watches a sentinel div placed near the bottom
 * of the list; when it enters the viewport, the next page is fetched from
 * Supabase using the browser (anon) client and appended to the list.
 *
 * Client-side text search is applied on top of the already server-filtered
 * incident list so the search box feels instant without a round-trip.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchIncidentsBrowser, PAGE_SIZE } from "@/lib/supabase";
import { Timeline } from "./Timeline";
import { ScrollCounter } from "./ScrollCounter";
import type { LayoutMode } from "./Timeline";
import type { AnyIncident, CounterTotals } from "@/lib/types";

interface IncidentFeedProps {
  initialIncidents: AnyIncident[];
  initialHasMore: boolean;
  /** All-time aggregates from the v_counters DB view. */
  grandTotals: CounterTotals;
  /** Total row count from the DB (used for scroll progress denominator). */
  dbTotal: number;
  /** Active filter values — used to fetch subsequent pages with the same filters. */
  type: string;
  country: string;
  search: string;
  layout: LayoutMode;
  pageSize?: number;
}

export function IncidentFeed({
  initialIncidents,
  initialHasMore,
  grandTotals,
  dbTotal,
  type,
  country,
  search,
  layout,
  pageSize = PAGE_SIZE,
}: IncidentFeedProps) {
  const [incidents, setIncidents] = useState<AnyIncident[]>(initialIncidents);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false); // stable ref to avoid stale closure in observer

  // Reset when the server re-renders with new filter params
  useEffect(() => {
    setIncidents(initialIncidents);
    setPage(0);
    setHasMore(initialHasMore);
  }, [initialIncidents, initialHasMore]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);

    const nextPage = page + 1;
    const { data, hasMore: more } = await fetchIncidentsBrowser({
      type,
      country,
      page: nextPage,
      pageSize,
    });

    setIncidents((prev) => [...prev, ...data]);
    setPage(nextPage);
    setHasMore(more);
    setLoading(false);
    loadingRef.current = false;
  }, [hasMore, page, type, country, pageSize]);

  // Observe the sentinel; fires when the user scrolls within ~300 px of the end
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "300px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Client-side search applied on top of server-filtered + paginated data
  const displayed =
    search.trim().length > 0
      ? incidents.filter((inc) => {
          const haystack =
            `${inc.title} ${inc.description} ${inc.companies.join(" ")} ${inc.tags.join(" ")}`.toLowerCase();
          return haystack.includes(search.toLowerCase());
        })
      : incidents;

  return (
    <>
      <Timeline incidents={displayed} layout={layout} />

      {/* Sentinel — invisible div that triggers the next page load */}
      <div ref={sentinelRef} className="flex justify-center py-6 text-sm text-neutral-400">
        {loading && "Loading more…"}
        {!loading && !hasMore && incidents.length > 0 && (
          <span className="text-neutral-500">All {incidents.length} incidents loaded.</span>
        )}
      </div>

      <ScrollCounter
        incidents={incidents}
        grandTotals={grandTotals}
        dbTotal={dbTotal}
      />
    </>
  );
}
