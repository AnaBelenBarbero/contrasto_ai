/**
 * POST /api/subscribe
 *
 * Accepts { email: string } and inserts a row into email_leads.
 * Uses the service-role key so the insert works even if the anon INSERT
 * policy is accidentally tightened later.  The key never leaves the server.
 *
 * Returns:
 *   201  { ok: true }                  — new subscriber added
 *   200  { ok: true, existing: true }  — email already registered (idempotent)
 *   400  { error: string }             — invalid payload
 *   500  { error: string }             — unexpected DB error
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const client = getServiceClient();
  if (!client) {
    console.error("subscribe: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env.local");
    return NextResponse.json({ error: "Server misconfiguration." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? String((body as Record<string, unknown>).email).trim().toLowerCase()
      : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const { error } = await client
    .from("email_leads")
    .insert({ email, source: "header_signup" });

  if (error) {
    // Unique-constraint violation → already subscribed (treat as success)
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, existing: true }, { status: 200 });
    }
    console.error("subscribe error:", error.message);
    return NextResponse.json({ error: "Something went wrong. Try again shortly." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
