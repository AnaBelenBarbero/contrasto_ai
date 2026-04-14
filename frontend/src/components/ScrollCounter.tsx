"use client";

/**
 * ScrollCounter — bottom-fixed bar that counts up as the user scrolls.
 *
 * Each incident card carries a `data-incident-id` attribute. An
 * IntersectionObserver fires when a card reaches the viewport and adds
 * that card's metrics to the running totals. All metric numbers animate
 * smoothly between values using requestAnimationFrame.
 *
 * "Grand Total" mode: clicking the button in the bottom-right switches
 * the counter to display all-time totals regardless of scroll position,
 * and reveals a summary breakdown by incident type.
 */

import { useCallback, useEffect, useRef, useState, useId } from "react";
import { aggregateCounters, buildCounterTiles, formatUSD } from "@/lib/counters";
import type { AggregatedCounters } from "@/lib/counters";
import { COUNTER_CONFIG, COUNTER_POSITION } from "@/lib/types";
import type { AnyIncident, CounterTotals } from "@/lib/types";
import { NewsletterSignup } from "./NewsletterSignup";

interface ScrollCounterProps {
  /** Currently loaded incidents — used for scroll-driven "seen so far" counting. */
  incidents: AnyIncident[];
  /** All-time aggregates from the DB (v_counters view). Used for grand-total overlay. */
  grandTotals: CounterTotals;
  /** Total incident count in the DB — denominator for the scroll progress bar. */
  dbTotal: number;
}

// ── Animated number hook ──────────────────────────────────────────────────────

function useAnimatedNumber(target: number): number {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) return;

    const startTime = performance.now();
    const duration = 700; // ms

    function step(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setDisplayed(Math.round(from + (target - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return displayed;
}

// ── Animated tile ─────────────────────────────────────────────────────────────

type Direction = "up" | "down" | "idle";

function AnimatedTile({
  label,
  rawValue,
  formatter,
}: {
  label: string;
  rawValue: number;
  formatter: (n: number) => string;
}) {
  const animated = useAnimatedNumber(rawValue);
  const prevRef = useRef(rawValue);
  // Increment key forces span remount → CSS animation replays from 0%
  const [animKey, setAnimKey] = useState(0);
  const [direction, setDirection] = useState<Direction>("idle");
  const [showFlame, setShowFlame] = useState(false);
  const flameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = rawValue;
    if (rawValue === prev) return;

    const dir: Direction = rawValue > prev ? "up" : "down";
    setDirection(dir);
    setAnimKey((k) => k + 1);

    if (dir === "up") {
      // Show the floating flame particle
      if (flameTimerRef.current) clearTimeout(flameTimerRef.current);
      setShowFlame(true);
      flameTimerRef.current = setTimeout(() => setShowFlame(false), 900);
    }

    return () => {
      if (flameTimerRef.current) clearTimeout(flameTimerRef.current);
    };
  }, [rawValue]);

  return (
    <div className="relative flex flex-col items-center leading-tight" aria-live="polite" aria-atomic="true" aria-label={`${label}: ${formatter(rawValue)}`}>
      {/* Floating flame on increase */}
      {showFlame && (
        <span key={`flame-${id}-${animKey}`} className="fire-particle" aria-hidden>
          🔥
        </span>
      )}

      <span
        key={`num-${id}-${animKey}`}
        className={`text-lg font-black tabular-nums sm:text-xl ${
          direction === "up" ? "counter-burn" : direction === "down" ? "counter-cool" : "text-white"
        }`}
      >
        {formatter(animated)}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/** Promote DB CounterTotals to AggregatedCounters (adds total_companies = 0). */
function dbTotalsToAggregated(t: CounterTotals): AggregatedCounters {
  return { ...t, total_companies: 0 };
}

export function ScrollCounter({ incidents, grandTotals, dbTotal }: ScrollCounterProps) {
  const [grandTotalOpen, setGrandTotalOpen] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [showGrandTotal, setShowGrandTotal] = useState(false);

  // ── Scroll-driven seen tracking ─────────────────────────────────────────────
  // On every scroll frame, recompute which cards sit above the 60% viewport
  // mark. This means:
  //   • Scrolling DOWN  → more cards cross the mark → counter increases.
  //   • Scrolling UP    → cards re-appear below the mark → counter decreases.
  //   • Filter change   → `incidents` prop changes → effect restarts → set resets.
  //   • Page refresh    → fresh React tree → set starts empty.
  useEffect(() => {
    // Reset immediately when the incident list changes (filter applied)
    setSeenIds(new Set());

    let rafId: number | null = null;

    const recompute = () => {
      // A card "counts" once its top edge has scrolled past 60% down the viewport.
      // Using 60% (rather than 100%) gives a half-seen feel before it registers.
      const triggerY = window.scrollY + window.innerHeight * 0.6;
      const next = new Set<string>();

      document.querySelectorAll<HTMLElement>("[data-incident-id]").forEach((el) => {
        const cardTop = window.scrollY + el.getBoundingClientRect().top;
        if (cardTop < triggerY) {
          const id = el.getAttribute("data-incident-id");
          if (id) next.add(id);
        }
      });

      setSeenIds(next);
      rafId = null;
    };

    const onScroll = () => {
      // Throttle to one DOM read per animation frame
      if (rafId === null) {
        rafId = requestAnimationFrame(recompute);
      }
    };

    // Calculate initial state (in case page loads scrolled or cards are above fold)
    const initTimer = setTimeout(recompute, 100);

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      clearTimeout(initTimer);
    };
  }, [incidents]); // ← re-runs (and resets) whenever the incident list changes

  // "Seen so far" — incidents whose cards have scrolled past the 60% mark
  const seenIncidents = incidents.filter((inc) => seenIds.has(inc.id));
  const seenTotals = aggregateCounters(seenIncidents);

  // Counter bar tiles: use DB grand totals when pinned, scroll totals otherwise
  const tiles = buildCounterTiles(
    showGrandTotal ? dbTotalsToAggregated(grandTotals) : seenTotals,
    COUNTER_CONFIG
  );

  const handleToggleGrandTotal = useCallback(() => {
    setShowGrandTotal((prev) => !prev);
    setGrandTotalOpen(false);
  }, []);

  return (
    <>
      {/* Grand total overlay */}
      {grandTotalOpen && (
        <GrandTotalOverlay
          totals={grandTotals}
          seenCount={seenIds.size}
          onClose={() => setGrandTotalOpen(false)}
          onPinGrandTotal={handleToggleGrandTotal}
          isPinned={showGrandTotal}
        />
      )}


      {/* Counter bar — position driven by COUNTER_POSITION constant */}
      <div
        className={
          COUNTER_POSITION === "fixed-bottom"
            ? "fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/95 shadow-2xl backdrop-blur-sm"
            : "sticky top-0 z-20 border-b border-neutral-800 bg-neutral-950/95 shadow-md backdrop-blur-sm"
        }
        /* full-bleed when sticky-top so it spans the viewport like FilterBar */
        style={
          COUNTER_POSITION === "sticky-top"
            ? { width: "100vw", marginLeft: "calc(50% - 50vw)" }
            : undefined
        }
      >
        {/* ── Row 1: mode label | metric tiles | grand total button ── */}
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2">

          {/* Mode indicator */}
          <div className="flex flex-col leading-none">
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-500">
              {showGrandTotal ? "all time" : "seen so far"}
            </span>
            <span className="text-[9px] text-neutral-600">
              {showGrandTotal
                ? `${grandTotals.total_incidents.toLocaleString("en-US")} incidents`
                : `${seenIds.size} / ${dbTotal.toLocaleString("en-US")}`}
            </span>
          </div>

          {/* Separator */}
          <span className="h-8 w-px bg-neutral-800" />

          {/* Metric tiles */}
          <div className="flex flex-1 flex-wrap items-center justify-around gap-x-4 gap-y-1">
            {tiles.map((tile, i) => (
              <div key={tile.key} className="flex items-center gap-4">
                {i > 0 && (
                  <span aria-hidden className="hidden h-5 w-px bg-neutral-800 sm:block" />
                )}
                <AnimatedTile
                  label={tile.label}
                  rawValue={tile.raw}
                  formatter={tile.key === "showFines" ? formatUSD : (n) => n.toLocaleString("en-US")}
                />
              </div>
            ))}
          </div>

          {/* Grand Total button */}
          <button
            onClick={() => setGrandTotalOpen((o) => !o)}
            title="Show all-time grand total breakdown"
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide transition-all duration-200 ${
              showGrandTotal
                ? "bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/40 hover:bg-amber-400"
                : "border border-orange-500/60 bg-orange-950/50 text-orange-300 shadow-md shadow-orange-900/40 hover:border-orange-400 hover:bg-orange-900/60 hover:text-orange-100 hover:shadow-orange-500/30"
            }`}
          >
            🔥 {showGrandTotal ? "Grand Total ↑" : "Grand Total"}
          </button>
        </div>

        {/* ── Row 2: newsletter signup ── */}
        <div className="mx-auto flex max-w-5xl items-center gap-3 border-t border-neutral-800/60 px-4 py-1.5">
          <span className="hidden flex-shrink-0 text-[10px] font-semibold text-neutral-500 sm:block">
            AI is going just great —
          </span>
          <span className="hidden text-[10px] text-neutral-600 sm:block">
            stay updated:
          </span>
          <div className="flex-1" />
          <NewsletterSignup />
        </div>

        {/* ── Scroll progress bar ── */}
        <ScrollProgress seenCount={seenIds.size} total={dbTotal} />
      </div>
    </>
  );
}

// ── Scroll progress bar ───────────────────────────────────────────────────────

function ScrollProgress({
  seenCount,
  total,
}: {
  seenCount: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((seenCount / total) * 100);
  return (
    <div className="h-0.5 w-full bg-neutral-800">
      <div
        className="h-full bg-gradient-to-r from-blue-600 via-violet-500 to-rose-500 transition-all duration-500"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% of incidents seen`}
      />
    </div>
  );
}

// ── Grand total overlay ───────────────────────────────────────────────────────

interface GrandTotalOverlayProps {
  /** DB-sourced all-time totals from v_counters view. */
  totals: CounterTotals;
  seenCount: number;
  onClose: () => void;
  onPinGrandTotal: () => void;
  isPinned: boolean;
}

function GrandTotalOverlay({
  totals,
  seenCount,
  onClose,
  onPinGrandTotal,
  isPinned,
}: GrandTotalOverlayProps) {
  return (
    <div className="fixed bottom-[104px] left-0 right-0 z-50 flex justify-center px-4">
      <div className="w-full max-w-xl rounded-xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">
              All-Time Grand Total
            </h3>
            <p className="text-xs text-neutral-400">
              {seenCount} of {totals.total_incidents} incidents seen so far
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Big number */}
        <div className="mb-4 rounded-lg bg-neutral-800 p-4 text-center">
          <p className="text-4xl font-black tabular-nums text-white">
            {totals.total_incidents.toLocaleString("en-US")}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Total AI Incidents Tracked
          </p>
        </div>

        {/* Breakdown grid — mirrors COUNTER_CONFIG visibility */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COUNTER_CONFIG.showJobsLost && (
            <StatCard value={totals.total_jobs_lost.toLocaleString("en-US")} label="Jobs Lost"      color="text-amber-400" />
          )}
          {COUNTER_CONFIG.showFines && (
            <StatCard value={formatUSD(totals.total_fines_usd)}              label="In Fines"       color="text-blue-400"  />
          )}
          {COUNTER_CONFIG.showUsersAffected && (
            <StatCard value={totals.total_users_affected.toLocaleString("en-US")} label="Users Affected" color="text-violet-400" />
          )}
          <StatCard value={totals.model_failures.toLocaleString("en-US")}    label="Model Failures" color="text-rose-400"  />
        </div>

        {/* Type breakdown */}
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-neutral-700 pt-4 sm:grid-cols-4">
          <TypeCount label="AI Harm" value={totals.harm_incidents} dot="bg-rose-500" />
          <TypeCount label="Layoffs" value={totals.layoff_events} dot="bg-amber-500" />
          <TypeCount label="Regulatory" value={totals.regulatory_actions} dot="bg-blue-500" />
          <TypeCount label="Model Failures" value={totals.model_failures} dot="bg-violet-500" />
        </div>

        {/* Pin button */}
        <button
          onClick={onPinGrandTotal}
          className={`mt-4 w-full rounded-lg py-2 text-sm font-semibold transition-colors ${
            isPinned
              ? "bg-amber-500 text-neutral-950 hover:bg-amber-400"
              : "bg-neutral-700 text-white hover:bg-neutral-600"
          }`}
        >
          {isPinned
            ? "✓ Pinned — showing grand total in counter"
            : "Pin grand total to counter bar"}
        </button>
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-neutral-800 p-3 text-center">
      <p className={`text-xl font-black tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
        {label}
      </p>
    </div>
  );
}

function TypeCount({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
      <span className="text-xs text-neutral-400">{label}</span>
      <span className="ml-auto text-xs font-bold text-white">{value}</span>
    </div>
  );
}

