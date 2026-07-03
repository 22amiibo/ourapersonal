import { NextResponse } from "next/server";
import { insertIntakeEntry } from "@/lib/intake";

// One-tap logging from outside the app (iOS Shortcuts, widgets). Uses a Bearer
// secret instead of the session cookie — same pattern as /api/cron/*. Lives
// outside proxy.ts's matcher on purpose; auth happens here, per request.

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function authorized(req: Request): boolean {
  const secret = process.env.QUICKLOG_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// GET /api/quicklog?type=caffeine&amount=1[&unit=mg][&note=...]
// Shortcuts-friendly: everything in the query string, one request, no body.
export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();

  const { searchParams } = new URL(req.url);
  const amountRaw = searchParams.get("amount");
  const result = await insertIntakeEntry({
    type: searchParams.get("type") ?? undefined,
    quantity: amountRaw != null ? Number(amountRaw) : undefined,
    unit: searchParams.get("unit") ?? undefined,
    note: searchParams.get("note") ?? undefined,
  });

  if (result.status === 201) {
    return NextResponse.json({ ok: true, entry: result.entry }, { status: 201 });
  }
  return NextResponse.json({ error: result.error }, { status: result.status });
}

// POST /api/quicklog with the same JSON body as /api/log/intake.
export async function POST(req: Request) {
  if (!authorized(req)) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await insertIntakeEntry(body as Parameters<typeof insertIntakeEntry>[0]);
  if (result.status === 201) {
    return NextResponse.json({ ok: true, entry: result.entry }, { status: 201 });
  }
  return NextResponse.json({ error: result.error }, { status: result.status });
}
