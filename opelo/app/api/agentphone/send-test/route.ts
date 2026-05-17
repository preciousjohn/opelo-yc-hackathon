import { NextRequest, NextResponse } from "next/server";
import { agentphone } from "@/lib/integrations/agentphone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify AgentPhone outbound SMS independently of the pipeline.
 *
 *   curl -X POST http://localhost:3000/api/agentphone/send-test \
 *     -H 'Content-Type: application/json' \
 *     -d '{"to":"+15551234567","body":"Hi from Opelo"}'
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const text =
    typeof body.body === "string" && body.body.trim()
      ? body.body
      : typeof body.text === "string" && body.text.trim()
        ? body.text
        : "Opelo · AgentPhone test. If you got this, outbound SMS is wired.";
  const source_id =
    typeof body.source_id === "string" ? body.source_id : undefined;

  if (!to) {
    return NextResponse.json(
      { ok: false, error: "`to` is required (E.164 phone number)" },
      { status: 400 },
    );
  }

  const outcome = await agentphone.sendDirectSMS({ to, body: text, source_id });

  return NextResponse.json(
    {
      ok: outcome.ok,
      mode: outcome.mode,
      action: outcome.action,
      ref: outcome.ref,
      detail: outcome.detail,
      env: {
        AGENTPHONE_API_KEY: process.env.AGENTPHONE_API_KEY ? "present" : "missing",
        AGENTPHONE_NUMBER: process.env.AGENTPHONE_NUMBER ?? null,
        AGENTPHONE_BASE_URL:
          process.env.AGENTPHONE_BASE_URL ?? "https://api.agentphone.ai/v1",
      },
    },
    { status: outcome.ok ? 200 : 502 },
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "agentphone.send-test",
    accepts:
      "POST application/json — fields: to (required), body, source_id",
    env: {
      AGENTPHONE_API_KEY: process.env.AGENTPHONE_API_KEY ? "present" : "missing",
      AGENTPHONE_NUMBER: process.env.AGENTPHONE_NUMBER ?? null,
      AGENTPHONE_BASE_URL:
        process.env.AGENTPHONE_BASE_URL ?? "https://api.agentphone.ai/v1",
    },
  });
}
