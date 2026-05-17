import { MockExternalAction } from "../types";
import { isDemo, nanoid } from "./util";

export interface SendReplyInput {
  to: string;
  subject: string;
  body: string;
  /** Local cockpit message id — used for logging only. */
  in_reply_to?: string;
  /** Upstream AgentMail message id. When present we reply in-thread. */
  source_id?: string;
  /** Upstream AgentMail thread id, optional. */
  thread_id?: string;
  /**
   * Caller explicitly says this is a real customer who should receive the
   * email. When false (seeded demo customers), we always mock-send so the
   * demo flow stays clean. Defaults to false.
   */
  live?: boolean;
}

export interface AgentMailEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  received_at: string;
}

export interface AgentMailResponse<T> {
  ok: boolean;
  provider: "agentmail";
  mode: "mock" | "live";
  data: T;
  log: string;
}

function inMockMode(): boolean {
  return isDemo(process.env.AGENTMAIL_API_KEY);
}

function inboxId(): string | undefined {
  return process.env.AGENTMAIL_INBOX_ID?.trim() || undefined;
}

function baseUrl(): string {
  return (
    process.env.AGENTMAIL_BASE_URL?.replace(/\/$/, "") ||
    "https://api.agentmail.to/v0"
  );
}

function mockResponse<T>(log: string, data: T): AgentMailResponse<T> {
  return { ok: true, provider: "agentmail", mode: "mock", data, log };
}

function liveResponse<T>(log: string, data: T): AgentMailResponse<T> {
  return { ok: true, provider: "agentmail", mode: "live", data, log };
}

const DEMO_INBOX: AgentMailEmail[] = [
  {
    id: "am_demo_alex",
    from: "alex@example.com",
    to: "owner@opelo.demo",
    subject: "Refund request for creator course",
    body: "Hey, I bought your creator course yesterday but it wasn't what I expected. Can I get a refund? It was $82.",
    received_at: new Date().toISOString(),
  },
];

export async function getInboundEmails(): Promise<
  AgentMailResponse<AgentMailEmail[]>
> {
  if (inMockMode()) {
    return mockResponse("agentmail.mock.inbox.listed", DEMO_INBOX);
  }
  // Listing real inbound is webhook-driven (see /api/agentmail/webhook).
  return liveResponse("agentmail.inbox.listed", [] as AgentMailEmail[]);
}

export async function replyToEmail(
  input: SendReplyInput,
): Promise<MockExternalAction> {
  return agentmail.sendReply(input);
}

export async function markHandled(
  messageId: string,
): Promise<AgentMailResponse<{ id: string }>> {
  if (inMockMode()) {
    return mockResponse("agentmail.mock.message.marked_handled", {
      id: messageId,
    });
  }
  return liveResponse("agentmail.message.marked_handled", { id: messageId });
}

function looksLikeRealAddress(addr: string): boolean {
  if (!addr) return false;
  const trimmed = addr.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  if (trimmed.endsWith("example.com")) return false;
  if (trimmed.endsWith("example.net")) return false;
  if (trimmed.endsWith("example.org")) return false;
  if (trimmed.endsWith("opelo.demo")) return false;
  if (trimmed.endsWith("social.example")) return false;
  if (trimmed.endsWith("dtcbrand.com")) return false;
  if (trimmed.endsWith("driftenergy.com")) return false;
  if (trimmed.endsWith("northbrand.com")) return false;
  if (trimmed.endsWith("oakwave.io")) return false;
  if (trimmed.endsWith("fieldnotes.example")) return false;
  if (trimmed.startsWith("ig:")) return false;
  return true;
}

interface SendOutcome {
  ok: boolean;
  ref: string;
  log: string;
  detail: string;
}

async function sendViaAgentMail(input: SendReplyInput): Promise<SendOutcome> {
  const key = process.env.AGENTMAIL_API_KEY!;
  const id = inboxId();
  if (!id) {
    return {
      ok: false,
      ref: nanoid("am"),
      log: "agentmail.reply.failed",
      detail:
        "AGENTMAIL_API_KEY is set but AGENTMAIL_INBOX_ID is missing — cannot send.",
    };
  }
  if (!looksLikeRealAddress(input.to)) {
    return {
      ok: false,
      ref: nanoid("am"),
      log: "agentmail.reply.skipped",
      detail: `Recipient looks synthetic ("${input.to}") — skipped real send.`,
    };
  }

  // Prefer the reply endpoint when we have the upstream message id so the
  // thread stays intact. Fall back to a fresh send otherwise.
  const base = baseUrl();
  const url = input.source_id
    ? `${base}/inboxes/${encodeURIComponent(id)}/messages/${encodeURIComponent(
        input.source_id,
      )}/reply`
    : `${base}/inboxes/${encodeURIComponent(id)}/messages/send`;

  const payload: Record<string, unknown> = input.source_id
    ? { text: input.body, html: undefined }
    : {
        to: [input.to],
        subject: input.subject,
        text: input.body,
      };

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
        ref: nanoid("am"),
        log: "agentmail.reply.failed",
        detail: `AgentMail ${resp.status} ${resp.statusText} at ${url} — ${truncate(bodyText, 240)}`,
      };
    }
    let parsedId: string | undefined;
    try {
      const json = JSON.parse(bodyText);
      parsedId =
        json?.id ??
        json?.message_id ??
        json?.data?.id ??
        json?.data?.message_id;
    } catch {
      // ignore parse failures
    }
    return {
      ok: true,
      ref: parsedId ?? nanoid("am"),
      log: "agentmail.reply.sent",
      detail: `Sent via AgentMail to ${input.to} — "${input.subject}".`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return {
      ok: false,
      ref: nanoid("am"),
      log: "agentmail.reply.failed",
      detail: `AgentMail network error: ${msg}`,
    };
  }
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export const agentmail = {
  async sendReply(input: SendReplyInput): Promise<MockExternalAction> {
    const hasKey = !inMockMode();
    // Mock path: no key, OR caller didn't mark this as a real customer.
    if (!hasKey || !input.live) {
      return {
        name: hasKey ? "agentmail.mock.reply" : "agentmail.mock.reply",
        ok: true,
        ref: nanoid("am"),
        detail: `Replied to ${input.to} — "${input.subject}" (demo${hasKey ? " — seeded customer, real send skipped" : ""}).`,
      };
    }

    const outcome = await sendViaAgentMail(input);
    return {
      name: outcome.log,
      ok: outcome.ok,
      ref: outcome.ref,
      detail: outcome.detail,
    };
  },
  async sendDirect(input: {
    to: string;
    subject: string;
    text: string;
    source_id?: string;
  }): Promise<SendOutcome> {
    // Used by /api/agentmail/send-test — always attempts real send when key
    // present, regardless of seeded-customer guard.
    if (inMockMode()) {
      return {
        ok: true,
        ref: nanoid("am"),
        log: "agentmail.mock.reply",
        detail: `Would send to ${input.to} (no AGENTMAIL_API_KEY).`,
      };
    }
    return sendViaAgentMail({
      to: input.to,
      subject: input.subject,
      body: input.text,
      source_id: input.source_id,
      live: true,
    });
  },
  getInboundEmails,
  replyToEmail,
  markHandled,
  inMockMode,
};
