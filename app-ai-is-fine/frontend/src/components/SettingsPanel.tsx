"use client";

/**
 * SettingsPanel — slide-down panel to toggle which counters are visible.
 *
 * Rendered directly below the CounterBar when the gear icon is clicked.
 */

import type { CounterConfig } from "@/lib/types";

interface SettingsPanelProps {
  config: CounterConfig;
  onChange: (patch: Partial<CounterConfig>) => void;
  onReset: () => void;
  onClose: () => void;
}

const TOGGLES: Array<{ key: keyof CounterConfig; label: string; description: string }> = [
  {
    key: "showTotalIncidents",
    label: "Total Incidents",
    description: "Count of all AI incidents tracked",
  },
  {
    key: "showJobsLost",
    label: "Jobs Lost",
    description: "Sum of jobs lost across all layoff events",
  },
  {
    key: "showFines",
    label: "Regulatory Fines",
    description: "Total fines levied by regulators (USD)",
  },
  {
    key: "showUsersAffected",
    label: "Users Affected",
    description: "Estimated users affected by model failures",
  },
  {
    key: "showCompanies",
    label: "Companies Implicated",
    description: "Distinct organisations across all incidents",
  },
];

export function SettingsPanel({
  config,
  onChange,
  onReset,
  onClose,
}: SettingsPanelProps) {
  return (
    <div className="relative z-30 border-b border-neutral-800 bg-neutral-900 shadow-lg">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-200 uppercase tracking-widest">
            Counter Settings
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={onReset}
              className="text-xs text-neutral-400 hover:text-neutral-200 underline"
            >
              Reset to defaults
            </button>
            <button
              onClick={onClose}
              aria-label="Close settings"
              className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TOGGLES.map(({ key, label, description }) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-neutral-800"
            >
              <input
                type="checkbox"
                checked={config[key]}
                onChange={(e) => onChange({ [key]: e.target.checked })}
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-neutral-600 bg-neutral-700 accent-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-neutral-200">{label}</p>
                <p className="text-xs text-neutral-400">{description}</p>
              </div>
            </label>
          ))}
        </div>

        <p className="mt-3 text-xs text-neutral-500">
          Preferences are saved in your browser (localStorage).
        </p>
      </div>
    </div>
  );
}
