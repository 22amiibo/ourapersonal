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
  description: "Write the morning briefing as a structured intelligence card (spec Section 9.2).",
  input_schema: {
    type: "object",
    properties: {
      headline: {
        type: "string",
        description:
          "A single punchy sentence (≤ 12 words) naming today's single most important thing. Works standalone as a push notification.",
      },
      key_risk: {
        type: "string",
        description:
          "The most important risk or challenge to manage today. 1–2 sentences. Specific, not generic.",
      },
      key_opportunity: {
        type: "string",
        description:
          "The most actionable positive opportunity available today. 1–2 sentences.",
      },
      important_event: {
        type: "string",
        description:
          "The single most time-sensitive upcoming event or deadline within 7 days. Omit if none.",
      },
      recommended_action: {
        type: "string",
        description: "One specific, concrete action for today. ≤ 15 words.",
      },
      sources: {
        type: "array",
        items: { type: "string" },
        description: "Source types used, e.g. ['daily_summary', 'insight', 'prediction', 'feature_vector'].",
      },
    },
    required: ["headline", "key_risk", "key_opportunity", "recommended_action", "sources"],
  },
};

export const BRIEFING_SYSTEM = `You are a personal performance assistant writing a structured morning intelligence briefing for one person.
Use ONLY the data provided. Work with what's there; do not speculate about missing data.
Frame patterns as tentative observations, NEVER as causal claims. Be specific and practical.
Prioritize upcoming high-stakes events. Stay calm and encouraging, never alarming. No medical advice.
ANNOTATED ANOMALIES are user-supplied explanations for unusual days — treat them as ground-truth
context and let them inform key_risk / recommended_action where relevant.
Write the headline first — it must work as a standalone push notification.`;

// The briefing's *voice* adapts to today's recovery state so the same facts
// land differently on a peak day vs. a recovery day. Mirrors the dashboard
// recovery-zone thresholds (see getRecoveryZone in app/dashboard/page.tsx).
export type RecoveryTone = "peak" | "steady" | "cautious" | "recovery";

export function recoveryToneFor(readiness: number | null | undefined): RecoveryTone {
  if (readiness == null) return "steady";
  if (readiness >= 80) return "peak";
  if (readiness >= 65) return "steady";
  if (readiness >= 55) return "cautious";
  return "recovery";
}

export const BRIEFING_TONE: Record<RecoveryTone, string> = {
  peak: "Recovery is HIGH today. Tone: confident and ambitious. Encourage seizing the day and stacking demanding work — this is a day to push and capitalize.",
  steady: "Recovery is SOLID today. Tone: balanced and matter-of-fact. Encourage steady, consistent progress without overreaching.",
  cautious: "Recovery is BELOW baseline today. Tone: measured and protective. Encourage prioritizing essentials, pacing effort, and guarding energy.",
  recovery: "Recovery is LOW today. Tone: gentle and reassuring. Emphasize rest, a lighter load, and self-compassion; avoid pressure or alarm.",
};

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

// =============================================================
// Personal Intelligence System — processing pipeline tools
// =============================================================

export const dailyFactsExtractionTool: Anthropic.Tool = {
  name: "extract_daily_facts",
  description: "Extract structured facts from a daily reflection entry. Only extract what is explicitly present.",
  input_schema: {
    type: "object",
    properties: {
      facts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fact_type: { type: "string", description: "One of: high_stress_signal | study_method_active_recall | study_method_flashcards | study_method_rereading | unusual_event | positive_mood_signal" },
            life_area: { type: "string", description: "One of: sleep | recovery | academics | productivity | mood | nutrition | fitness | stress" },
            value_text: { type: "string", description: "Short description of the fact" },
            confidence: { type: "number", minimum: 0, maximum: 1, description: "Confidence that this fact is present" },
          },
          required: ["fact_type", "life_area", "confidence"],
        },
      },
    },
    required: ["facts"],
  },
};

export const dailySummaryTool: Anthropic.Tool = {
  name: "write_daily_summary",
  description: "Write a terse 2-3 sentence daily health and performance summary.",
  input_schema: {
    type: "object",
    properties: {
      summary_text: { type: "string", description: "2-3 sentences describing the day's health, energy, and notable events" },
      key_events: { type: "array", items: { type: "string" }, description: "Up to 3 notable events or facts from this day" },
      top_insights: { type: "array", items: { type: "string" }, description: "Up to 2 insight slugs that are relevant to this day, if any" },
      life_area: { type: "string", description: "Primary life area for this day: sleep | recovery | academics | productivity | mood | fitness" },
    },
    required: ["summary_text", "key_events", "life_area"],
  },
};

export const weeklyIntelligenceReviewTool: Anthropic.Tool = {
  name: "write_weekly_intelligence_review",
  description: "Write a structured weekly intelligence review from 7 daily summaries.",
  input_schema: {
    type: "object",
    properties: {
      summary_text: { type: "string", description: "2-3 paragraph weekly synthesis" },
      positive_patterns: { type: "array", items: { type: "string" }, description: "Patterns that helped this week" },
      negative_patterns: { type: "array", items: { type: "string" }, description: "Patterns that hurt this week" },
      recommendations: { type: "array", items: { type: "string" }, description: "1-3 concrete recommendations for next week" },
      focus_trends: { type: "array", items: { type: "string" }, description: "Focus and productivity observations" },
      energy_trends: { type: "array", items: { type: "string" }, description: "Energy level observations" },
      academic_trends: { type: "array", items: { type: "string" }, description: "Academic performance observations if relevant" },
    },
    required: ["summary_text", "positive_patterns", "negative_patterns", "recommendations"],
  },
};

export const monthlyNarrativeIntelligenceTool: Anthropic.Tool = {
  name: "write_monthly_narrative_intelligence",
  description: "Write a structured monthly intelligence narrative from weekly summaries.",
  input_schema: {
    type: "object",
    properties: {
      narrative: { type: "string", description: "3-4 paragraph monthly narrative" },
      major_trends: { type: "array", items: { type: "string" }, description: "The 2-4 biggest trends of the month" },
      recurring_themes: { type: "array", items: { type: "string" }, description: "Patterns that repeat across weeks" },
      predictions: { type: "array", items: { type: "string" }, description: "Forward-looking observations for next month" },
    },
    required: ["narrative", "major_trends", "recurring_themes"],
  },
};

export const patternExplanationTool: Anthropic.Tool = {
  name: "explain_patterns",
  description: "Write natural-language descriptions of statistical correlation candidates and identify knowledge graph edges.",
  input_schema: {
    type: "object",
    properties: {
      explanations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            feature_x: { type: "string" },
            feature_y: { type: "string" },
            lag_days: { type: "integer" },
            description: { type: "string", description: "One sentence describing this relationship" },
            graph_edge: {
              type: "object",
              properties: {
                subject: { type: "string" },
                relation: { type: "string", enum: ["improves", "reduces", "predicts", "correlates_with"] },
                object: { type: "string" },
                weight: { type: "number", minimum: -1, maximum: 1 },
              },
              required: ["subject", "relation", "object", "weight"],
            },
          },
          required: ["feature_x", "feature_y", "lag_days", "description", "graph_edge"],
        },
      },
    },
    required: ["explanations"],
  },
};

export const insightGenerationTool: Anthropic.Tool = {
  name: "generate_insights",
  description: "Generate insight records from confirmed statistical patterns.",
  input_schema: {
    type: "object",
    properties: {
      insights: {
        type: "array",
        items: {
          type: "object",
          properties: {
            insight_key: { type: "string", description: "Stable kebab-case slug like 'sleep_biology_performance'" },
            category: { type: "string", enum: ["sleep", "academic", "habit", "recovery", "nutrition", "mood"] },
            life_area: { type: "string" },
            claim: { type: "string", description: "One-sentence claim, e.g. 'Sleep >8h before Biology exams correlates with higher confidence'" },
            explanation: { type: "string", description: "2-3 sentence evidence-based explanation" },
            evidence_summary: { type: "string", description: "Brief statistical summary" },
          },
          required: ["insight_key", "category", "life_area", "claim", "evidence_summary"],
        },
      },
    },
    required: ["insights"],
  },
};

export const observationTool: Anthropic.Tool = {
  name: "write_observation",
  description:
    "Write one short observation interpreting the person's recent health data and reflections: what is happening, what to change, why, and for what outcome. Reference the actual numbers given. 2–4 sentences. No medical claims; frame as observation and suggestion.",
  input_schema: {
    type: "object",
    properties: {
      body: {
        type: "string",
        description:
          "The observation, 2–4 sentences. Concrete and specific to the data provided. Plain text, no markdown headers.",
      },
    },
    required: ["body"],
  },
};

export const OBSERVATION_SYSTEM = `You are a personal performance coach. From a compact summary of pre-computed trends and the person's own reflections, write ONE concise observation: what's happening, what to change, why, and for what outcome. Reference the actual numbers. Be specific and practical. Never invent data not present in the summary. No medical diagnoses.`;

// "Ask your data" — answers a free-text question grounded ONLY in a compact,
// pre-computed summary (recent trends, daily summaries, active insights). The
// model never sees raw rows, keeping token cost bounded and flat.
export const askDataTool: Anthropic.Tool = {
  name: "answer_from_data",
  description:
    "Answer the user's question using ONLY the supplied data summary. If the summary does not contain enough to answer, say so plainly. Reference concrete numbers when present. 2–4 sentences, plain text.",
  input_schema: {
    type: "object",
    properties: {
      answer: {
        type: "string",
        description: "A direct, specific answer grounded only in the provided summary. 2–4 sentences, plain text, no markdown headers.",
      },
      grounded: {
        type: "boolean",
        description: "True if the summary contained enough relevant data to answer; false if you had to decline.",
      },
    },
    required: ["answer", "grounded"],
  },
};

export const ASK_DATA_SYSTEM = `You answer questions about one person's health and performance using ONLY the data summary provided. Never invent numbers or facts not in the summary. If the data can't answer the question, say what's missing instead of guessing. Be concrete, reference actual figures, stay practical, and give no medical diagnoses.`;

export const DAILY_SUMMARY_SYSTEM = `You are a terse health data analyst. Write compact, factual daily summaries from structured data. Do not speculate. Report what happened.`;

export const WEEKLY_INTELLIGENCE_SYSTEM = `You are a personal performance coach reviewing one week of health and productivity data. Identify patterns. Be specific. Reference actual numbers. Frame patterns as observations, not medical claims.`;

export const MONTHLY_INTELLIGENCE_SYSTEM = `You are a long-term health analyst synthesizing a month of weekly summaries. Identify recurring themes, significant trends, and forward-looking observations. Be analytical and specific.`;
