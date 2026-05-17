import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/db/store";
import { processInboundMessage } from "@/lib/ai/manager";
import { ActionRecord } from "@/lib/types";
import { nanoid } from "@/lib/integrations/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const messageId: string | undefined = body.message_id;
    const useLLM: boolean = body.use_llm !== false;

    if (!messageId) {
      return NextResponse.json(
        { error: "message_id required" },
        { status: 400 },
      );
    }

    const message = await store.getMessage(messageId);
    if (!message) {
      return NextResponse.json({ error: "message not found" }, { status: 404 });
    }
    const customer = await store.getCustomer(message.customer_id);
    if (!customer) {
      return NextResponse.json(
        { error: "customer not found" },
        { status: 404 },
      );
    }
    const policies = await store.getPolicies();

    await store.updateMessageStatus(messageId, "processing");
    const result = await processInboundMessage(message, policies, customer, {
      useLLM,
    });

    const record: ActionRecord = {
      id: nanoid("act"),
      message_id: message.id,
      customer_id: customer.id,
      classification: result.classification,
      decision: result.decision,
      policy_applied: result.policy_applied,
      customer_response: result.customer_response,
      owner_summary: result.owner_summary,
      action_type: result.action_type,
      mock_external_actions: result.mock_external_actions,
      revenue_delta: result.revenue_delta,
      llm_used: result.llm_used,
      created_at: new Date().toISOString(),
    };
    await store.addAction(record);
    await store.updateMessageStatus(messageId, "handled");

    return NextResponse.json({ ok: true, result, action: record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
