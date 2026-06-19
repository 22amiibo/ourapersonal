import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set in .env");
  }
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// Forces the model to return data shaped like `tool.input_schema`, and returns
// that object. This is how we get reliable structured output instead of parsing
// free text.
export async function extractWithTool<T = unknown>(opts: {
  system?: string;
  userText: string;
  tool: Anthropic.Tool;
  maxTokens?: number;
}): Promise<T> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
    tools: [opts.tool],
    tool_choice: { type: "tool", name: opts.tool.name },
    messages: [{ role: "user", content: opts.userText }],
  });
  const block = msg.content.find((b) => b.type === "tool_use") as
    | Anthropic.ToolUseBlock
    | undefined;
  if (!block) throw new Error("Model did not return structured output");
  return block.input as T;
}
