import Anthropic from "@anthropic-ai/sdk";
import { Classification, Decision } from "../types";

export interface LlmEnhancement {
  reasoning_summary: string;
  customer_response: string;
  owner_summary: string;
}

export interface LlmInput {
  classification: Classification;
  decision: Decision;
  policy_applied: string;
  detected_amount?: number;
  customer_name: string;
  customer_email: string;
  is_vip: boolean;
  message_body: string;
  next_slot_label?: string;
}

export type LlmProvider = "openai" | "anthropic" | null;

export function detectLlmProvider(): LlmProvider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function llmModelName(provider: LlmProvider): string | null {
  if (provider === "openai") return process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (provider === "anthropic")
    return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  return null;
}

const SYSTEM = `You are Opelo, an AI operations manager for solo creators and freelancers. You speak with the warmth and brevity of a thoughtful chief-of-staff: friendly, direct, professional. Never expose chain-of-thought. Return a short reasoning summary (one sentence, owner-facing), a customer reply (2–4 short sentences, signed from the owner), and a one-sentence owner SMS summary.`;

export async function enhanceWithLLM(
  input: LlmInput,
): Promise<LlmEnhancement | null> {
  const provider = detectLlmProvider();
  if (!provider) return null;

  const prompt = buildPrompt(input);
  try {
    if (provider === "openai") return await callOpenAI(prompt);
    if (provider === "anthropic") return await callAnthropic(prompt);
    return null;
  } catch {
    return null;
  }
}

async function callOpenAI(userPrompt: string): Promise<LlmEnhancement | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return parseEnhancement(text);
}

async function callAnthropic(
  userPrompt: string,
): Promise<LlmEnhancement | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const client = new Anthropic({ apiKey: key });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const resp = await client.messages.create({
    model,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");
  return parseEnhancement(text);
}

function buildPrompt(input: LlmInput): string {
  return `Decision context:
- classification: ${input.classification}
- decision: ${input.decision}
- policy_applied: ${input.policy_applied}
- detected_amount: ${input.detected_amount ?? "n/a"}
- customer: ${input.customer_name} <${input.customer_email}>${input.is_vip ? " [VIP]" : ""}
- proposed_slot: ${input.next_slot_label ?? "n/a"}

Inbound message:
"""
${input.message_body}
"""

Return ONLY a JSON object with keys: reasoning_summary, customer_response, owner_summary. No prose outside JSON. Do not reveal chain-of-thought; reasoning_summary should be one sentence stating the conclusion and the policy that applied.`;
}

function parseEnhancement(text: string): LlmEnhancement | null {
  const parsed = extractJson(text);
  if (!parsed) return null;
  return {
    reasoning_summary: String(parsed.reasoning_summary ?? "").slice(0, 400),
    customer_response: String(parsed.customer_response ?? "").slice(0, 1200),
    owner_summary: String(parsed.owner_summary ?? "").slice(0, 280),
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
