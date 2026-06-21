// Voyage AI REST integration — no SDK. Embeddings are 1024-dim (voyage-3),
// matching the pgvector columns defined in extra-schema.sql.

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY not set");
  if (texts.length === 0) return [];

  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`Voyage AI error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const results = await embedTexts([text]);
  return results[0];
}

// pgvector accepts a string literal of the form '[0.1,0.2,...]'.
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

// Text construction helpers — spec Section 5.1.

export function buildDailySummaryText(s: {
  summary_text: string;
  key_events?: string[] | null;
  top_insights?: string[] | null;
}): string {
  const parts = [s.summary_text];
  if (s.key_events?.length) parts.push(s.key_events.join(". "));
  if (s.top_insights?.length) parts.push(s.top_insights.join(" "));
  return parts.join(" ");
}

export function buildWeeklySummaryText(s: {
  summary_text: string;
  positive_patterns?: string[] | null;
  negative_patterns?: string[] | null;
}): string {
  const parts = [s.summary_text];
  if (s.positive_patterns?.length) parts.push(s.positive_patterns.join(". "));
  if (s.negative_patterns?.length) parts.push(s.negative_patterns.join(". "));
  return parts.join(" ");
}

export function buildMonthlySummaryText(s: {
  narrative: string;
  major_trends?: string[] | null;
}): string {
  const parts = [s.narrative];
  if (s.major_trends?.length) parts.push(s.major_trends.join(". "));
  return parts.join(" ");
}

export function buildInsightText(i: {
  claim: string;
  evidence_summary?: string | null;
  explanation?: string | null;
}): string {
  return [i.claim, i.evidence_summary, i.explanation].filter(Boolean).join(" ");
}

export function buildReflectionText(rawText: string, summary?: string): string {
  if (summary && rawText.length > 1500) return summary;
  return rawText.slice(0, 2000);
}
