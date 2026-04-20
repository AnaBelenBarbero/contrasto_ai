import type { LayoffIncident } from "@/lib/types";
import { formatCount } from "@/lib/counters";
import { BaseCard } from "./BaseCard";

interface LayoffCardProps {
  incident: LayoffIncident;
}

/**
 * Card for AI Layoff incidents.
 *
 * The jobs-lost count is displayed prominently — equivalent to the
 * dollar counter on web3isgoinggreat — to convey human impact at a glance.
 */
export function LayoffCard({ incident }: LayoffCardProps) {
  const { sector, jobs_lost, ai_automation_confirmed, severity, jobs_lost_to_be_confirmed } =
    incident.metadata;

  return (
    <BaseCard incident={incident}>
      <div className="flex items-center justify-between gap-4">
        {/* Jobs lost — big number */}
        <div>
          <p className="text-2xl font-black tabular-nums text-amber-600 dark:text-amber-400">
            {jobs_lost_to_be_confirmed ? "TBC" : formatCount(jobs_lost)}
          </p>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            jobs lost
          </p>
        </div>

        {/* Sector + AI confirmation */}
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            {sector}
          </span>
          <span
            className={`text-xs font-medium ${
              ai_automation_confirmed
                ? "text-amber-600 dark:text-amber-400"
                : "text-neutral-400 dark:text-neutral-500"
            }`}
          >
            {ai_automation_confirmed
              ? "✓ AI causation confirmed"
              : "AI causation inferred"}
          </span>
          {severity && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              {severity}
            </span>
          )}
        </div>
      </div>
    </BaseCard>
  );
}
