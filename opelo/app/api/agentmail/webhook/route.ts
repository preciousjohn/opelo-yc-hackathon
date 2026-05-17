import { NextRequest, NextResponse } from "next/server";
import { ingestAgentMailWebhook } from "@/lib/integrations/agentmail_ingest";

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
    const result = await ingestAgentMailWebhook(payload);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  // Lightweight health check so AgentMail webhook setup can verify the URL.
  return NextResponse.json({
    ok: true,
    endpoint: "agentmail.webhook",
    accepts: "POST application/json",
  });
}
