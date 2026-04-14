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

import { useCallback, useEffect, useRef, useState } from "react";
import { aggregateCounters, buildCounterTiles, formatUSD } from "@/lib/counters";
import type { AggregatedCounters } from "@/lib/counters";
import { useCounterSettings } from "@/hooks/useCounterSettings";
import { SettingsPanel } from "./SettingsPanel";
import type { AnyIncident, CounterTotals } from "@/lib/types";

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
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="text-lg font-black tabular-nums text-white sm:text-xl">
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
  const [config, updateConfig, resetConfig] = useCounterSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    config
  );

  const handleToggleGrandTotal = useCallback(() => {
    setShowGrandTotal((prev) => !prev);
    setGrandTotalOpen(false);
  }, []);

  return (
    <>
      {/* Settings panel — renders above the counter */}
      {settingsOpen && (
        <div className="fixed bottom-[68px] left-0 right-0 z-50">
          <SettingsPanel
            config={config}
            onChange={updateConfig}
            onReset={resetConfig}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      )}

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


      {/* Bottom counter bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur-sm shadow-2xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5">

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
            {tiles.length === 0 ? (
              <span className="text-xs text-neutral-500">
                Enable counters via ⚙
              </span>
            ) : (
              tiles.map((tile, i) => (
                <div key={tile.key} className="flex items-center gap-4">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className="hidden h-5 w-px bg-neutral-800 sm:block"
                    />
                  )}
                  <AnimatedTile
                    label={tile.label}
                    rawValue={tile.raw}
                    formatter={
                      tile.key === "showFines"
                        ? formatUSD
                        : (n) => n.toLocaleString("en-US")
                    }
                  />
                </div>
              ))
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Grand total button */}
            <button
              onClick={() => setGrandTotalOpen((o) => !o)}
              title="Show grand total breakdown"
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                showGrandTotal
                  ? "bg-amber-500 text-neutral-950 hover:bg-amber-400"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
              }`}
            >
              {showGrandTotal ? "↑ Grand Total" : "Grand Total ↑"}
            </button>

            {/* Settings */}
            <button
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label="Counter settings"
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              <GearIcon />
            </button>
          </div>
        </div>

        {/* Scroll progress bar — denominator is full DB count, not just loaded page */}
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
    <div className="fixed bottom-[68px] left-0 right-0 z-50 flex justify-center px-4">
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

        {/* Breakdown grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            value={totals.total_jobs_lost.toLocaleString("en-US")}
            label="Jobs Lost"
            color="text-amber-400"
          />
          <StatCard
            value={formatUSD(totals.total_fines_usd)}
            label="In Fines"
            color="text-blue-400"
          />
          <StatCard
            value={totals.total_users_affected.toLocaleString("en-US")}
            label="Users Affected"
            color="text-violet-400"
          />
          <StatCard
            value={totals.model_failures.toLocaleString("en-US")}
            label="Model Failures"
            color="text-rose-400"
          />
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

// ── Icons ─────────────────────────────────────────────────────────────────────

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path
        fillRule="evenodd"
        d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.295 1.473c.497.144.964.317 1.406.516l1.262-.756a1 1 0 011.22.164l1.668 1.667a1 1 0 01.164 1.22l-.756 1.262c.199.443.372.909.516 1.407l1.473.294A1 1 0 0119 10v2.36a1 1 0 01-.804.98l-1.473.295a8.02 8.02 0 01-.516 1.406l.756 1.262a1 1 0 01-.164 1.22l-1.667 1.668a1 1 0 01-1.22.164l-1.263-.756c-.442.199-.909.372-1.406.516l-.294 1.473a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.295-1.473a8.02 8.02 0 01-.516-1.406l-1.262.756a1 1 0 01-1.22-.164L2.99 17.64a1 1 0 01-.164-1.22l.756-1.263a8.02 8.02 0 01-.516-1.406L1.593 13.5A1 1 0 011 12.52V10.16a1 1 0 01.804-.98l1.473-.295c.144-.497.317-.964.516-1.406l-.756-1.262a1 1 0 01.164-1.22L4.868 3.33a1 1 0 011.22-.164l1.262.756c.443-.199.909-.372 1.407-.516L8.82 1.804zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}
