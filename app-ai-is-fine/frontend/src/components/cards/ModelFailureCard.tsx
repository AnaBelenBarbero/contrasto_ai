import type { ModelFailureIncident } from "@/lib/types";
import { formatCount } from "@/lib/counters";
import { BaseCard } from "./BaseCard";

interface ModelFailureCardProps {
  incident: ModelFailureIncident;
}

const FAILURE_MODE_LABELS: Record<string, string> = {
  hallucination: "Hallucination",
  outage: "Outage",
  jailbreak: "Jailbreak",
  "data-leak": "Data Leak",
  "unsafe-recommendation": "Unsafe Recommendation",
  "bias-output": "Biased Output",
  "adversarial-manipulation": "Adversarial Manipulation",
  security: "Security Vulnerability",
  other: "Other",
};

/**
 * Card for Model Failure incidents.
 *
 * Shows model name, failure mode badge, and users affected (if known).
 */
export function ModelFailureCard({ incident }: ModelFailureCardProps) {
  const { model_name, failure_mode, users_affected, severity } =
    incident.metadata;

  const failureLabel =
    FAILURE_MODE_LABELS[failure_mode] ??
    failure_mode.charAt(0).toUpperCase() + failure_mode.slice(1);

  return (
    <BaseCard incident={incident}>
      <div className="flex items-center justify-between gap-4">
        {/* Users affected */}
        <div>
          {users_affected != null ? (
            <>
              <p className="text-2xl font-black tabular-nums text-violet-600 dark:text-violet-400">
                {formatCount(users_affected)}
              </p>
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                users affected
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-neutral-500 dark:text-neutral-400">
                Impact unquantified
              </p>
              <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                users affected unknown
              </p>
            </>
          )}
        </div>

        {/* Model name + failure mode */}
        <div className="flex flex-col items-end gap-1 text-right">
          <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            {model_name}
          </span>
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {failureLabel}
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
