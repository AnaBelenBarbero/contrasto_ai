/**
 * Short-lived HMAC page tokens.
 *
 * The server embeds a token in the rendered page; the browser sends it back
 * as X-Page-Token on every /api/incidents call.  Without first loading the
 * page — and solving any bot challenge in front of it — a script cannot obtain
 * a valid token and the Route Handler rejects the request.
 *
 * Token lifetime: two 5-minute windows (current + previous) to handle users
 * who load the page just before a window boundary.
 *
 * Env var: PAGE_TOKEN_SECRET (any random string, min 32 chars recommended).
 * Falls back to a dev placeholder when the var is absent so local dev works
 * without extra setup — set a real secret in production.
 */

import { createHmac, timingSafeEqual } from "crypto";

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function secret(): string {
  return process.env.PAGE_TOKEN_SECRET ?? "dev-placeholder-set-PAGE_TOKEN_SECRET-in-prod";
}

function hmacForWindow(window: number): string {
  return createHmac("sha256", secret()).update(String(window)).digest("hex");
}

/** Generate a token valid for the current 5-minute window. Call server-side only. */
export function generatePageToken(): string {
  return hmacForWindow(Math.floor(Date.now() / WINDOW_MS));
}

/**
 * Return true when the token matches the current or previous window.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyPageToken(token: string): boolean {
  const now = Math.floor(Date.now() / WINDOW_MS);

  for (const window of [now, now - 1]) {
    const expected = hmacForWindow(window);
    try {
      if (timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return true;
    } catch {
      // Buffers differ in length — not equal.
    }
  }

  return false;
}
