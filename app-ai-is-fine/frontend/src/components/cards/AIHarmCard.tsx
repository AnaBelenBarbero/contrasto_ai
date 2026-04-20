import type { AIHarmIncident } from "@/lib/types";
import { BaseCard } from "./BaseCard";

interface AIHarmCardProps {
  incident: AIHarmIncident;
}

/**
 * Card for AI Harm incidents.
 *
 * Shows: harm category pills, affected population, and AIID reference link.
 */
export function AIHarmCard({ incident }: AIHarmCardProps) {
  const { harm_categories, affected_population, aiid_id, severity } =
    incident.metadata;

  return (
    <BaseCard incident={incident} hideChipsAndTags>
      <div className="flex flex-col gap-2">
        {/* Harm categories */}
        {harm_categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {harm_categories.map((cat) => (
              <span
                key={cat}
                className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* Affected population */}
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Who was affected:{" "}
          </span>
          {affected_population}
        </p>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          {aiid_id && (
            <a
              href={`https://incidentdatabase.ai/cite/${aiid_id.replace("AIID-", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-rose-600 hover:underline dark:text-rose-400"
            >
              {aiid_id} ↗
            </a>
          )}
          {severity && (
            <SeverityPill severity={severity} />
          )}
        </div>
      </div>
    </BaseCard>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const colours: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  };
  const cls = colours[severity.toLowerCase()] ?? colours.medium;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {severity}
    </span>
  );
}
