"use client";

/**
 * NewsletterSignup — compact inline email-capture form.
 *
 * Always rendered — no dismiss button, no localStorage.
 * Designed to live inside the counter bar alongside the metrics.
 *
 * States: idle → loading → success | error
 */

import { useState } from "react";

type State = "idle" | "loading" | "success" | "error";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "loading" || state === "success") return;

    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error ?? "Something went wrong.");
        return;
      }

      setState("success");
      setEmail("");
    } catch {
      setState("error");
      setErrorMsg("Network error — try again.");
    }
  };

  if (state === "success") {
    return (
      <span className="text-[11px] font-semibold text-orange-300">
        You&apos;re in!  🔥🔥
      </span>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 items-center gap-2" noValidate>
      <div className="relative min-w-0">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") { setState("idle"); setErrorMsg(""); }
          }}
          placeholder="your@email.com"
          required
          disabled={state === "loading"}
          className={`h-7 w-40 rounded border bg-neutral-900 px-2.5 text-[11px] text-white placeholder-neutral-600 outline-none transition-all focus:ring-1 disabled:opacity-50 sm:w-48 ${
            state === "error"
              ? "border-rose-500/70 focus:ring-rose-500/20"
              : "border-neutral-700 focus:border-orange-500/60 focus:ring-orange-500/15"
          }`}
        />
        {state === "error" && (
          <span className="absolute -bottom-3.5 left-0 whitespace-nowrap text-[9px] text-rose-400">
            {errorMsg}
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={state === "loading"}
        className="h-7 flex-shrink-0 rounded bg-orange-600 px-2.5 text-[11px] font-bold text-white shadow shadow-orange-900/40 transition-all hover:bg-orange-500 active:scale-95 disabled:opacity-60"
      >
        {state === "loading" ? "…" : "Subscribe 🔥"}
      </button>
    </form>
  );
}
