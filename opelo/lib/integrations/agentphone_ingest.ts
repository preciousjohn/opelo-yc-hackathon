import { Customer, InboundMessage } from "../types";
import { store } from "../db/store";
import { normalizeInboundSMS } from "./agentphone";

export interface SmsIngestResult {
  ok: boolean;
  inserted: boolean;
  reason?: string;
  message?: InboundMessage;
  customer?: Customer;
  event_type?: string;
}

/**
 * Persist a normalized AgentPhone inbound SMS into the store so the cockpit
 * picks it up via /api/messages polling.
 */
export async function ingestAgentPhoneWebhook(
  payload: unknown,
): Promise<SmsIngestResult> {
  const parsed = normalizeInboundSMS(payload);
  if (!parsed) {
    return {
      ok: false,
      inserted: false,
      reason: "could_not_parse_payload",
    };
  }

  const fromPhone = parsed.from;
  const phoneSlug = slug(fromPhone) || `unknown_${Date.now()}`;
  const customerId = `cus_live_${phoneSlug}`;

  const customer: Customer = {
    id: customerId,
    name: friendlyName(fromPhone),
    email: "",
    phone: fromPhone,
    vip: false,
    prior_refunds: 0,
    lifetime_value: 0,
    created_at: new Date().toISOString(),
  };
  await store.upsertCustomer(customer);

  const messageId = `msg_ap_${slug(parsed.source_id)}`;
  const message: InboundMessage = {
    id: messageId,
    customer_id: customerId,
    channel: "sms",
    subject: `SMS from ${fromPhone}`,
    body: parsed.body,
    received_at: parsed.received_at,
    status: "new",
    amount_hint: detectAmount(parsed.body),
    source_id: parsed.source_id,
  };
  const { inserted, message: stored } = await store.addMessage(message);

  return {
    ok: true,
    inserted,
    reason: inserted ? "inserted" : "duplicate",
    message: stored,
    customer,
    event_type: parsed.event_type,
  };
}

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9_+-]+/g, "_").slice(0, 80);
}

function friendlyName(phone: string): string {
  // Format the phone like (555) 123-4567 when it looks like a US number;
  // otherwise return the raw E.164 string. Either way it's identifiable.
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function detectAmount(text: string): number | undefined {
  // Prefer the FIRST dollar amount — in negotiation-shaped messages people
  // lead with their budget ("my budget is $1,500. Can you do that instead of
  // $3,000?") and we want the customer's offer, not the listing price.
  const matches = Array.from(
    text.matchAll(/\$\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)(\s?[kK])?/g),
  );
  for (const m of matches) {
    const raw = m[1].replace(/,/g, "");
    let n = parseFloat(raw);
    if (m[2]) n *= 1000;
    if (Number.isFinite(n)) return n;
  }
  const kMatch = text.match(/\b([0-9]+(?:\.[0-9]+)?)\s?k\b/i);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;
  return undefined;
}
