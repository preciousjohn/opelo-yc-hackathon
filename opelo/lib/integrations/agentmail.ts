import { MockExternalAction } from "../types";
import { isDemo, nanoid } from "./util";

export interface SendReplyInput {
  to: string;
  subject: string;
  body: string;
  in_reply_to?: string;
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
  // Live mode hook: real AgentMail REST call goes here when wired.
  return liveResponse("agentmail.inbox.listed", [] as AgentMailEmail[]);
}

export async function replyToEmail(
  input: SendReplyInput,
): Promise<AgentMailResponse<{ to: string; subject: string }>> {
  if (inMockMode()) {
    return mockResponse("agentmail.mock.reply.sent", {
      to: input.to,
      subject: input.subject,
    });
  }
  return liveResponse("agentmail.reply.sent", {
    to: input.to,
    subject: input.subject,
  });
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

// Backwards-compatible: the manager already calls `agentmail.sendReply(...)`.
// Keep the same shape (returns a MockExternalAction-compatible entry) so we
// don't have to change every caller.
export const agentmail = {
  async sendReply(input: SendReplyInput): Promise<MockExternalAction> {
    const detail = inMockMode()
      ? `Replied to ${input.to} — "${input.subject}" (demo).`
      : `Replied to ${input.to} — "${input.subject}".`;
    const name = inMockMode() ? "agentmail.mock.reply" : "agentmail.reply";
    return {
      name,
      ok: true,
      ref: nanoid("am"),
      detail,
    };
  },
  getInboundEmails,
  replyToEmail,
  markHandled,
  inMockMode,
};
