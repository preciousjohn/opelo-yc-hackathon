import { createClient } from "@supabase/supabase-js";
import { MockExternalAction } from "../types";
import { nanoid } from "./util";

export interface SupermemoryDecisionInput {
  customerId: string;
  classification: string;
  decision: string;
  policyApplied: string;
  ownerSummary: string;
}

export interface SupermemoryResponse<T> {
  ok: boolean;
  provider: "supermemory";
  mode: "mock" | "live";
  data: T;
  log: string;
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function inMockMode(): boolean {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function mockResponse<T>(log: string, data: T): SupermemoryResponse<T> {
  return { ok: true, provider: "supermemory", mode: "mock", data, log };
}

function liveResponse<T>(log: string, data: T): SupermemoryResponse<T> {
  return { ok: true, provider: "supermemory", mode: "live", data, log };
}

export async function saveDecision(
  input: SupermemoryDecisionInput,
): Promise<SupermemoryResponse<{ id: string }>> {
  const id = nanoid("mem");
  const client = getClient();
  if (!client) {
    return mockResponse("memory.decision.saved", { id });
  }
  try {
    await client.from("decisions").insert({
      id,
      customer_id: input.customerId,
      classification: input.classification,
      decision: input.decision,
      policy_applied: input.policyApplied,
      owner_summary: input.ownerSummary,
    });
    return liveResponse("memory.decision.saved", { id });
  } catch {
    return mockResponse("memory.decision.saved", { id });
  }
}

export async function searchMemory(
  customerId: string,
): Promise<SupermemoryResponse<{ matches: string[]; customerId: string }>> {
  const client = getClient();
  if (!client) {
    return mockResponse("memory.searched", {
      matches: [],
      customerId,
    });
  }
  try {
    const { data, error } = await client
      .from("decisions")
      .select("classification, decision, policy_applied, owner_summary, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error || !data) {
      return liveResponse("memory.searched", { matches: [], customerId });
    }

    const matches = data.map(
      (r) =>
        `[${new Date(r.created_at).toLocaleDateString()}] ${r.classification} → ${r.decision}: ${r.owner_summary}`,
    );
    return liveResponse("memory.searched", { matches, customerId });
  } catch {
    return liveResponse("memory.searched", { matches: [], customerId });
  }
}

export const supermemory = {
  saveDecision,
  searchMemory,
  inMockMode,
};

export function toMockExternalAction(
  resp: SupermemoryResponse<unknown>,
  detail: string,
): MockExternalAction {
  return {
    name: resp.log,
    ok: resp.ok,
    ref: nanoid("sm"),
    detail,
  };
}
