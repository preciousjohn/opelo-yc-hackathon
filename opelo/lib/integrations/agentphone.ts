import { MockExternalAction } from "../types";
import { isDemo, nanoid } from "./util";

export interface AgentPhoneCall {
  id: string;
  from: string;
  to: string;
  duration_seconds: number;
  received_at: string;
  caller_name?: string;
  status: "completed" | "in_progress" | "missed";
}

export interface AgentPhoneSMS {
  id: string;
  from: string;
  to: string;
  body: string;
  received_at: string;
}

export interface AgentPhoneResponse<T> {
  ok: boolean;
  provider: "agentphone";
  mode: "mock" | "live";
  data: T;
  log: string;
}

const DEMO_TRANSCRIPT = `Hi, I run a fast-growing DTC brand and need help building an AI customer support workflow. Budget is around $8k. Are you available next week?`;

function inMockMode(): boolean {
  return isDemo(process.env.AGENTPHONE_API_KEY, process.env.AGENTPHONE_BASE_URL);
}

function mockResponse<T>(log: string, data: T): AgentPhoneResponse<T> {
  return { ok: true, provider: "agentphone", mode: "mock", data, log };
}

function liveResponse<T>(log: string, data: T): AgentPhoneResponse<T> {
  return { ok: true, provider: "agentphone", mode: "live", data, log };
}

export async function getInboundCalls(): Promise<
  AgentPhoneResponse<AgentPhoneCall[]>
> {
  if (inMockMode()) {
    const data: AgentPhoneCall[] = [
      {
        id: "ap_call_kai",
        from: "+15551234001",
        to: process.env.AGENTPHONE_NUMBER ?? "+15555550100",
        duration_seconds: 47,
        received_at: new Date().toISOString(),
        caller_name: "Kai Whitfield",
        status: "completed",
      },
    ];
    return mockResponse("agentphone.mock.calls.listed", data);
  }
  // Live mode hook — wire real AgentPhone REST call here when SDK is ready.
  return liveResponse("agentphone.calls.listed", [] as AgentPhoneCall[]);
}

export async function getCallTranscript(
  callId: string,
): Promise<AgentPhoneResponse<{ id: string; transcript: string }>> {
  if (inMockMode()) {
    return mockResponse("agentphone.mock.transcript.loaded", {
      id: callId,
      transcript: DEMO_TRANSCRIPT,
    });
  }
  return liveResponse("agentphone.transcript.loaded", {
    id: callId,
    transcript: "",
  });
}

export async function getInboundSMS(): Promise<
  AgentPhoneResponse<AgentPhoneSMS[]>
> {
  if (inMockMode()) {
    const data: AgentPhoneSMS[] = [
      {
        id: "ap_sms_riya",
        from: "+15551234002",
        to: process.env.AGENTPHONE_NUMBER ?? "+15555550100",
        body: "I want your consulting package but my budget is $1,500. Can you do that instead of $3,000?",
        received_at: new Date().toISOString(),
      },
    ];
    return mockResponse("agentphone.mock.sms.listed", data);
  }
  return liveResponse("agentphone.sms.listed", [] as AgentPhoneSMS[]);
}

export async function sendSMS(
  to: string,
  message: string,
): Promise<AgentPhoneResponse<{ to: string; preview: string }>> {
  const preview =
    message.length > 140 ? `${message.slice(0, 137)}…` : message;
  if (inMockMode()) {
    return mockResponse("agentphone.mock.sms.sent", { to, preview });
  }
  return liveResponse("agentphone.sms.sent", { to, preview });
}

export async function placeCall(
  to: string,
  script: string,
): Promise<AgentPhoneResponse<{ to: string; script_preview: string }>> {
  const preview = script.length > 140 ? `${script.slice(0, 137)}…` : script;
  if (inMockMode()) {
    return mockResponse("agentphone.mock.call.placed", {
      to,
      script_preview: preview,
    });
  }
  return liveResponse("agentphone.call.placed", { to, script_preview: preview });
}

export async function sendOwnerUpdate(
  message: string,
): Promise<AgentPhoneResponse<{ to: string; preview: string }>> {
  const to = process.env.OWNER_PHONE_NUMBER ?? "+15555550123";
  const preview = message.length > 140 ? `${message.slice(0, 137)}…` : message;
  if (inMockMode()) {
    return mockResponse("agentphone.mock.sms.owner_update.sent", {
      to,
      preview,
    });
  }
  return liveResponse("agentphone.sms.owner_update.sent", { to, preview });
}

export const agentphone = {
  getInboundCalls,
  getCallTranscript,
  getInboundSMS,
  sendSMS,
  placeCall,
  sendOwnerUpdate,
  inMockMode,
};

export function toMockExternalAction(
  resp: AgentPhoneResponse<unknown>,
  detail: string,
): MockExternalAction {
  return {
    name: resp.log,
    ok: resp.ok,
    ref: nanoid("ap"),
    detail,
  };
}
