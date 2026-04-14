import type { AnyIncident, IncidentType } from "@/lib/types";
import { INCIDENT_TYPE_COLORS } from "@/lib/types";
import { AIHarmCard } from "./cards/AIHarmCard";
import { LayoffCard } from "./cards/LayoffCard";
import { RegulatoryCard } from "./cards/RegulatoryCard";
import { ModelFailureCard } from "./cards/ModelFailureCard";

export type LayoutMode = "single" | "two-column";

interface TimelineProps {
  incidents: AnyIncident[];
  layout?: LayoutMode;
}

// ── Layout configuration ──────────────────────────────────────────────────────
//
// All values are in pixels. Edit here — no other changes required.
//
//   rowGap        — vertical gap between consecutive cards in the SAME column.
//   columnOffset  — how far down the right column starts relative to the left.
//                   0  → right card icon appears at the same Y as the first left icon.
//                   60 → right card icon appears ~60 px below the first left icon.
//                   Increase to add stagger; decrease toward 0 for tighter interleave.
//   iconSize      — diameter of each spine node circle.
//   connectorTop  — distance from the top of each card's wrapper where the horizontal
//                   connector line bisects the spine icon.
//                   Rule: connectorTop = iconSize / 2  (centres the line on the icon).
//   sideSpace     — total horizontal gap between the card edge and the spine centre.
//                   = connector stub length + icon radius.
//                   Increase for wider breathing room around the spine.
//
const TIMELINE_CONFIG = {
  rowGap: 64,
  columnOffset: 60,
  iconSize: 22,
  connectorTop: 11,   // = iconSize / 2
  sideSpace: 28,      // connector stub (17 px) + icon radius (11 px)
} as const;

// Text glyphs for each incident type — no external icon deps required.
const SPINE_ICONS: Record<IncidentType, string> = {
  ai_harm: "⚠",
  layoff: "↓",
  regulatory: "⚖",
  model_failure: "⚡",
};

/**
 * Timeline — chronological incident list.
 *
 * layout="single"     → grouped by month, one card per row.
 * layout="two-column" → two independent flex columns separated by a typed
 *                       spine line. Left and right cards flow at their own
 *                       natural heights; the right column starts `columnOffset`
 *                       pixels below the left, producing controlled overlap/stagger.
 *
 * Server Component — no client-side state.
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

// ── Two-column spine layout ───────────────────────────────────────────────────

/**
 * Two independent flex columns with an absolute centre spine.
 *
 * Because the columns are independent flex stacks, a tall card on the left
 * does NOT delay the next card on the right — each column flows at its own
 * pace. The `columnOffset` shifts the right column downward so that its first
 * icon appears `columnOffset` pixels below the first left icon, creating a
 * natural stagger without forced row alignment.
 *
 * Spine anatomy (per card wrapper, left side example):
 *
 *   [card content ··· padding ···] [connector stub] [●icon]
 *                                   ←connLen→        ←r=sideSpace→
 *
 * The icon circle is centred exactly on the spine line (left: 50% of container).
 * The connector stub bridges from the card's padded right edge to the icon.
 */
function TwoColumnTimeline({ incidents }: { incidents: AnyIncident[] }) {
  const { rowGap, columnOffset, iconSize, connectorTop, sideSpace } =
    TIMELINE_CONFIG;

  const iconRadius = iconSize / 2;
  // Length of the horizontal stub between card edge and icon left/right edge.
  const connectorLen = sideSpace - iconRadius;

  const left = incidents.filter((_, i) => i % 2 === 0);
  const right = incidents.filter((_, i) => i % 2 !== 0);

  return (
    <div className="relative flex items-start py-8">
      {/* Full-height vertical spine line */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 top-0 w-px bg-neutral-200 dark:bg-neutral-700/70"
        style={{ left: "50%" }}
      />

      {/* ── Left column ───────────────────────────────────────────────── */}
      <div
        className="flex flex-1 flex-col overflow-visible"
        style={{ gap: rowGap }}
      >
        {left.map((inc) => (
          // Each wrapper is the absolute-positioning context for icon + connector.
          // padding-right = sideSpace ensures the card content stops before the spine.
          <div
            key={inc.id}
            className="relative overflow-visible"
            style={{ paddingRight: sideSpace }}
          >
            <IncidentCard incident={inc} />

            {/* Connector stub: card right edge → icon left edge */}
            <span
              aria-hidden
              className="pointer-events-none absolute bg-neutral-300 dark:bg-neutral-600"
              style={{
                top: connectorTop,
                right: iconRadius,          // right edge touches icon left edge
                width: connectorLen,
                height: 1,
              }}
            />

            {/* Spine icon: centre sits exactly on the spine line */}
            <div
              className="absolute z-10"
              style={{ top: 0, right: -iconRadius }}
            >
              <SpineNode incident={inc} size={iconSize} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Right column ──────────────────────────────────────────────── */}
      <div
        className="flex flex-1 flex-col overflow-visible"
        style={{ gap: rowGap, marginTop: columnOffset }}
      >
        {right.map((inc) => (
          <div
            key={inc.id}
            className="relative overflow-visible"
            style={{ paddingLeft: sideSpace }}
          >
            <IncidentCard incident={inc} />

            {/* Connector stub: icon right edge → card left edge */}
            <span
              aria-hidden
              className="pointer-events-none absolute bg-neutral-300 dark:bg-neutral-600"
              style={{
                top: connectorTop,
                left: iconRadius,
                width: connectorLen,
                height: 1,
              }}
            />

            {/* Spine icon */}
            <div
              className="absolute z-10"
              style={{ top: 0, left: -iconRadius }}
            >
              <SpineNode incident={inc} size={iconSize} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Spine icon node ───────────────────────────────────────────────────────────

/**
 * Circular node rendered on the centre spine.
 *
 * Border colour matches the incident type accent; background matches the
 * page theme so the vertical spine line appears "behind" the circle.
 */
function SpineNode({
  incident,
  size,
}: {
  incident: AnyIncident;
  size: number;
}) {
  const colors = INCIDENT_TYPE_COLORS[incident.incident_type];
  const icon = SPINE_ICONS[incident.incident_type];

  return (
    <div
      className={`
        flex items-center justify-center rounded-full border-2
        bg-white shadow-sm
        dark:bg-neutral-950
        ${colors.border}
      `}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
      title={incident.incident_type}
    >
      <span className="leading-none" aria-hidden>
        {icon}
      </span>
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
          <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-950">
            <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
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
