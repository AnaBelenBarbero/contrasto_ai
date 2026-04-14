"use client";

/**
 * FilterBar — type pills + country selector + search input + layout toggle.
 *
 * All state is encoded in URL search params so filters and layout are
 * shareable via link and survive page refresh.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { IncidentType } from "@/lib/types";
import { INCIDENT_TYPE_LABELS } from "@/lib/types";
import type { LayoutMode } from "./Timeline";

interface FilterBarProps {
  countries: string[];
  activeType: string;
  activeCountry: string;
  activeSearch: string;
  activeLayout: LayoutMode;
}

const TYPE_OPTIONS: Array<{ value: IncidentType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "ai_harm", label: INCIDENT_TYPE_LABELS.ai_harm },
  { value: "layoff", label: INCIDENT_TYPE_LABELS.layoff },
  { value: "regulatory", label: INCIDENT_TYPE_LABELS.regulatory },
  { value: "model_failure", label: INCIDENT_TYPE_LABELS.model_failure },
];

const TYPE_ACTIVE_STYLES: Record<string, string> = {
  all: "bg-neutral-700 text-white",
  ai_harm: "bg-rose-500 text-white",
  layoff: "bg-amber-500 text-white",
  regulatory: "bg-blue-500 text-white",
  model_failure: "bg-violet-500 text-white",
};

export function FilterBar({
  countries,
  activeType,
  activeCountry,
  activeSearch,
  activeLayout,
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === "all" || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      startTransition(() => {
        router.push(`/?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  const toggleLayout = useCallback(() => {
    const next = activeLayout === "two-column" ? "single" : "two-column";
    updateParam("layout", next === "two-column" ? "two-column" : "single");
  }, [activeLayout, updateParam]);

  return (
    <div
      className={`border-b border-neutral-800 bg-neutral-900 px-4 py-3 ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Type pills */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
          {TYPE_OPTIONS.map(({ value, label }) => {
            const isActive =
              activeType === value || (value === "all" && activeType === "all");
            return (
              <button
                key={value}
                onClick={() => updateParam("type", value)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  isActive
                    ? TYPE_ACTIVE_STYLES[value]
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 items-center justify-end gap-3">
          {/* Country selector */}
          {countries.length > 0 && (
            <select
              value={activeCountry}
              onChange={(e) => updateParam("country", e.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              aria-label="Filter by country"
            >
              <option value="all">All countries</option>
              {countries.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          )}

          {/* Search */}
          <input
            type="search"
            placeholder="Search…"
            defaultValue={activeSearch}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateParam("q", (e.target as HTMLInputElement).value);
              }
            }}
            onBlur={(e) => updateParam("q", e.target.value)}
            className="w-36 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 sm:w-44"
            aria-label="Search incidents"
          />

          {/* Layout toggle */}
          <button
            onClick={toggleLayout}
            title={
              activeLayout === "two-column"
                ? "Switch to single-column layout"
                : "Switch to two-column layout"
            }
            className="rounded-md border border-neutral-700 p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="Toggle layout"
          >
            {activeLayout === "two-column" ? <SingleColIcon /> : <TwoColIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Layout icons ──────────────────────────────────────────────────────────────

function TwoColIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm8 0a1 1 0 011-1h4a1 1 0 011 1v12a1 1 0 01-1 1h-4a1 1 0 01-1-1V4z" />
    </svg>
  );
}

function SingleColIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 7a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3z" />
    </svg>
  );
}
