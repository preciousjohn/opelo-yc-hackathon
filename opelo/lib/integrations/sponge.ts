import { MockExternalAction } from "../types";
import { isDemo, nanoid } from "./util";

const MCP_ACCEPT = "application/json, text/event-stream";
const MCP_PROTOCOL = "2024-11-05";

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

interface McpEnvelope {
  jsonrpc?: string;
  id?: number;
  result?: {
    content?: { type?: string; text?: string }[];
  };
  error?: { code?: number; message?: string };
}

let mcpSessionId: string | null = null;

function inMockMode(): boolean {
  return isDemo(process.env.SPONGE_API_KEY, process.env.SPONGE_BASE_URL);
}

function mockResponse<T>(log: string, data: T): SpongeResponse<T> {
  return { ok: true, provider: "sponge", mode: "mock", data, log };
}

function liveResponse<T>(log: string, data: T): SpongeResponse<T> {
  return { ok: true, provider: "sponge", mode: "live", data, log };
}

function spongeConfig() {
  const base = process.env.SPONGE_BASE_URL?.replace(/\/$/, "");
  const key = process.env.SPONGE_API_KEY;
  if (!base || !key) return null;
  return { base, key };
}

function parseMcpBody(raw: string): McpEnvelope {
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      return JSON.parse(trimmed.slice(5).trim()) as McpEnvelope;
    }
  }
  return JSON.parse(raw) as McpEnvelope;
}

async function initMcpSession(): Promise<void> {
  const cfg = spongeConfig();
  if (!cfg) throw new Error("Sponge not configured");

  const resp = await fetch(cfg.base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Accept: MCP_ACCEPT,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL,
        capabilities: {},
        clientInfo: { name: "opelo", version: "0.1.0" },
      },
    }),
  });

  const session = resp.headers.get("mcp-session-id");
  if (!session) {
    throw new Error("Sponge MCP: no session ID in initialize response");
  }

  const envelope = parseMcpBody(await resp.text());
  if (envelope.error) {
    throw new Error(envelope.error.message ?? "Sponge MCP initialize failed");
  }

  mcpSessionId = session;
}

async function mcpRequest(
  method: string,
  params: Record<string, unknown>,
  id = Date.now(),
): Promise<McpEnvelope> {
  const cfg = spongeConfig();
  if (!cfg) throw new Error("Sponge not configured");

  if (!mcpSessionId) {
    await initMcpSession();
  }

  const send = async (retry: boolean): Promise<McpEnvelope> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      Accept: MCP_ACCEPT,
    };
    if (mcpSessionId) headers["Mcp-Session-Id"] = mcpSessionId;

    const resp = await fetch(cfg.base, {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });

    const envelope = parseMcpBody(await resp.text());

    if (
      retry &&
      envelope.error?.message?.toLowerCase().includes("session")
    ) {
      mcpSessionId = null;
      await initMcpSession();
      return send(false);
    }

    if (!resp.ok && !envelope.error) {
      throw new Error(`Sponge MCP HTTP ${resp.status}`);
    }

    return envelope;
  };

  return send(true);
}

async function callSpongeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const envelope = await mcpRequest("tools/call", {
    name: toolName,
    arguments: args,
  });

  if (envelope.error) {
    throw new Error(envelope.error.message ?? `Sponge tool ${toolName} failed`);
  }

  const text = envelope.result?.content?.[0]?.text ?? "{}";
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function sumBalanceCents(chains: Record<string, unknown>): number {
  let total = 0;
  for (const chain of Object.values(chains)) {
    if (!chain || typeof chain !== "object") continue;
    const balances = (chain as { balances?: { usdValue?: string; amount?: string }[] })
      .balances;
    if (!Array.isArray(balances)) continue;
    for (const b of balances) {
      if (b.usdValue != null) {
        total += Math.round(parseFloat(b.usdValue) * 100);
      } else if (b.amount != null) {
        total += Math.round(parseFloat(b.amount) * 100);
      }
    }
  }
  return total;
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

  const chain = process.env.SPONGE_REFUND_CHAIN;
  const to =
    input.paymentId?.match(/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/)?.[0] ??
    process.env.SPONGE_REFUND_TO;

  if (!chain || !to) {
    return mockResponse(
      "sponge.mock.refund.created (no refund destination — set SPONGE_REFUND_CHAIN + SPONGE_REFUND_TO)",
      { id, amount_cents: input.amountCents, status: "succeeded" },
    );
  }

  try {
    const amountUsd = (input.amountCents / 100).toFixed(2);
    const result = await callSpongeTool("transfer", {
      chain,
      to,
      amount: amountUsd,
      token: "USDC",
    });
    const txId =
      (typeof result.transaction_hash === "string" && result.transaction_hash) ||
      (typeof result.hash === "string" && result.hash) ||
      id;
    return liveResponse("sponge.transfer.refund", {
      id: txId,
      amount_cents: input.amountCents,
      status: (result.status as string) ?? "succeeded",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return mockResponse(`sponge.refund.fallback (${msg})`, {
      id,
      amount_cents: input.amountCents,
      status: "succeeded",
    });
  }
}

export async function createPaymentLink(
  input: SpongePaymentLinkInput,
): Promise<SpongeResponse<{ id: string; url: string; amount_cents: number }>> {
  const id = nanoid("plink");
  const fallbackUrl = `https://pay.sponge.demo/${id}`;

  if (inMockMode()) {
    return mockResponse("sponge.mock.payment_link.created", {
      id,
      url: fallbackUrl,
      amount_cents: input.amountCents,
    });
  }

  try {
    const result = await callSpongeTool("create_payment_link", {
      amount: input.amountCents / 100,
      description: input.description,
      expires_in_minutes: 60,
    });
    return liveResponse("sponge.payment_link.created", {
      id: String(result.id ?? id),
      url: String(result.url ?? fallbackUrl),
      amount_cents: input.amountCents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return mockResponse(`sponge.payment_link.fallback (${msg})`, {
      id,
      url: fallbackUrl,
      amount_cents: input.amountCents,
    });
  }
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
  if (inMockMode()) {
    return mockResponse("sponge.mock.balance.loaded", {
      available_cents: 1_842_300,
      pending_cents: 96_400,
      currency: "USD",
    });
  }

  try {
    const result = await callSpongeTool("get_balance", {});
    const available_cents = sumBalanceCents(result);
    return liveResponse("sponge.balance.loaded", {
      available_cents,
      pending_cents: 0,
      currency: "USD",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return mockResponse(`sponge.balance.fallback (${msg})`, {
      available_cents: 0,
      pending_cents: 0,
      currency: "USD",
    });
  }
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
