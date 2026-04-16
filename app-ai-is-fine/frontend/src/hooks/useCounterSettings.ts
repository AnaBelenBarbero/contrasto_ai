"use client";

/**
 * Persists counter visibility preferences in localStorage.
 *
 * Returns [config, setConfig] where `config` controls which counter
 * tiles are shown in the CounterBar. Defaults to all enabled.
 *
 * Uses a lazy initialiser so the component only reads localStorage once,
 * avoiding hydration mismatches.
 */

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_COUNTER_CONFIG } from "@/lib/types";
import type { CounterConfig } from "@/lib/types";

const STORAGE_KEY = "ai_tracker_counter_config";

function loadFromStorage(): CounterConfig {
  if (typeof window === "undefined") return DEFAULT_COUNTER_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COUNTER_CONFIG;
    return { ...DEFAULT_COUNTER_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_COUNTER_CONFIG;
  }
}

export function useCounterSettings(): [
  CounterConfig,
  (patch: Partial<CounterConfig>) => void,
  () => void,
] {
  const [config, setConfig] = useState<CounterConfig>(DEFAULT_COUNTER_CONFIG);

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setConfig(loadFromStorage());
  }, []);

  const update = useCallback((patch: Partial<CounterConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors (private browsing, quota exceeded)
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setConfig(DEFAULT_COUNTER_CONFIG);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return [config, update, reset];
}
