/**
 * TypeScript types mirroring the Supabase `incidents` table schema.
 *
 * Keep these in sync with the Python Pydantic models in data/models/.
 * The `metadata` field is typed per incident type via the typed-incident
 * discriminated union at the bottom of this file.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type IncidentType =
  | "ai_harm"
  | "layoff"
  | "regulatory"
  //| "model_failure";

// ── Per-type metadata shapes ──────────────────────────────────────────────────

export interface AIHarmMetadata {
  harm_categories: string[];
  affected_population: string;
  aiid_id?: string | null;
  severity?: string | null;
}

export interface LayoffMetadata {
  sector: string;
  jobs_lost: number;
  ai_automation_confirmed: boolean;
  severity?: string | null;
  jobs_lost_to_be_confirmed?: boolean | null;
}

export interface RegulatoryMetadata {
  regulator: string;
  fine_amount_usd?: number | null;
  regulation_violated: string;
  severity?: string | null;
}

export interface ModelFailureMetadata {
  model_name: string;
  failure_mode: string;
  users_affected?: number | null;
  severity?: string | null;
}

// ── Base incident (raw DB row) ────────────────────────────────────────────────

export interface BaseIncident {
  id: string;
  date: string;           // ISO-8601 date string from Supabase REST
  title: string;
  description: string;
  incident_type: IncidentType;
  links: string[];
  tags: string[];
  source: string;
  countries: string[];
  companies: string[];
  image_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Typed incident variants ───────────────────────────────────────────────────

export interface AIHarmIncident extends Omit<BaseIncident, "metadata"> {
  incident_type: "ai_harm";
  metadata: AIHarmMetadata;
}

export interface LayoffIncident extends Omit<BaseIncident, "metadata"> {
  incident_type: "layoff";
  metadata: LayoffMetadata;
}

export interface RegulatoryIncident extends Omit<BaseIncident, "metadata"> {
  incident_type: "regulatory";
  metadata: RegulatoryMetadata;
}

//export interface ModelFailureIncident extends Omit<BaseIncident, "metadata"> {
//  incident_type: "model_failure";
//  metadata: ModelFailureMetadata;
//}

export type AnyIncident =
  | AIHarmIncident
  | LayoffIncident
  | RegulatoryIncident
  //| ModelFailureIncident;

// ── Counters (from v_counters view) ──────────────────────────────────────────

export interface CounterTotals {
  total_incidents: number;
  layoff_events: number;
  harm_incidents: number;
  regulatory_actions: number;
  //model_failures: number;
  total_jobs_lost: number;
  total_fines_usd: number;
  total_users_affected: number;
}

// ── Counter display config ────────────────────────────────────────────────────

export interface CounterConfig {
  showTotalIncidents: boolean;
  showJobsLost: boolean;
  showFines: boolean;
  showUsersAffected: boolean;
  showCompanies: boolean;
}

// ── Counter position ──────────────────────────────────────────────────────────

export type CounterPosition = "fixed-bottom" | "sticky-top";

/**
 * Where the metrics counter bar is rendered.
 *
 *  "fixed-bottom" — pinned to the viewport bottom, always visible.
 *  "sticky-top"   — rendered in document flow just below the filter bar;
 *                   becomes sticky as the user scrolls past it.
 *
 * Change this constant to switch modes — no other edits needed.
 */
export const COUNTER_POSITION: CounterPosition = "sticky-top"; //fixed-bottom

// ── Counter display config ────────────────────────────────────────────────────

/**
 * Counter display configuration — edit here to show/hide metrics in the bar.
 * Not exposed to end users; change this constant to update what's visible.
 */
export const COUNTER_CONFIG: CounterConfig = {
  showTotalIncidents: true,
  showJobsLost:       true,
  showFines:          true,
  showUsersAffected:  false, // sparse data — hidden until coverage improves
  showCompanies:      true,
};

/** @deprecated use COUNTER_CONFIG */
export const DEFAULT_COUNTER_CONFIG = COUNTER_CONFIG;

// ── Filter state ──────────────────────────────────────────────────────────────

export interface FilterState {
  type: IncidentType | "all";
  country: string | "all";
  search: string;
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isLayoffIncident(i: AnyIncident): i is LayoffIncident {
  return i.incident_type === "layoff";
}

export function isHarmIncident(i: AnyIncident): i is AIHarmIncident {
  return i.incident_type === "ai_harm";
}

export function isRegulatoryIncident(i: AnyIncident): i is RegulatoryIncident {
  return i.incident_type === "regulatory";
}

//export function isModelFailureIncident(
//  i: AnyIncident
//): i is ModelFailureIncident {
//  return i.incident_type === "model_failure";
//}

// ── Display helpers ───────────────────────────────────────────────────────────

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  ai_harm: "AI Harm",
  layoff: "Layoff",
  regulatory: "Regulatory",
  //model_failure: "Model Failure",
};

export const INCIDENT_TYPE_COLORS: Record<
  IncidentType,
  { border: string; badge: string; badgeDark: string }
> = {
  ai_harm: {
    border: "border-rose-500",
    badge: "bg-rose-100 text-rose-800",
    badgeDark: "dark:bg-rose-900/40 dark:text-rose-300",
  },
  layoff: {
    border: "border-amber-500",
    badge: "bg-amber-100 text-amber-800",
    badgeDark: "dark:bg-amber-900/40 dark:text-amber-300",
  },
  regulatory: {
    border: "border-blue-500",
    badge: "bg-blue-100 text-blue-800",
    badgeDark: "dark:bg-blue-900/40 dark:text-blue-300",
  },
  //model_failure: {
  //  border: "border-violet-500",
  //  badge: "bg-violet-100 text-violet-800",
  //  badgeDark: "dark:bg-violet-900/40 dark:text-violet-300",
  //},
};
