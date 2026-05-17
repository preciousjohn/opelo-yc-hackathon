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

const SYSTEM = `You are Opelo, an AI operations manager for solo creators and freelancers. You speak with the warmth and brevity of a thoughtful chief-of-staff: friendly, direct, professional. Never expose chain-of-thought. Return a short reasoning summary (one sentence, owner-facing), a customer reply (2–4 short sentences, signed from the owner), and a one-sentence owner SMS summary.`;

export async function enhanceWithLLM(
  input: LlmInput,
): Promise<LlmEnhancement | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  try {
    const client = new Anthropic({ apiKey: key });
    const userPrompt = buildPrompt(input);
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const text = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");
    const parsed = extractJson(text);
    if (!parsed) return null;
    return {
      reasoning_summary: String(parsed.reasoning_summary ?? "").slice(0, 400),
      customer_response: String(parsed.customer_response ?? "").slice(0, 1200),
      owner_summary: String(parsed.owner_summary ?? "").slice(0, 280),
    };
  } catch {
    return null;
  }
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
