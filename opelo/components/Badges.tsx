import clsx from "clsx";
import { Channel, Classification, Decision } from "@/lib/types";

const classMap: Record<Classification, { label: string; tone: string }> = {
  refund_request:    { label: "Refund request",    tone: "rose"    },
  pricing_exception: { label: "Pricing exception", tone: "amber"   },
  sponsorship_offer: { label: "Sponsorship",       tone: "violet"  },
  qualified_lead:    { label: "Qualified lead",    tone: "emerald" },
  scheduling_request:{ label: "Scheduling",        tone: "sky"     },
  escalation:        { label: "Escalation",        tone: "red"     },
};

const decisionMap: Record<Decision, { label: string; tone: string }> = {
  approve:          { label: "Approved",       tone: "emerald" },
  reject:           { label: "Rejected",       tone: "rose"    },
  negotiate:        { label: "Negotiated",     tone: "amber"   },
  schedule:         { label: "Scheduled",      tone: "sky"     },
  escalate_to_owner:{ label: "Owner notified", tone: "red"     },
};

// Light-theme tones — readable on white/light backgrounds
const tones: Record<string, string> = {
  rose:    "border-rose-200    bg-rose-50    text-rose-700",
  amber:   "border-amber-200   bg-amber-50   text-amber-700",
  violet:  "border-violet-200  bg-violet-50  text-violet-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sky:     "border-sky-200     bg-sky-50     text-sky-700",
  red:     "border-red-200     bg-red-50     text-red-700",
  ink:     "border-stone-200   bg-stone-100  text-stone-600",
  lime:    "border-lime-200    bg-lime-50    text-lime-700",
};

export function ClassificationBadge({ value }: { value: Classification }) {
  const v = classMap[value] ?? { label: value, tone: "ink" };
  return <span className={clsx("pill", tones[v.tone])}>{v.label}</span>;
}

export function DecisionBadge({ value }: { value: Decision }) {
  const v = decisionMap[value] ?? { label: value, tone: "ink" };
  return (
    <span className={clsx("pill", tones[v.tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {v.label}
    </span>
  );
}

const channelMap: Record<Channel, { label: string; tone: string }> = {
  email:            { label: "Email",            tone: "ink"    },
  sms:              { label: "SMS · AgentPhone",  tone: "sky"    },
  form:             { label: "Form",             tone: "ink"    },
  phone_transcript: { label: "Call · AgentPhone", tone: "violet" },
  social_dm:        { label: "Social DM",        tone: "amber"  },
};

export function ChannelBadge({ value }: { value: Channel }) {
  const v = channelMap[value] ?? { label: value, tone: "ink" };
  return <span className={clsx("pill", tones[v.tone])}>{v.label}</span>;
}

export function StatusPill({ status }: { status: "new" | "processing" | "handled" }) {
  const tone =
    status === "new"
      ? "border-stone-200 bg-stone-100 text-stone-500"
      : status === "processing"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const label =
    status === "new" ? "Awaiting AI" : status === "processing" ? "Working…" : "Handled";
  return <span className={clsx("pill", tone)}>{label}</span>;
}
