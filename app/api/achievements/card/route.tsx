import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { USER_ID } from "@/lib/jobs";
import { ACHIEVEMENTS, TIER_LABEL, type Tier } from "@/lib/achievements";

// Shareable award card — a 1080×1080 PNG rendered off-DOM with next/og.
// CSS variables don't exist there, so tier metals are inlined hex mirrors of
// the --tier-* tokens in globals.css.

const TIER_HEX: Record<Tier, string> = {
  1: "#b08157", // bronze
  2: "#c2c6cd", // silver
  3: "#d9bd83", // champagne
  4: "#e3e6ea", // platinum
  5: "#a9e0e6", // diamond
};

const ACCENT = "#14b8a6";
const BG = "#000000";
const INK = "#f5f5fa";
const INK_3 = "#8a8a94";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) {
    return NextResponse.json({ error: "unknown achievement id" }, { status: 404 });
  }

  let earnedDate: string | null = null;
  try {
    const rows = await sql`
      SELECT to_char(unlocked_at, 'Mon DD, YYYY') AS d
      FROM achievement_unlocks
      WHERE user_id = ${USER_ID} AND achievement_id = ${def.id}`;
    earnedDate = (rows[0] as { d: string } | undefined)?.d ?? null;
  } catch {
    /* optional table */
  }

  const metal = def.tier ? TIER_HEX[def.tier] : ACCENT;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 900,
            height: 900,
            borderRadius: 48,
            border: `2px solid ${metal}`,
            boxShadow: `0 0 120px ${metal}44`,
            background: `linear-gradient(180deg, ${metal}14, transparent 60%)`,
            padding: 80,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 180,
              height: 180,
              borderRadius: 90,
              background: `${metal}22`,
              border: `3px solid ${metal}`,
              fontSize: 96,
              color: metal,
            }}
          >
            ★
          </div>
          {def.tier && (
            <div
              style={{
                marginTop: 48,
                fontSize: 28,
                letterSpacing: 6,
                textTransform: "uppercase",
                color: metal,
                display: "flex",
              }}
            >
              {TIER_LABEL[def.tier]}
            </div>
          )}
          <div style={{ marginTop: 24, fontSize: 72, fontWeight: 700, textAlign: "center", display: "flex" }}>
            {def.title}
          </div>
          <div style={{ marginTop: 24, fontSize: 32, color: INK_3, textAlign: "center", display: "flex" }}>
            {def.description}
          </div>
          {earnedDate && (
            <div style={{ marginTop: 48, fontSize: 28, color: metal, display: "flex" }}>
              Earned {earnedDate}
            </div>
          )}
          <div style={{ marginTop: 56, fontSize: 24, color: ACCENT, letterSpacing: 4, display: "flex" }}>
            BRIEFING
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
