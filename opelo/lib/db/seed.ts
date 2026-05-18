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
      "Weekends and Fri–Sun, 8am–2pm. 2-week lead time for events over 50 guests.",
    auto_book_lead_above: 1200,
  };
}

export function seedCustomers(): Customer[] {
  const now = new Date().toISOString();
  return [
    {
      id: "cus_jamie",
      name: "Jamie Chen",
      email: "jamie.chen@gmail.com",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 0,
      created_at: now,
    },
    {
      id: "cus_oakwave",
      name: "OakWave Snacks",
      email: "partnerships@oakwave.io",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 0,
      created_at: now,
    },
    {
      id: "cus_marcus",
      name: "Marcus Webb",
      email: "marcus@riversidecorp.com",
      phone: "+15555550188",
      vip: false,
      prior_refunds: 0,
      lifetime_value: 0,
      created_at: now,
    },
    {
      id: "cus_sofia",
      name: "Sofia Ruiz",
      email: "sofia@parkviewhoa.org",
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
      id: "msg_seed_event_handled",
      customer_id: "cus_jamie",
      channel: "email",
      subject: "Graduation party — June 12",
      body: "Hi! Loved your cart at my friend's wedding last month. Can I book you for a graduation party on June 12? We're expecting about 80 people in our backyard in Palo Alto.",
      received_at: earlier(112),
      status: "handled",
      amount_hint: 800,
    },
    {
      id: "msg_seed_sponsor_handled",
      customer_id: "cus_oakwave",
      channel: "email",
      subject: "Brand activation — farmers market booth",
      body: "Hi Hanadi! We'd love to sponsor a nood coffee pop-up at our farmers market series for $500. 4-hour slot, logo on the cart, social shoutout.",
      received_at: earlier(54),
      status: "handled",
      amount_hint: 500,
    },
    {
      id: "msg_corp_event_001",
      customer_id: "cus_marcus",
      channel: "email",
      subject: "Corporate offsite — coffee cart for 120",
      body: "Hi, we're planning a team offsite in September and need a coffee cart for ~120 employees. Budget is around $1,400 for a full day. Are you available Sept 18 in SF?",
      received_at: earlier(8),
      status: "new",
      amount_hint: 1400,
    },
    {
      id: "msg_hoa_event_002",
      customer_id: "cus_sofia",
      channel: "sms",
      subject: "Community block party",
      body: "Hey! Our HOA is hosting a block party July 4th — maybe 60 families. Do you do coffee carts for neighborhood events? What would pricing look like?",
      received_at: earlier(2),
      status: "new",
    },
  ];
}

export function seedActions(): ActionRecord[] {
  const base = Date.now();
  const earlier = (mins: number) =>
    new Date(base - mins * 60 * 1000).toISOString();
  return [
    {
      id: "act_seed_event",
      message_id: "msg_seed_event_handled",
      customer_id: "cus_jamie",
      classification: "event_inquiry",
      decision: "approve",
      policy_applied:
        "Qualify event leads, collect details, request deposit to confirm",
      reasoning_summary:
        "Graduation party for ~80 guests — sent deposit link to hold June 12.",
      customer_response:
        "Thanks so much for reaching out, Jamie — we'd love to be at your graduation party! For ~80 guests on June 12, our half-day package ($800) is usually the right fit. I've sent a deposit link to hold your date; once that's in, I'll confirm setup time and any custom drink requests.\n\nBest,\nHanadi\nFounder",
      owner_summary:
        "New event inquiry from Jamie Chen — graduation party June 12, ~80 guests. Deposit link sent.",
      action_type: "deposit_requested",
      mock_external_actions: [
        {
          name: "sponge.payment_link.created",
          ok: true,
          ref: "plink_seed_jamie",
          detail:
            "Payment link for $800 → https://wallet.paysponge.com/pay/pl_seed_jamie",
        },
        {
          name: "agentmail.reply",
          ok: true,
          ref: "am_seed_jamie",
          detail:
            "Replied to jamie.chen@gmail.com — 'Re: Graduation party — June 12'.",
        },
        {
          name: "agentphone.mock.sms.owner_update.sent",
          ok: true,
          ref: "ap_seed_owner_event",
          detail:
            "SMS to owner: Opelo: New event inquiry from Jamie Chen — graduation party June 12, ~80 guests. Deposit link sent.",
        },
        {
          name: "supabase.decision.saved",
          ok: true,
          ref: "mem_seed_event",
          detail: "Saved decision to nood coffee memory.",
        },
      ],
      revenue_delta: 0,
      counter_offer: 800,
      llm_used: false,
      created_at: earlier(110),
    },
    {
      id: "act_seed_sponsor",
      message_id: "msg_seed_sponsor_handled",
      customer_id: "cus_oakwave",
      classification: "sponsorship_offer",
      decision: "negotiate",
      policy_applied: "Reject sponsorships under $2000; counter to floor",
      reasoning_summary:
        "OakWave's $500 offer was below your $2,000 floor — countered at the floor.",
      customer_response:
        "Thanks so much for reaching out — love OakWave! A farmers-market pop-up with logo and social typically lands at $2,000 for a 4-hour slot. Happy to lock that in if it works.\n\nBest,\nHanadi\nFounder",
      owner_summary: "Countered a $500 sponsorship to your $2,000 floor.",
      action_type: "sponsorship_countered",
      mock_external_actions: [
        {
          name: "sponge.payment_link.created",
          ok: true,
          ref: "plink_seed_oakwave",
          detail:
            "Payment link for $2,000 → https://wallet.paysponge.com/pay/pl_seed_oakwave",
        },
        {
          name: "agentmail.reply",
          ok: true,
          ref: "am_seed_oakwave",
          detail:
            "Replied to partnerships@oakwave.io — 'Re: Brand activation — farmers market booth'.",
        },
        {
          name: "agentphone.mock.sms.owner_update.sent",
          ok: true,
          ref: "ap_seed_owner_sponsor",
          detail:
            "SMS to owner: Opelo: Countered a $500 sponsorship to your $2,000 floor.",
        },
        {
          name: "supabase.decision.saved",
          ok: true,
          ref: "mem_seed_sponsor",
          detail: "Saved decision to nood coffee memory.",
        },
      ],
      revenue_delta: 0,
      counter_offer: 2000,
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
