import { MockExternalAction } from "../types";
import { isDemo, nanoid } from "./util";

export interface SmsInput {
  to: string;
  body: string;
}

export const twilio = {
  async smsOwner(text: string): Promise<MockExternalAction> {
    const to = process.env.OWNER_PHONE_NUMBER || "+15555550123";
    if (
      isDemo(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
        process.env.TWILIO_FROM_NUMBER,
      )
    ) {
      return {
        name: "twilio.sms.owner",
        ok: true,
        ref: nanoid("sm"),
        detail: `SMS to ${to}: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""} (demo).`,
      };
    }
    return {
      name: "twilio.sms.owner",
      ok: true,
      ref: nanoid("sm"),
      detail: `SMS to ${to}: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`,
    };
  },
};
