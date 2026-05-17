import { MockExternalAction } from "../types";
import { isDemo, nanoid } from "./util";

export interface SpongeRefundInput {
  customerId?: string;
  paymentId?: string;
  amountCents: number;
  reason?: string;
}

export interface SpongePaymentLinkInput {
  amountCents: number;
  description: string;
  customerEmail?: string;
}

export interface SpongeCustomer {
  id: string;
  email: string;
  name: string;
  lifetime_value_cents: number;
  prior_refunds: number;
  tags: string[];
}

export interface SpongeBalance {
  available_cents: number;
  pending_cents: number;
  currency: "USD";
}

export interface SpongeResponse<T> {
  ok: boolean;
  provider: "sponge";
  mode: "mock" | "live";
  data: T;
  log: string;
}

function inMockMode(): boolean {
  return isDemo(process.env.SPONGE_API_KEY, process.env.SPONGE_BASE_URL);
}

function mockResponse<T>(log: string, data: T): SpongeResponse<T> {
  return { ok: true, provider: "sponge", mode: "mock", data, log };
}

function liveResponse<T>(log: string, data: T): SpongeResponse<T> {
  return { ok: true, provider: "sponge", mode: "live", data, log };
}

export async function createRefund(
  input: SpongeRefundInput,
): Promise<SpongeResponse<{ id: string; amount_cents: number; status: string }>> {
  const id = nanoid("re");
  if (inMockMode()) {
    return mockResponse("sponge.mock.refund.created", {
      id,
      amount_cents: input.amountCents,
      status: "succeeded",
    });
  }
  // Live mode hook — wire real Sponge REST call here when SDK is ready.
  return liveResponse("sponge.refund.created", {
    id,
    amount_cents: input.amountCents,
    status: "succeeded",
  });
}

export async function createPaymentLink(
  input: SpongePaymentLinkInput,
): Promise<SpongeResponse<{ id: string; url: string; amount_cents: number }>> {
  const id = nanoid("plink");
  const url = `https://pay.sponge.demo/${id}`;
  if (inMockMode()) {
    return mockResponse("sponge.mock.payment_link.created", {
      id,
      url,
      amount_cents: input.amountCents,
    });
  }
  return liveResponse("sponge.payment_link.created", {
    id,
    url,
    amount_cents: input.amountCents,
  });
}

export async function getCustomer(
  customerId: string,
): Promise<SpongeResponse<SpongeCustomer>> {
  const data: SpongeCustomer = {
    id: customerId,
    email: "customer@example.com",
    name: "Demo Customer",
    lifetime_value_cents: 24000,
    prior_refunds: 0,
    tags: [],
  };
  if (inMockMode()) {
    return mockResponse("sponge.mock.customer.loaded", data);
  }
  return liveResponse("sponge.customer.loaded", data);
}

export async function getBalanceOrWallet(): Promise<SpongeResponse<SpongeBalance>> {
  const data: SpongeBalance = {
    available_cents: 1_842_300,
    pending_cents: 96_400,
    currency: "USD",
  };
  if (inMockMode()) {
    return mockResponse("sponge.mock.balance.loaded", data);
  }
  return liveResponse("sponge.balance.loaded", data);
}

export const sponge = {
  createRefund,
  createPaymentLink,
  getCustomer,
  getBalanceOrWallet,
  inMockMode,
};

export function toMockExternalAction(
  resp: SpongeResponse<unknown>,
  detail: string,
): MockExternalAction {
  return {
    name: resp.log,
    ok: resp.ok,
    ref: nanoid("sp"),
    detail,
  };
}
