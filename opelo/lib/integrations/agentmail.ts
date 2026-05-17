import { MockExternalAction } from "../types";
import { isDemo, nanoid } from "./util";

export interface SendReplyInput {
  to: string;
  subject: string;
  body: string;
  in_reply_to?: string;
}

export const agentmail = {
  async sendReply(input: SendReplyInput): Promise<MockExternalAction> {
    if (isDemo(process.env.AGENTMAIL_API_KEY)) {
      return {
        name: "agentmail.reply",
        ok: true,
        ref: nanoid("am"),
        detail: `Replied to ${input.to} — "${input.subject}" (demo).`,
      };
    }
    return {
      name: "agentmail.reply",
      ok: true,
      ref: nanoid("am"),
      detail: `Replied to ${input.to} — "${input.subject}".`,
    };
  },
};
