import Image from "next/image";
import { Suspense } from "react";
import { fetchCountries, fetchIncidents, fetchCounters } from "@/lib/supabase.server";
import { PAGE_SIZE } from "@/lib/supabase";
import { generatePageToken } from "@/lib/page-token";
import { FilterBar } from "@/components/FilterBar";
import { IncidentFeed } from "@/components/IncidentFeed";
//import { ThemeToggle } from "@/components/ThemeToggle";
import { COUNTER_POSITION } from "@/lib/types";
import type { LayoutMode } from "@/components/Timeline";

/**
 * Home page — Server Component.
 *
 * URL params:
 *   ?type=ai_harm|layoff|regulatory|model_failure  — filter by incident type
 *   ?country=US|GB|...                              — filter by country code
 *   ?q=search+term                                  — full-text search
 *   ?layout=single|two-column                       — card layout mode
 */

interface PageProps {
  searchParams: Promise<{
    type?: string;
    country?: string;
    q?: string;
    layout?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  // Kick off filter-independent fetches immediately — before awaiting searchParams.
  // fetchCountries and fetchCounters don't need any URL params, so they start
  // in parallel with the searchParams resolution instead of waiting for it.
  const countriesPromise = fetchCountries();
  const countersPromise = fetchCounters();
  const pageToken = generatePageToken();

  const params = await searchParams;
  const activeType = params.type ?? "all";
  const activeCountry = params.country ?? "all";
  const activeSearch = params.q ?? "";
  const activeLayout: LayoutMode =
    params.layout === "single" ? "single" : "two-column";

  // fetchIncidents needs the resolved filter params — starts here, joins the others.
  const [{ data: initialIncidents, hasMore: initialHasMore }, countries, grandTotals] =
    await Promise.all([
      fetchIncidents({ type: activeType, country: activeCountry, page: 0, pageSize: PAGE_SIZE }),
      countriesPromise,
      countersPromise,
    ]);

  return (
    /* pb-[104px] reserves space for the fixed counter bar (metrics row + newsletter row + progress).
       sticky-top mode needs no bottom padding since the bar is in document flow. */
    <div className={`flex min-h-screen flex-col ${COUNTER_POSITION === "fixed-bottom" ? "pb-[104px]" : ""}`}>
      {/* ── Site header ──────────────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto flex max-w-5xl items-center gap-5 px-4 py-5">
          {/* Meme image */}
          <div className="relative flex-shrink-0">
            <Image
              src="/ai_is_fine.jpg"
              alt="AI Is Fine meme — dog sitting calmly in a burning room"
              width={80}
              height={120}
              className="rounded-lg object-cover shadow-lg shadow-orange-900/40 ring-2 ring-orange-500/30"
              priority
            />
            {/* Subtle fire glow underneath */}
            <div
              aria-hidden
              className="absolute -inset-1 -z-10 rounded-xl bg-orange-600/20 blur-lg"
            />
          </div>

          {/* Title block */}
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                AI Is Just Fine
              </h1>
              {/* Theme toggle — top-right of header 
              <ThemeToggle className="mt-0.5 flex-shrink-0" />*/}
            </div>
            <p className="max-w-lg text-sm text-neutral-400">
              A timeline of AI harm, layoffs and regulatory actions
            </p>
            <br />
            <p className="text-xs text-neutral-500">
              <span className="font-semibold text-neutral-300">
                {grandTotals.total_incidents.toLocaleString("en-US")}
              </span>{" "}
              incidents tracked. Scroll down to watch the counter burn 🔥
            </p>
          </div>
        </div>

        {/* Subtle fire-gradient right edge (decorative) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-orange-950/30 to-transparent"
        />

      </header>

      {/* ── FilterBar (type pills, country, search, layout toggle) ────── */}
      <Suspense fallback={<div className="h-14 bg-white dark:bg-neutral-900" />}>
        <FilterBar
          countries={countries}
          activeType={activeType}
          activeCountry={activeCountry}
          activeSearch={activeSearch}
          activeLayout={activeLayout}
        />
      </Suspense>

      {/* ── Timeline + infinite scroll + counter ─────────────────────── */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4">
        <IncidentFeed
          initialIncidents={initialIncidents}
          initialHasMore={initialHasMore}
          grandTotals={grandTotals}
          dbTotal={grandTotals.total_incidents}
          type={activeType}
          country={activeCountry}
          search={activeSearch}
          layout={activeLayout}
          pageToken={pageToken}
        />
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-neutral-800 bg-neutral-950 px-4 py-6 text-center text-xs text-neutral-500">
        <p>
          Inspired by{" "}
          <a
            href="https://web3isgoinggreat.com"
            className="underline hover:text-neutral-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            web3isgoinggreat.com
          </a>{" "}
          by Molly White
        </p>
        <p className="mt-1">
          Data is for informational purposes only. Sources are linked in each
          entry.
        </p>
      </footer>

    </div>
  );
}
