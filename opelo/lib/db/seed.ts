import { Customer, InboundMessage, Policies } from "../types";

export function defaultPolicies(): Policies {
  return {
    refund_auto_approve_under: 100,
    min_sponsorship_price: 2000,
    min_project_price: 2500,
    vip_customers: ["acme@vip.co"],
    escalation_keywords: [
      "ridiculous",
      "lawyer",
      "lawsuit",
      "chargeback",
      "scam",
      "refund now",
      "unacceptable",
      "third time",
      "three times",
      "messaged three times",
      "nobody has answered",
    ],
    booking_availability:
      "Tuesdays and Thursdays, 10am–4pm PT. 30-min intro or 60-min working session.",
    auto_book_lead_above: 5000,
  };
}

export function seedCustomers(): Customer[] {
  const now = new Date().toISOString();
  return [
    {
      id: "cus_jordan",
      name: "Jordan Pierce",
      email: "jordan@buyer.com",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 82,
      created_at: now,
    },
    {
      id: "cus_riya",
      name: "Riya Mehta",
      email: "riya@startupco.io",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 0,
      created_at: now,
    },
    {
      id: "cus_drift",
      name: "Drift Energy (Mara)",
      email: "mara@driftenergy.com",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 0,
      created_at: now,
    },
    {
      id: "cus_kai",
      name: "Kai Whitfield",
      email: "kai@northbrand.com",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 0,
      created_at: now,
    },
    {
      id: "cus_dana",
      name: "Dana Holt",
      email: "dana@somewhere.net",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 240,
      created_at: now,
    },
  ];
}

export function seedMessages(): InboundMessage[] {
  const base = Date.now();
  const mk = (i: number) => new Date(base - i * 1000 * 60 * 17).toISOString();
  return [
    {
      id: "msg_refund_001",
      customer_id: "cus_jordan",
      channel: "email",
      subject: "Refund request for creator course",
      body: "Hey, I bought your creator course yesterday but it wasn't what I expected. Can I get a refund? It was $82.",
      received_at: mk(0),
      status: "new",
      amount_hint: 82,
    },
    {
      id: "msg_pricing_002",
      customer_id: "cus_riya",
      channel: "sms",
      subject: "SMS via AgentPhone — budget question",
      body: "I want your consulting package but my budget is $1,500. Can you do that instead of $3,000?",
      received_at: mk(1),
      status: "new",
      amount_hint: 1500,
    },
    {
      id: "msg_sponsor_003",
      customer_id: "cus_drift",
      channel: "email",
      subject: "Sponsorship offer for next video",
      body: "Hi, we'd love to sponsor your next video for $750. We need 60 seconds integrated and 3 TikTok posts.",
      received_at: mk(2),
      status: "new",
      amount_hint: 750,
    },
    {
      id: "msg_lead_004",
      customer_id: "cus_kai",
      channel: "phone_transcript",
      subject: "Phone call transcript — AI workflow build",
      body: "Hi, I run a fast-growing DTC brand and need help building an AI customer support workflow. Budget is around $8k. Are you available next week?",
      received_at: mk(3),
      status: "new",
      amount_hint: 8000,
    },
    {
      id: "msg_escalate_005",
      customer_id: "cus_dana",
      channel: "social_dm",
      subject: "Instagram DM — repeated complaint",
      body: "I've messaged three times and nobody has answered. This is ridiculous.",
      received_at: mk(4),
      status: "new",
      amount_hint: null,
    },
  ];
}
