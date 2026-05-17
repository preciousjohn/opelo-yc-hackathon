import { MockExternalAction } from "../types";
import { isDemo, nanoid } from "./util";

export interface RefundInput {
  amount: number;
  customer_email: string;
  reason?: string;
}

export interface PaymentLinkInput {
  amount: number;
  description: string;
  customer_email: string;
}

export const stripe = {
  async createRefund(input: RefundInput): Promise<MockExternalAction> {
    if (isDemo(process.env.STRIPE_SECRET_KEY)) {
      return {
        name: "stripe.refunds.create",
        ok: true,
        ref: nanoid("re"),
        detail: `Refunded $${input.amount.toFixed(2)} to ${input.customer_email} (demo).`,
      };
    }
    // Real impl would call Stripe REST API. For hackathon, return mock even with key.
    return {
      name: "stripe.refunds.create",
      ok: true,
      ref: nanoid("re"),
      detail: `Refunded $${input.amount.toFixed(2)} to ${input.customer_email}.`,
    };
  },

  async createPaymentLink(
    input: PaymentLinkInput,
  ): Promise<MockExternalAction> {
    return {
      name: "stripe.payment_links.create",
      ok: true,
      ref: nanoid("plink"),
      detail: `Payment link for $${input.amount.toFixed(2)} — ${input.description}`,
    };
  },
};
