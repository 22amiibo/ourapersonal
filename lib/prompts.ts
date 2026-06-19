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
  description: "Write the morning briefing plus a short list of concrete recommendations.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description:
          "A concise 2-paragraph morning briefing connecting recent reflections, sleep/recovery, and upcoming events.",
      },
      recommendations: {
        type: "array",
        items: { type: "string" },
        description: "2 to 4 specific, practical suggestions for today (study focus, bedtime target, etc.).",
      },
    },
    required: ["summary", "recommendations"],
  },
};

export const BRIEFING_SYSTEM = `You are a personal study-and-recovery assistant writing a short morning briefing for one student.
Use ONLY the data provided. If data is missing (no reflection on some days, no sleep data today), work with what's there and don't speculate about the gaps.
Frame patterns as tentative observations, NEVER as proven cause and effect — e.g. "your two lowest-confidence days both followed short sleep, worth watching", not "poor sleep causes low confidence." There is not enough data for causal claims.
Be specific and practical. Prioritize upcoming exams over assignments over other events. Keep it calm and encouraging, never alarming. Do not give medical advice.`;

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
