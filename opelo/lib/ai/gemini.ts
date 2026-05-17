import { Classification, Decision } from "../types";

export interface GeminiInput {
  managerName: string;
  classification: Classification;
  decision: Decision;
  policy_applied: string;
  detected_amount?: number;
  customer_name: string;
  customer_email: string;
  is_vip: boolean;
  message_body: string;
  next_slot_label?: string;
  business_name: string;
  owner_name: string;
}

export interface GeminiDecisionResponse {
  classification: string;
  reasoning_summary: string;
  decision: string;
  policy_applied: string;
  customer_response: string;
  owner_summary: string;
  action_type: string;
  suggested_external_actions: string[];
}

const SYSTEM_INSTRUCTION = `You are an AI operations manager for a one-person business. You make practical business decisions based on explicit owner policies. You do not merely draft replies; you decide what should happen, choose the relevant policy, generate a customer response, and summarize the owner update. Never expose chain-of-thought. Reasoning_summary must be one short business sentence — not a step-by-step trace. Return only valid JSON.`;

export function isGeminiAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function geminiModelName(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

export async function callGemini(
  input: GeminiInput,
): Promise<GeminiDecisionResponse | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = geminiModelName();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(key)}`;

  const prompt = buildPrompt(input);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
      }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return parseDecision(text);
  } catch {
    return null;
  }
}

function buildPrompt(input: GeminiInput): string {
  return `Business: ${input.business_name} (owner: ${input.owner_name}). You are "${input.managerName}", the AI operations manager.

Decision context (already classified by deterministic engine — refine if clearly wrong, otherwise keep):
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

Return ONLY a JSON object matching this exact schema:
{
  "classification": "refund_request|pricing_exception|sponsorship_offer|qualified_lead|scheduling_request|escalation",
  "reasoning_summary": "one short business sentence, no chain-of-thought",
  "decision": "approve|reject|negotiate|schedule|escalate_to_owner",
  "policy_applied": "short policy label that justified the decision",
  "customer_response": "2-4 short sentences, warm + professional, signed from the owner (not the AI)",
  "owner_summary": "one sentence the owner can read at a glance",
  "action_type": "refund_issued|discount_offered|sponsorship_declined|sponsorship_countered|meeting_booked|owner_escalated|lead_nurtured|auto_reply_sent",
  "suggested_external_actions": ["sponge.refund.created", "agentmail.reply", "agentphone.sms.owner_update"]
}`;
}

function parseDecision(text: string): GeminiDecisionResponse | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<GeminiDecisionResponse>;
    if (
      typeof parsed.classification !== "string" ||
      typeof parsed.decision !== "string" ||
      typeof parsed.customer_response !== "string"
    ) {
      return null;
    }
    return {
      classification: String(parsed.classification),
      reasoning_summary: String(parsed.reasoning_summary ?? "").slice(0, 400),
      decision: String(parsed.decision),
      policy_applied: String(parsed.policy_applied ?? "").slice(0, 280),
      customer_response: String(parsed.customer_response).slice(0, 1500),
      owner_summary: String(parsed.owner_summary ?? "").slice(0, 280),
      action_type: String(parsed.action_type ?? "auto_reply_sent"),
      suggested_external_actions: Array.isArray(parsed.suggested_external_actions)
        ? parsed.suggested_external_actions.slice(0, 10).map(String)
        : [],
    };
  } catch {
    return null;
  }
}
