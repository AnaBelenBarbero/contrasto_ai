import type { AnyIncident } from "@/lib/types";
import { AIHarmCard } from "./cards/AIHarmCard";
import { LayoffCard } from "./cards/LayoffCard";
import { RegulatoryCard } from "./cards/RegulatoryCard";
import { ModelFailureCard } from "./cards/ModelFailureCard";

export type LayoutMode = "single" | "two-column";

interface TimelineProps {
  incidents: AnyIncident[];
  layout?: LayoutMode;
}

/**
 * Timeline — chronological incident list.
 *
 * layout="single"     → grouped by month, one card per row (default).
 * layout="two-column" → staggered two-column grid mimicking web3isgoinggreat.
 *                       Right column is offset downward to create a stair effect.
 *                       Date labels live on each card; no monthly headers.
 *
 * This is a Server Component — no client-side state.
 */
export function Timeline({ incidents, layout = "two-column" }: TimelineProps) {
  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-2xl">🔍</p>
        <p className="mt-2 text-lg font-semibold text-neutral-600 dark:text-neutral-300">
          No incidents found
        </p>
        <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">
          Try adjusting the filters above.
        </p>
      </div>
    );
  }

  if (layout === "two-column") {
    return <TwoColumnTimeline incidents={incidents} />;
  }

  return <SingleColumnTimeline incidents={incidents} />;
}

// ── Two-column stair layout ───────────────────────────────────────────────────

/**
 * Splits incidents into left/right columns (even/odd indices).
 * The right column carries a top offset (`mt-20`) to create the
 * stair / waterfall appearance seen on web3isgoinggreat.com.
 */
function TwoColumnTimeline({ incidents }: { incidents: AnyIncident[] }) {
  const left = incidents.filter((_, i) => i % 2 === 0);
  const right = incidents.filter((_, i) => i % 2 !== 0);

  return (
    <div className="flex gap-6 items-start py-4">
      {/* Left column */}
      <div className="flex flex-1 flex-col gap-6">
        {left.map((inc) => (
          <IncidentCard key={inc.id} incident={inc} />
        ))}
      </div>

      {/* Right column — staggered down by ~40% of a typical card */}
      <div className="flex flex-1 flex-col gap-6 mt-20">
        {right.map((inc) => (
          <IncidentCard key={inc.id} incident={inc} />
        ))}
      </div>
    </div>
  );
}

// ── Single-column grouped layout ──────────────────────────────────────────────

function SingleColumnTimeline({ incidents }: { incidents: AnyIncident[] }) {
  const groups = groupByMonth(incidents);

  return (
    <div className="space-y-10">
      {groups.map(({ monthLabel, items }) => (
        <section key={monthLabel}>
          {/* Month header */}
          <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              {monthLabel}
            </h2>
          </div>

          <div className="flex flex-col gap-5">
            {items.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

function IncidentCard({ incident }: { incident: AnyIncident }) {
  switch (incident.incident_type) {
    case "ai_harm":
      return <AIHarmCard incident={incident} />;
    case "layoff":
      return <LayoffCard incident={incident} />;
    case "regulatory":
      return <RegulatoryCard incident={incident} />;
    case "model_failure":
      return <ModelFailureCard incident={incident} />;
  }
}

// ── Grouping helper ───────────────────────────────────────────────────────────

function groupByMonth(
  incidents: AnyIncident[]
): Array<{ monthLabel: string; items: AnyIncident[] }> {
  const map = new Map<string, AnyIncident[]>();

  for (const inc of incidents) {
    const d = new Date(inc.date + "T00:00:00");
    const key = d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(inc);
  }

  return Array.from(map.entries()).map(([monthLabel, items]) => ({
    monthLabel,
    items,
  }));
}
