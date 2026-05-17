import { NextRequest, NextResponse } from "next/server";
import { ingestAgentPhoneWebhook } from "@/lib/integrations/agentphone_ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let payload: unknown = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  try {
    const result = await ingestAgentPhoneWebhook(payload);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "agentphone.webhook",
    accepts: "POST application/json",
  });
}
