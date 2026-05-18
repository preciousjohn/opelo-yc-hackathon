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
  customer_history?: string[];
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

const SYSTEM_INSTRUCTION = `You are Opelo, an AI operations manager for a local service business (coffee cart, catering, events). You handle event inquiries, collect booking details, send deposit requests, and coordinate day-of logistics. You make real operational decisions based on the owner's policies. Never expose chain-of-thought. reasoning_summary must be one short operational sentence. Return only valid JSON.`;

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
  const isRefundApprove =
    input.classification === "refund_request" && input.decision === "approve";

  const guardrails: string[] = [];
  if (isRefundApprove) {
    const amt = input.detected_amount
      ? `$${input.detected_amount.toFixed(2)}`
      : "the requested amount";
    guardrails.push(
      `CRITICAL: this is a refund approval. The customer_response MUST explicitly state that the refund has been BOTH approved AND processed (the money has been moved), include the dollar amount (${amt}), and set timing expectations (e.g. "within a few business days"). Do not merely say "approved" — the customer's card has been credited.`,
    );
  }
  if (input.decision === "negotiate") {
    guardrails.push(
      `For negotiations, the customer_response should propose the counter-offer warmly and make next steps clear.`,
    );
  }
  if (input.decision === "schedule") {
    guardrails.push(
      `For scheduling, the customer_response should reference the booked time or available windows so the customer can act immediately.`,
    );
  }
  if (input.classification === "event_inquiry") {
    guardrails.push(
      `This is a coffee cart / event service booking inquiry. The customer_response must sound like a warm, professional local business operator. Ask for any missing details (guest count, date, address, setup time, drink preferences, day-of contact). If a budget/amount was detected, mention that a deposit link is being sent to hold the date. Never use consulting or creator industry language.`,
    );
  }

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
${input.customer_history?.length
  ? `\nCustomer history (last ${input.customer_history.length} interactions):\n${input.customer_history.join("\n")}`
  : ""}

Return ONLY a JSON object matching this exact schema:
{
  "classification": "event_inquiry|refund_request|pricing_exception|sponsorship_offer|qualified_lead|scheduling_request|escalation",
  "reasoning_summary": "one short business sentence, no chain-of-thought",
  "decision": "approve|reject|negotiate|schedule|escalate_to_owner",
  "policy_applied": "short policy label that justified the decision",
  "customer_response": "2-4 short sentences, warm + professional. Do not include a signoff or signature — one will be appended automatically.",
  "owner_summary": "one sentence the owner can read at a glance",
  "action_type": "deposit_requested|event_confirmed|day_of_reminder_sent|refund_issued|discount_offered|sponsorship_declined|sponsorship_countered|meeting_booked|owner_escalated|lead_nurtured|auto_reply_sent",
  "suggested_external_actions": ["sponge.refund.created", "agentmail.reply", "agentphone.sms.owner_update"]
}

${guardrails.length ? "Guardrails:\n- " + guardrails.join("\n- ") : ""}`.trim();
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
