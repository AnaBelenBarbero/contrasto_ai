/**
 * Counter aggregation utilities.
 *
 * `aggregateCounters` computes all metrics client-side from a list of
 * incidents. This is used as a fallback when the v_counters view is
 * unavailable, and for the "companies implicated" metric which requires
 * deduplication across the entire incident list.
 */

import type { AnyIncident, CounterConfig, CounterTotals } from "./types";

// ── Aggregation ───────────────────────────────────────────────────────────────

export interface AggregatedCounters extends CounterTotals {
  /** Distinct companies across all incidents (client-side only). */
  total_companies: number;
}

/**
 * Compute all counter metrics from a flat list of incidents.
 *
 * Intended for use when the backend v_counters view is unavailable
 * or when the incident list has already been filtered client-side.
 */
export function aggregateCounters(
  incidents: AnyIncident[]
): AggregatedCounters {
  let total_jobs_lost = 0;
  let total_fines_usd = 0;
  let total_users_affected = 0;
  let layoff_events = 0;
  let harm_incidents = 0;
  let regulatory_actions = 0;
  let model_failures = 0;
  const companySet = new Set<string>();

  for (const incident of incidents) {
    // Accumulate per-company counts
    incident.companies.forEach((c) => companySet.add(c));

    switch (incident.incident_type) {
      case "layoff": {
        layoff_events++;
        const meta = incident.metadata as { jobs_lost?: number };
        if (typeof meta.jobs_lost === "number") {
          total_jobs_lost += meta.jobs_lost;
        }
        break;
      }
      case "regulatory": {
        regulatory_actions++;
        const meta = incident.metadata as { fine_amount_usd?: number | null };
        if (typeof meta.fine_amount_usd === "number") {
          total_fines_usd += meta.fine_amount_usd;
        }
        break;
      }
      /*case "model_failure": {
        model_failures++;
        const meta = incident.metadata as { users_affected?: number | null };
        if (typeof meta.users_affected === "number") {
          total_users_affected += meta.users_affected;
        }
        break;
      }*/
      case "ai_harm": {
        harm_incidents++;
        break;
      }
    }
  }

  return {
    total_incidents: incidents.length,
    layoff_events,
    harm_incidents,
    regulatory_actions,
    //model_failures,
    total_jobs_lost,
    total_fines_usd,
    total_users_affected,
    total_companies: companySet.size,
  };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Format a large integer with locale-aware thousands separators.
 * e.g. 127341 → "127,341"
 */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Format a USD amount as a human-readable string.
 * e.g. 1_200_000 → "$1.2M"  |  2_500_000_000 → "$2.5B"
 */
export function formatUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString("en-US")}`;
}

/**
 * Build the list of visible counter tiles from config + computed values.
 *
 * Returns ordered tiles with label, value (formatted), and raw number.
 * Tiles with a raw value of zero are included but can be greyed out in the UI.
 */
export function buildCounterTiles(
  totals: AggregatedCounters,
  config: CounterConfig
): Array<{ key: keyof CounterConfig; label: string; value: string; raw: number }> {
  const all: Array<{
    key: keyof CounterConfig;
    label: string;
    value: string;
    raw: number;
    enabled: boolean;
  }> = [
    {
      key: "showTotalIncidents",
      label: "Incidents",
      value: formatCount(totals.total_incidents),
      raw: totals.total_incidents,
      enabled: config.showTotalIncidents,
    },
    {
      key: "showJobsLost",
      label: "Jobs Lost",
      value: formatCount(totals.total_jobs_lost),
      raw: totals.total_jobs_lost,
      enabled: config.showJobsLost,
    },
    {
      key: "showFines",
      label: "In Fines",
      value: formatUSD(totals.total_fines_usd),
      raw: totals.total_fines_usd,
      enabled: config.showFines,
    },
    {
      key: "showUsersAffected",
      label: "Users Affected",
      value: formatCount(totals.total_users_affected),
      raw: totals.total_users_affected,
      enabled: config.showUsersAffected,
    },
    {
      key: "showCompanies",
      label: "Companies",
      value: formatCount(totals.total_companies),
      raw: totals.total_companies,
      enabled: config.showCompanies,
    },
  ];

  return all
    .filter((t) => t.enabled)
    .map(({ key, label, value, raw }) => ({ key, label, value, raw }));
}
