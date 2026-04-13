import type { RegulatoryIncident } from "@/lib/types";
import { formatUSD } from "@/lib/counters";
import { BaseCard } from "./BaseCard";

interface RegulatoryCardProps {
  incident: RegulatoryIncident;
}

/**
 * Card for Regulatory Action incidents.
 *
 * Displays fine amount prominently (or "No fine" for investigations),
 * the issuing regulator, and the regulation cited.
 */
export function RegulatoryCard({ incident }: RegulatoryCardProps) {
  const { regulator, fine_amount_usd, regulation_violated, severity } =
    incident.metadata;

  return (
    <BaseCard incident={incident}>
      <div className="flex items-center justify-between gap-4">
        {/* Fine amount */}
        <div>
          {fine_amount_usd != null && fine_amount_usd > 0 ? (
            <>
              <p className="text-2xl font-black tabular-nums text-blue-600 dark:text-blue-400">
                {formatUSD(fine_amount_usd)}
              </p>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                penalty issued
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-neutral-500 dark:text-neutral-400">
                Investigation
              </p>
              <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                no fine issued
              </p>
            </>
          )}
        </div>

        {/* Regulator + regulation */}
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {regulator}
          </span>
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {regulation_violated}
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
