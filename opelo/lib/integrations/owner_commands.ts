// Owner-side SMS commands. When the owner texts the AgentPhone number from
// their personal phone (OWNER_PHONE_NUMBER), the message is a control signal,
// not a customer inquiry. These helpers detect that and turn the body into a
// structured OwnerCommand.

export type OwnerCommand =
  | { type: "snooze"; messageId?: string; minutes: number }
  | { type: "approve"; messageId?: string }
  | { type: "reject"; messageId?: string }
  | { type: "ask_later" }
  | { type: "unknown"; raw: string };

const APPROVE_PATTERNS = [
  /^(yes|approve|ok|confirmed|go ahead|do it)\b/i,
  /^✅/,
  /^👍/,
];
const REJECT_PATTERNS = [/^(no|reject|don't|cancel|stop)\b/i, /^❌/, /^👎/];

export function parseOwnerCommand(body: string): OwnerCommand {
  const text = body.trim();

  for (const p of APPROVE_PATTERNS) {
    if (p.test(text)) return { type: "approve" };
  }
  for (const p of REJECT_PATTERNS) {
    if (p.test(text)) return { type: "reject" };
  }

  const snoozeMatch =
    text.match(/snooze\s+(\d+)/i) ||
    text.match(/remind\s+me\s+in\s+(\d+)/i);
  if (snoozeMatch) {
    return { type: "snooze", minutes: parseInt(snoozeMatch[1], 10) };
  }

  if (/ask\s+later|not\s+now|later/i.test(text)) {
    return { type: "ask_later" };
  }

  return { type: "unknown", raw: text };
}

export function isFromOwner(fromPhone: string): boolean {
  const owner = process.env.OWNER_PHONE_NUMBER?.trim();
  if (!owner) return false;
  // Compare on last-10 digits so +1 / no-plus / formatting differences don't
  // matter. AgentPhone normalizes inbound to E.164, but owner config might
  // arrive in any common shape.
  const normalize = (p: string) => p.replace(/[^0-9]/g, "").slice(-10);
  const normOwner = normalize(owner);
  if (!normOwner) return false;
  return normalize(fromPhone) === normOwner;
}
