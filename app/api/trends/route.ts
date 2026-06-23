import { NextResponse } from "next/server";
import { computeTrends, type TrendMetric, type TrendRange } from "@/lib/trends";

const METRICS: TrendMetric[] = [
  "readiness",
  "sleep_score",
  "sleep_hours",
  "hrv",
  "resting_hr",
  "activity_score",
  "steps",
];
const RANGES: TrendRange[] = ["D", "W", "M"];

// GET /api/trends?metric=readiness&range=W  → TrendResult (computed in SQL/JS, no AI).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const metric = searchParams.get("metric") as TrendMetric | null;
  const range = (searchParams.get("range") as TrendRange | null) ?? "W";

  if (!metric || !METRICS.includes(metric)) {
    return NextResponse.json({ error: `metric must be one of: ${METRICS.join(", ")}` }, { status: 400 });
  }
  if (!RANGES.includes(range)) {
    return NextResponse.json({ error: "range must be D, W or M" }, { status: 400 });
  }

  try {
    const result = await computeTrends(metric, range);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
