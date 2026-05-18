import { ActionRecord, Customer, InboundMessage } from "../types";
import { store } from "../db/store";
import {
  ParsedCall,
  ParsedSMS,
  eventTypeOf,
  normalizeInboundCall,
  normalizeInboundSMS,
  sendOwnerUpdate,
  sendDirectSMS,
} from "./agentphone";
import { isFromOwner, parseOwnerCommand } from "./owner_commands";
import { processInboundMessage } from "../ai/manager";
import { nanoid } from "./util";

export interface AgentPhoneIngestResult {
  ok: boolean;
  inserted: boolean;
  parsed_kind: "sms" | "call" | "unknown";
  reason?: string;
  message?: InboundMessage;
  customer?: Customer;
  event_type?: string;
  auto_processed?: boolean;
  reply_sent?: boolean;
}

/**
 * Top-level ingest for any AgentPhone webhook payload. Try SMS shape first,
 * then call/transcript shape. Unknown payloads are returned as such so the
 * webhook route can still record them in the debug feed.
 */
export async function ingestAgentPhoneWebhook(
  payload: unknown,
): Promise<AgentPhoneIngestResult> {
  const event_type = eventTypeOf(payload) || "agentphone.event";

  const sms = normalizeInboundSMS(payload);
  if (sms) {
    return ingestSMS(sms, event_type);
  }

  const call = normalizeInboundCall(payload);
  if (call) {
    return ingestCall(call, event_type);
  }

  return {
    ok: false,
    inserted: false,
    parsed_kind: "unknown",
    reason: "could_not_parse_payload",
    event_type,
  };
}

async function ingestSMS(
  parsed: ParsedSMS,
  event_type: string,
): Promise<AgentPhoneIngestResult> {
  // If this SMS came from the owner's personal phone AND looks like a known
  // command (yes / no / later / snooze N), treat it as a command/reaction to
  // a prior owner update. Free-form messages from the owner (e.g. they're
  // demoing the system by texting in as a customer) fall through to the
  // normal customer path so the inbox actually surfaces them.
  if (isFromOwner(parsed.from)) {
    const cmd = parseOwnerCommand(parsed.body);
    if (cmd.type !== "unknown") {
      return handleOwnerCommand(parsed, event_type);
    }
    // Unknown text from owner: log a hint, then fall through as customer.
    console.log(
      "[opelo.owner_command] owner texted a non-command body; treating as customer message for demo",
    );
  }

  const phoneSlug = slug(parsed.from) || `unknown_${Date.now()}`;
  const customerId = `cus_live_${phoneSlug}`;

  const customer: Customer = {
    id: customerId,
    name: friendlyName(parsed.from),
    email: "",
    phone: parsed.from,
    vip: false,
    prior_refunds: 0,
    lifetime_value: 0,
    created_at: new Date().toISOString(),
  };
  await store.upsertCustomer(customer);

  const messageId = `msg_ap_${slug(parsed.source_id)}`;
  const hasAgentphoneMeta =
    parsed.agentId || parsed.conversationId || parsed.numberId || parsed.channel;
  const message: InboundMessage = {
    id: messageId,
    customer_id: customerId,
    channel: "sms",
    subject:
      parsed.channel === "imessage"
        ? `iMessage from ${parsed.from}`
        : `SMS from ${parsed.from}`,
    body: parsed.body,
    received_at: parsed.received_at,
    status: "new",
    amount_hint: detectAmount(parsed.body),
    source_id: parsed.source_id,
    metadata: hasAgentphoneMeta
      ? {
          agentphone: {
            agentId: parsed.agentId,
            conversationId: parsed.conversationId,
            numberId: parsed.numberId,
            channel: parsed.channel,
          },
        }
      : undefined,
  };
  const { inserted, message: stored } = await store.addMessage(message);

  let auto_processed = false;
  let reply_sent = false;

  // Auto-process the message and send a conversational reply
  if (inserted) {
    try {
      const policies = await store.getPolicies();
      await store.updateMessageStatus(messageId, "processing");
      
      const result = await processInboundMessage(stored, policies, customer, {
        useLLM: true,
      });
      
      // Record the action
      const actionRecord: ActionRecord = {
        id: nanoid("act"),
        message_id: stored.id,
        customer_id: customer.id,
        classification: result.classification,
        decision: result.decision,
        policy_applied: result.policy_applied,
        reasoning_summary: result.reasoning_summary,
        customer_response: result.customer_response,
        owner_summary: result.owner_summary,
        action_type: result.action_type,
        mock_external_actions: result.mock_external_actions,
        revenue_delta: result.revenue_delta,
        counter_offer: result.counter_offer,
        llm_used: result.llm_used,
        created_at: new Date().toISOString(),
      };
      await store.addAction(actionRecord);
      await store.updateMessageStatus(messageId, "handled");
      auto_processed = true;
      
      // Send the reply back via SMS using the same conversation thread
      if (customer.phone && result.customer_response) {
        const sendResult = await sendDirectSMS({
          to: customer.phone,
          body: result.customer_response,
          agentId: parsed.agentId,
          conversationId: parsed.conversationId,
          numberId: parsed.numberId,
        });
        reply_sent = sendResult.ok;
        console.log("[opelo.auto_reply] SMS reply sent to", customer.phone, "ok:", sendResult.ok);
      }
    } catch (err) {
      console.error("[opelo.auto_process] failed to process SMS:", err);
      await store.updateMessageStatus(messageId, "new");
    }
  }

  return {
    ok: true,
    inserted,
    parsed_kind: "sms",
    reason: inserted ? "inserted" : "duplicate",
    message: stored,
    customer,
    event_type: parsed.event_type || event_type,
    auto_processed,
    reply_sent,
  };
}

async function handleOwnerCommand(
  parsed: ParsedSMS,
  event_type: string,
): Promise<AgentPhoneIngestResult> {
  const command = parseOwnerCommand(parsed.body);
  // Surfaced in server logs so the user can see what was parsed during a demo.
  console.log("[opelo.owner_command]", {
    type: command.type,
    raw: parsed.body.slice(0, 120),
  });

  // Acknowledge unknown commands back to the owner so they know the system
  // saw the text but didn't recognize the intent. Known commands stay silent
  // here — the booking/decision handler will apply the effect and any owner
  // confirmation goes through there.
  if (command.type === "unknown") {
    await sendOwnerUpdate(
      `Opelo: got your message but didn't recognize that command. Try "yes", "no", "later", or "snooze 30".`,
    );
  }

  // TODO: when the booking workflow is wired, look up the latest
  // owner_escalated / deposit_requested action and apply the command's
  // intent (approve/reject/snooze) to its booking stage.

  return {
    ok: true,
    inserted: false,
    parsed_kind: "sms",
    reason: `owner_command:${command.type}`,
    event_type: parsed.event_type || event_type,
  };
}

async function ingestCall(
  parsed: ParsedCall,
  event_type: string,
): Promise<AgentPhoneIngestResult> {
  const phoneSlug = slug(parsed.from) || `unknown_${Date.now()}`;
  const customerId = `cus_live_call_${phoneSlug}`;
  const displayName = parsed.caller_name?.trim() || friendlyName(parsed.from);

  const customer: Customer = {
    id: customerId,
    name: displayName,
    email: "",
    phone: parsed.from,
    vip: false,
    prior_refunds: 0,
    lifetime_value: 0,
    created_at: new Date().toISOString(),
  };
  await store.upsertCustomer(customer);

  const messageId = `msg_apcall_${slug(parsed.source_id)}`;
  const message: InboundMessage = {
    id: messageId,
    customer_id: customerId,
    channel: "phone_transcript",
    subject: `Call transcript from ${displayName}`,
    body: parsed.transcript,
    received_at: parsed.received_at,
    status: "new",
    amount_hint: detectAmount(parsed.transcript),
    source_id: parsed.source_id,
  };
  const { inserted, message: stored } = await store.addMessage(message);

  let auto_processed = false;
  let reply_sent = false;

  // Auto-process call transcripts and send a follow-up SMS
  if (inserted && parsed.transcript.trim()) {
    try {
      const policies = await store.getPolicies();
      await store.updateMessageStatus(messageId, "processing");
      
      const result = await processInboundMessage(stored, policies, customer, {
        useLLM: true,
      });
      
      // Record the action
      const actionRecord: ActionRecord = {
        id: nanoid("act"),
        message_id: stored.id,
        customer_id: customer.id,
        classification: result.classification,
        decision: result.decision,
        policy_applied: result.policy_applied,
        reasoning_summary: result.reasoning_summary,
        customer_response: result.customer_response,
        owner_summary: result.owner_summary,
        action_type: result.action_type,
        mock_external_actions: result.mock_external_actions,
        revenue_delta: result.revenue_delta,
        counter_offer: result.counter_offer,
        llm_used: result.llm_used,
        created_at: new Date().toISOString(),
      };
      await store.addAction(actionRecord);
      await store.updateMessageStatus(messageId, "handled");
      auto_processed = true;
      
      // Send the reply as a follow-up SMS after the call
      if (customer.phone && result.customer_response) {
        const sendResult = await sendDirectSMS({
          to: customer.phone,
          body: `Following up on our call:\n\n${result.customer_response}`,
        });
        reply_sent = sendResult.ok;
        console.log("[opelo.auto_reply] Call follow-up SMS sent to", customer.phone, "ok:", sendResult.ok);
      }
    } catch (err) {
      console.error("[opelo.auto_process] failed to process call:", err);
      await store.updateMessageStatus(messageId, "new");
    }
  }

  return {
    ok: true,
    inserted,
    parsed_kind: "call",
    reason: inserted ? "inserted" : "duplicate",
    message: stored,
    customer,
    event_type: parsed.event_type || event_type,
    auto_processed,
    reply_sent,
  };
}

function slug(s: string): string {
  return s.replace(/[^a-zA-Z0-9_+-]+/g, "_").slice(0, 80);
}

function friendlyName(phone: string): string {
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
  // lead with their budget.
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
