import { NextResponse } from "next/server";
import { ingestEmail } from "@/lib/articles/ingest";
import { USER_ID } from "@/lib/jobs";

// POST /api/articles/refresh — pull-to-refresh: poll the mailbox now. No AI.
export async function POST() {
  try {
    const result = await ingestEmail(USER_ID);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
