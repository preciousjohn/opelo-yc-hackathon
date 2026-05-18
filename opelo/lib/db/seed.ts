import {
  ActionRecord,
  CompanyWallet,
  Customer,
  InboundMessage,
  Policies,
} from "../types";

export function defaultPolicies(): Policies {
  return {
    refund_auto_approve_under: 100,
    min_sponsorship_price: 2000,
    min_project_price: 800,
    vip_customers: ["founder@bigcorp.com"],
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
      "frustrated",
    ],
    booking_availability:
      "Available Mon–Sat. Events require 48hr notice and a deposit to confirm the date.",
    auto_book_lead_above: 1200,
  };
}

export function seedCustomers(): Customer[] {
  const now = new Date().toISOString();
  return [
    {
      id: "cus_seed_jessica",
      name: "Jessica Park",
      email: "jessica@example.com",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 800,
      created_at: now,
    },
    {
      id: "cus_seed_techco",
      name: "TechCo Events",
      email: "events@techco.com",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 0,
      created_at: now,
    },
    {
      id: "cus_seed_sarah",
      name: "Sarah Chen",
      email: "sarah@example.com",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 0,
      created_at: now,
    },
    {
      id: "cus_seed_james",
      name: "James Okafor",
      email: "james@example.com",
      phone: "+14155550192",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 0,
      created_at: now,
    },
  ];
}

export function seedMessages(): InboundMessage[] {
  const base = Date.now();
  const earlier = (mins: number) =>
    new Date(base - mins * 60 * 1000).toISOString();
  return [
    {
      id: "msg_seed_graduation",
      customer_id: "cus_seed_jessica",
      channel: "email",
      subject: "Coffee cart for graduation party — June 12",
      body: "Hi! We're planning a graduation party on June 12 for around 80 guests and would love to have a coffee cart. Budget is around $800. Do you have availability?",
      received_at: earlier(112),
      status: "handled",
      amount_hint: 800,
    },
    {
      id: "msg_seed_corporate",
      customer_id: "cus_seed_techco",
      channel: "sms",
      subject: "Corporate event inquiry",
      body: "Hey, we're looking for a coffee cart for our company offsite on May 30. Around 50 people. What do you charge?",
      received_at: earlier(54),
      status: "handled",
    },
    {
      id: "msg_new_sarah",
      customer_id: "cus_seed_sarah",
      channel: "email",
      subject: "Birthday party coffee cart",
      body: "Hi! I'm planning a birthday party for my daughter on June 7th, around 40 guests, backyard in Palo Alto. Would love a coffee cart setup for 3 hours. Budget is flexible around $600-700. Do you do oat milk and lavender lattes?",
      received_at: earlier(8),
      status: "new",
      amount_hint: 650,
    },
    {
      id: "msg_new_sms",
      customer_id: "cus_seed_james",
      channel: "sms",
      subject: "Inbound SMS",
      body: "Hi, do you do corporate events? We have about 120 people and need coverage for a full day in SF next Friday. Budget is around $1400.",
      received_at: earlier(2),
      status: "new",
      amount_hint: 1400,
    },
  ];
}

export function seedActions(): ActionRecord[] {
  const base = Date.now();
  const earlier = (mins: number) =>
    new Date(base - mins * 60 * 1000).toISOString();
  return [
    {
      id: "act_seed_graduation",
      message_id: "msg_seed_graduation",
      customer_id: "cus_seed_jessica",
      classification: "event_inquiry",
      decision: "approve",
      policy_applied: "Collect event details and send deposit link to hold the date",
      reasoning_summary:
        "Graduation party for ~80 guests — sent deposit link to hold June 12.",
      customer_response:
        "Thanks so much for reaching out, Jessica — we'd love to bring the cart to your graduation party! For ~80 guests on June 12, our half-day package ($800) is the right fit. I've sent a deposit link to hold your date; once that's in, I'll confirm setup time and any drink customizations.\n\nBest,\nHanadi\nFounder",
      owner_summary:
        "New event inquiry from Jessica Park — graduation party June 12, ~80 guests. Deposit link sent.",
      action_type: "deposit_requested",
      mock_external_actions: [
        {
          name: "sponge.payment_link.created",
          ok: true,
          ref: "plink_seed_jessica",
          detail:
            "Payment link for $800 → https://wallet.paysponge.com/pay/pl_seed_jessica",
        },
        {
          name: "agentmail.reply",
          ok: true,
          ref: "am_seed_jessica",
          detail:
            "Replied to jessica@example.com — 'Re: Coffee cart for graduation party — June 12'.",
        },
        {
          name: "agentphone.sms.owner_update.sent",
          ok: true,
          ref: "ap_seed_owner_grad",
          detail:
            "SMS to owner: Opelo: New event inquiry from Jessica Park — graduation party June 12, ~80 guests. Deposit link sent.",
        },
        {
          name: "memory.decision.saved",
          ok: true,
          ref: "mem_seed_graduation",
          detail: "Saved decision to nood coffee memory.",
        },
      ],
      revenue_delta: 0,
      counter_offer: 800,
      llm_used: false,
      created_at: earlier(110),
    },
    {
      id: "act_seed_corporate",
      message_id: "msg_seed_corporate",
      customer_id: "cus_seed_techco",
      classification: "event_inquiry",
      decision: "schedule",
      policy_applied: "Collect event details and send deposit link to hold the date",
      reasoning_summary:
        "Corporate offsite inquiry — asked for guest count, date, and budget before sending a deposit link.",
      customer_response:
        "Thanks for reaching out — we'd love to be at your offsite! To get May 30 on the calendar, could you share the venue address, setup time, approximate guest count, and your target budget? I'll follow up with next steps and a deposit link to hold the date.\n\n— Hanadi, Founder",
      owner_summary:
        "New event inquiry from TechCo Events — corporate offsite May 30, ~50 people. Opelo asked for event details.",
      action_type: "auto_reply_sent",
      mock_external_actions: [
        {
          name: "agentphone.sms.sent",
          ok: true,
          ref: "ap_seed_techco",
          detail: "SMS to events@techco.com — corporate event inquiry reply.",
        },
        {
          name: "memory.decision.saved",
          ok: true,
          ref: "mem_seed_corporate",
          detail: "Saved decision to nood coffee memory.",
        },
      ],
      revenue_delta: 0,
      llm_used: false,
      created_at: earlier(52),
    },
  ];
}

export function seedWallet(): CompanyWallet {
  return {
    available_cents: 842_300,
    pending_cents: 80_000,
    refunded_today_cents: 0,
    revenue_generated_today_cents: 80000,
    currency: "USD",
    updated_at: new Date().toISOString(),
  };
}

export function seedPendingInbound(): InboundMessage[] {
  return [];
}
