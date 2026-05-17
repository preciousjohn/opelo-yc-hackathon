import { MockExternalAction } from "../types";
import { isDemo, nanoid } from "./util";

export interface AgentPhoneSMS {
  id: string;
  from: string;
  to: string;
  body: string;
  received_at: string;
}

export interface AgentPhoneCall {
  id: string;
  from: string;
  to: string;
  duration_seconds: number;
  received_at: string;
  caller_name?: string;
  status: "completed" | "in_progress" | "missed";
}

export interface AgentPhoneResponse<T> {
  ok: boolean;
  provider: "agentphone";
  mode: "mock" | "live";
  action: string;
  data: T;
  error?: string;
}

export interface SendSMSInput {
  to: string;
  body: string;
  /** Set true when this is a real customer who should actually receive the SMS. */
  live?: boolean;
  /** Upstream AgentPhone message id, used for threading if supported. */
  source_id?: string;
}

interface SendOutcome {
  ok: boolean;
  action: string;
  ref: string;
  detail: string;
  mode: "mock" | "live";
}

function inMockMode(): boolean {
  return isDemo(process.env.AGENTPHONE_API_KEY);
}

function fromNumber(): string | undefined {
  return process.env.AGENTPHONE_NUMBER?.trim() || undefined;
}

function baseUrl(): string {
  return (
    process.env.AGENTPHONE_BASE_URL?.replace(/\/$/, "") ||
    "https://api.agentphone.ai/v1"
  );
}

function mockResponse<T>(action: string, data: T): AgentPhoneResponse<T> {
  return { ok: true, provider: "agentphone", mode: "mock", action, data };
}

function liveResponse<T>(action: string, data: T): AgentPhoneResponse<T> {
  return { ok: true, provider: "agentphone", mode: "live", action, data };
}

function failureResponse<T>(
  action: string,
  data: T,
  error: string,
): AgentPhoneResponse<T> {
  return {
    ok: false,
    provider: "agentphone",
    mode: "live",
    action,
    data,
    error,
  };
}

function preview(text: string, n = 140): string {
  return text.length > n ? `${text.slice(0, n - 1)}…` : text;
}

function looksLikePhone(value: string): boolean {
  if (!value) return false;
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  // Reject the obvious demo placeholders we ship with the seed data.
  if (/^\+?15555550\d{3}$/.test(value)) return false;
  return /^\+?\d+$/.test(value.replace(/[\s().-]/g, ""));
}

function normalizePhone(value: string): string {
  const cleaned = value.replace(/[\s().-]/g, "");
  return cleaned;
}

async function callAgentPhone(input: {
  to: string;
  body: string;
  source_id?: string;
}): Promise<SendOutcome> {
  const key = process.env.AGENTPHONE_API_KEY!;
  const from = fromNumber();
  if (!from) {
    return {
      ok: false,
      action: "agentphone.sms.failed",
      ref: nanoid("ap"),
      detail:
        "AGENTPHONE_API_KEY is set but AGENTPHONE_NUMBER is missing — cannot send.",
      mode: "live",
    };
  }
  const to = normalizePhone(input.to);
  if (!looksLikePhone(to)) {
    return {
      ok: false,
      action: "agentphone.sms.skipped",
      ref: nanoid("ap"),
      detail: `Recipient looks synthetic ("${input.to}") — skipped real send.`,
      mode: "live",
    };
  }

  // AgentPhone tenants vary in path. Default to `/sms/send` but allow an
  // override via `AGENTPHONE_SEND_PATH` (e.g. `/messages`, `/v1/sms`,
  // `/agents/{agent_id}/messages`) without code changes. Path may be absolute
  // or relative to the configured base URL.
  const path = process.env.AGENTPHONE_SEND_PATH?.trim() || "/sms/send";
  const url = path.startsWith("http")
    ? path
    : `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const payload: Record<string, unknown> = {
    from,
    to,
    body: input.body,
  };
  if (input.source_id) payload.in_reply_to = input.source_id;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const bodyText = await resp.text().catch(() => "");
    if (!resp.ok) {
      return {
        ok: false,
        action: "agentphone.sms.failed",
        ref: nanoid("ap"),
        detail: `AgentPhone ${resp.status} ${resp.statusText} at ${url} — ${bodyText.slice(0, 240)}`,
        mode: "live",
      };
    }
    let parsedId: string | undefined;
    try {
      const json = JSON.parse(bodyText);
      parsedId = json?.id ?? json?.message_id ?? json?.data?.id;
    } catch {
      // ignore
    }
    return {
      ok: true,
      action: "agentphone.sms.sent",
      ref: parsedId ?? nanoid("ap"),
      detail: `Sent SMS to ${to}: ${preview(input.body)}`,
      mode: "live",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return {
      ok: false,
      action: "agentphone.sms.failed",
      ref: nanoid("ap"),
      detail: `AgentPhone network error: ${msg}`,
      mode: "live",
    };
  }
}

export async function sendSMS(
  input: SendSMSInput,
): Promise<MockExternalAction> {
  const hasKey = !inMockMode();
  // Mock unless: real key is set AND caller marked this as a live recipient.
  if (!hasKey || !input.live) {
    return {
      name: "agentphone.mock.sms.sent",
      ok: true,
      ref: nanoid("ap"),
      detail: `Sent SMS to ${input.to}: ${preview(input.body)} (demo${hasKey ? " — seeded customer" : ""}).`,
    };
  }
  const outcome = await callAgentPhone(input);
  return {
    name: outcome.action,
    ok: outcome.ok,
    ref: outcome.ref,
    detail: outcome.detail,
  };
}

export async function sendOwnerUpdate(
  message: string,
): Promise<MockExternalAction> {
  const owner = process.env.OWNER_PHONE_NUMBER?.trim();
  const hasKey = !inMockMode();
  if (!hasKey || !owner || !looksLikePhone(owner)) {
    const fallback = owner || "+15555550123";
    return {
      name: "agentphone.mock.owner_update.sent",
      ok: true,
      ref: nanoid("ap"),
      detail: `SMS to owner ${fallback}: ${preview(message)} (demo${owner && !looksLikePhone(owner) ? " — OWNER_PHONE_NUMBER looks synthetic" : !owner ? " — OWNER_PHONE_NUMBER missing" : ""}).`,
    };
  }
  const outcome = await callAgentPhone({ to: owner, body: message });
  return {
    name: outcome.ok ? "agentphone.owner_update.sent" : outcome.action,
    ok: outcome.ok,
    ref: outcome.ref,
    detail: outcome.detail,
  };
}

export async function sendDirectSMS(input: {
  to: string;
  body: string;
  source_id?: string;
}): Promise<SendOutcome> {
  if (inMockMode()) {
    return {
      ok: true,
      action: "agentphone.mock.sms.sent",
      ref: nanoid("ap"),
      detail: `Would SMS ${input.to}: ${preview(input.body)} (no AGENTPHONE_API_KEY).`,
      mode: "mock",
    };
  }
  return callAgentPhone(input);
}

export async function getInboundSMS(): Promise<
  AgentPhoneResponse<AgentPhoneSMS[]>
> {
  if (inMockMode()) {
    return mockResponse("agentphone.mock.inbound_sms.listed", [
      {
        id: "ap_sms_demo",
        from: "+15551234002",
        to: fromNumber() ?? "+15555550100",
        body:
          "I want your consulting package but my budget is $1,500. Can you do that instead of $3,000?",
        received_at: new Date().toISOString(),
      },
    ]);
  }
  // Live inbound is webhook-driven via /api/agentphone/webhook.
  return liveResponse("agentphone.inbound_sms.listed", [] as AgentPhoneSMS[]);
}

export async function getInboundCalls(): Promise<
  AgentPhoneResponse<AgentPhoneCall[]>
> {
  if (inMockMode()) {
    return mockResponse("agentphone.mock.inbound_calls.listed", [
      {
        id: "ap_call_kai",
        from: "+15551234001",
        to: fromNumber() ?? "+15555550100",
        duration_seconds: 47,
        received_at: new Date().toISOString(),
        caller_name: "Kai Whitfield",
        status: "completed",
      },
    ]);
  }
  return liveResponse(
    "agentphone.inbound_calls.listed",
    [] as AgentPhoneCall[],
  );
}

export async function getCallTranscript(
  callId: string,
): Promise<AgentPhoneResponse<{ id: string; transcript: string }>> {
  if (inMockMode()) {
    return mockResponse("agentphone.mock.transcript.loaded", {
      id: callId,
      transcript:
        "Hi, I run a fast-growing DTC brand and need help building an AI customer support workflow. Budget is around $8k. Are you available next week?",
    });
  }
  return liveResponse("agentphone.transcript.loaded", {
    id: callId,
    transcript: "",
  });
}

export function normalizeInboundSMS(payload: unknown): {
  source_id: string;
  from: string;
  to?: string;
  body: string;
  received_at: string;
  event_type: string;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const event_type =
    pickString(obj, ["event", "event_type", "type"]) ?? "sms.received";

  // Only process events that look like inbound messages/SMS, OR any payload
  // that already carries body+from (which means we've been handed an inner
  // message object directly).
  const inner = extractInnerMessage(obj);
  const eventLooksRight =
    /received|inbound|sms|message|conversation/i.test(event_type);
  if (!inner && !eventLooksRight) return null;

  const m = inner ?? obj;
  const fromRaw =
    pickString(m, ["from", "from_number", "caller", "msisdn"]) ??
    pickString(obj, ["from", "from_number", "caller"]);
  const body =
    pickString(m, ["body", "text", "content", "message"]) ??
    pickString(obj, ["body", "text", "content", "message"]);
  if (!fromRaw || !body) return null;

  const source_id =
    pickString(m, ["id", "message_id", "uid"]) ??
    pickString(obj, ["id", "message_id"]) ??
    `ap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const to =
    pickString(m, ["to", "to_number", "recipient"]) ??
    pickString(obj, ["to", "to_number"]);
  const received_at =
    pickString(m, ["received_at", "created_at", "timestamp", "date"]) ??
    pickString(obj, ["received_at", "created_at", "timestamp"]) ??
    new Date().toISOString();

  return {
    source_id,
    from: fromRaw.trim(),
    to,
    body: body.trim(),
    received_at,
    event_type,
  };
}

function extractInnerMessage(
  payload: Record<string, unknown>,
): Record<string, unknown> | null {
  const candidates: unknown[] = [
    payload.message,
    payload.sms,
    payload.data,
    (payload.data as Record<string, unknown> | undefined)?.message,
    (payload.data as Record<string, unknown> | undefined)?.sms,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object") {
      const obj = c as Record<string, unknown>;
      if (
        obj.body ||
        obj.text ||
        obj.content ||
        obj.from ||
        obj.from_number
      ) {
        return obj;
      }
    }
  }
  return null;
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

export function toMockExternalAction(
  resp: AgentPhoneResponse<unknown>,
  detail: string,
): MockExternalAction {
  return {
    name: resp.action,
    ok: resp.ok,
    ref: nanoid("ap"),
    detail,
  };
}

export const agentphone = {
  sendSMS,
  sendOwnerUpdate,
  sendDirectSMS,
  getInboundSMS,
  getInboundCalls,
  getCallTranscript,
  normalizeInboundSMS,
  inMockMode,
};
