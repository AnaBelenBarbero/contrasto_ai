"use client";

/**
 * CounterBar — sticky top bar with animated metric tiles.
 *
 * Receives all incidents (unfiltered) to compute running totals.
 * Visible tiles are controlled by `useCounterSettings` (localStorage).
 * A gear icon opens the SettingsPanel.
 */

import { useState } from "react";
import { aggregateCounters, buildCounterTiles } from "@/lib/counters";
import type { AnyIncident } from "@/lib/types";
import { useCounterSettings } from "@/hooks/useCounterSettings";
import { SettingsPanel } from "./SettingsPanel";

interface CounterBarProps {
  incidents: AnyIncident[];
}

export function CounterBar({ incidents }: CounterBarProps) {
  const [config, updateConfig, resetConfig] = useCounterSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const totals = aggregateCounters(incidents);
  const tiles = buildCounterTiles(totals, config);

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950 shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          {/* Metric tiles */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {tiles.length === 0 ? (
              <span className="text-sm text-neutral-500">
                No counters enabled — click ⚙ to configure.
              </span>
            ) : (
              tiles.map((tile, i) => (
                <div key={tile.key} className="flex items-center gap-6">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className="hidden h-6 w-px bg-neutral-700 sm:block"
                    />
                  )}
                  <div className="flex flex-col leading-tight">
                    <span className="text-xl font-black tabular-nums text-white sm:text-2xl">
                      {tile.value}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
                      {tile.label}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Settings toggle */}
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            aria-label="Toggle counter settings"
            className="ml-auto flex-shrink-0 rounded-md p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
          >
            <GearIcon />
          </button>
        </div>
      </div>

      {/* Settings panel slide-down */}
      {settingsOpen && (
        <SettingsPanel
          config={config}
          onChange={updateConfig}
          onReset={resetConfig}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}

function GearIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
    >
      <path
        fillRule="evenodd"
        d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.295 1.473c.497.144.964.317 1.406.516l1.262-.756a1 1 0 011.22.164l1.668 1.667a1 1 0 01.164 1.22l-.756 1.262c.199.443.372.909.516 1.407l1.473.294A1 1 0 0119 10v2.36a1 1 0 01-.804.98l-1.473.295a8.02 8.02 0 01-.516 1.406l.756 1.262a1 1 0 01-.164 1.22l-1.667 1.668a1 1 0 01-1.22.164l-1.263-.756c-.442.199-.909.372-1.406.516l-.294 1.473a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.295-1.473a8.02 8.02 0 01-1.406-.516l-1.262.756a1 1 0 01-1.22-.164L2.99 17.64a1 1 0 01-.164-1.22l.756-1.263a8.02 8.02 0 01-.516-1.406L1.593 13.5A1 1 0 011 12.52V10.16a1 1 0 01.804-.98l1.473-.295c.144-.497.317-.964.516-1.406l-.756-1.262a1 1 0 01.164-1.22L4.868 3.33a1 1 0 011.22-.164l1.262.756c.443-.199.909-.372 1.407-.516L8.82 1.804zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clipRule="evenodd"
      />
    </svg>
  );
}
