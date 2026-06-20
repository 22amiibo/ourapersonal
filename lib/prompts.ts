import type Anthropic from "@anthropic-ai/sdk";

export const reflectionExtractionTool: Anthropic.Tool = {
  name: "save_reflection_metadata",
  description:
    "Extract structured metadata from a daily reflection. Infer only from what is written; do not invent specifics.",
  input_schema: {
    type: "object",
    properties: {
      confidence_level: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "How confident/optimistic the writer sounds about their work, 1 (very low) to 10 (very high).",
      },
      sentiment: {
        type: "number",
        minimum: -1,
        maximum: 1,
        description: "Overall emotional tone, -1 (very negative) to 1 (very positive).",
      },
      accomplishments: {
        type: "array",
        items: { type: "string" },
        description: "Concrete things the writer says they accomplished.",
      },
      pending_work: {
        type: "array",
        items: { type: "string" },
        description: "Things the writer says still need doing.",
      },
      topics: {
        type: "array",
        items: { type: "string" },
        description: "Short lowercase subject/topic tags, e.g. 'biology', 'calculus', 'gym'.",
      },
      blockers: {
        type: "array",
        items: { type: "string" },
        description: "Obstacles, struggles, or things that went wrong.",
      },
    },
    required: ["confidence_level", "sentiment", "accomplishments", "pending_work", "topics", "blockers"],
  },
};

export const briefingTool: Anthropic.Tool = {
  name: "write_briefing",
  description: "Write the morning briefing with a single headline card and 1–3 concrete actions.",
  input_schema: {
    type: "object",
    properties: {
      headline: {
        type: "string",
        description:
          "A single punchy sentence (≤ 12 words) naming the most important thing about today — e.g. 'Big day — 3 meetings, readiness 62. Protect your evening.' or 'Strong recovery. Good day to push hard.'",
      },
      summary: {
        type: "string",
        description:
          "A concise 1-paragraph briefing connecting recent reflections, sleep/recovery, and upcoming events.",
      },
      actions: {
        type: "array",
        items: { type: "string" },
        description: "1 to 3 specific, concrete actions for today. Each ≤ 10 words. Prioritize events > sleep > energy.",
        minItems: 1,
        maxItems: 3,
      },
    },
    required: ["headline", "summary", "actions"],
  },
};

export const BRIEFING_SYSTEM = `You are a personal performance assistant writing a crisp morning briefing for one person.
Use ONLY the data provided. Work with what's there; don't speculate about missing data.
Frame patterns as tentative observations, NEVER as causal claims. Be specific and practical.
Prioritize upcoming high-stakes events. Keep it calm and encouraging, never alarming. No medical advice.
Write the headline first — it should work as a standalone notification text.`;

export const weeklyNoteTool: Anthropic.Tool = {
  name: "write_weekly_note",
  description: "Write ONE short sentence summarizing what stood out this week.",
  input_schema: {
    type: "object",
    properties: {
      notable_note: {
        type: "string",
        description: "A single short sentence (~25 words max) on the week's most notable pattern. Tentative, not causal.",
      },
    },
    required: ["notable_note"],
  },
};

export const monthlyNarrativeTool: Anthropic.Tool = {
  name: "write_monthly_narrative",
  description: "Summarize the past month's patterns and offer one concrete suggestion.",
  input_schema: {
    type: "object",
    properties: {
      narrative: {
        type: "string",
        description:
          "2–3 paragraphs summarizing sleep, readiness, HRV, and mood patterns over the month. Mention the strongest trend (positive or concerning). Close with one concrete suggestion for next month.",
      },
    },
    required: ["narrative"],
  },
};
