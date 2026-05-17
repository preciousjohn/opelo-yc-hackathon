import clsx from "clsx";
import { Classification, Decision } from "@/lib/types";

const classMap: Record<Classification, { label: string; tone: string }> = {
  refund_request: { label: "Refund request", tone: "rose" },
  pricing_exception: { label: "Pricing exception", tone: "amber" },
  sponsorship_offer: { label: "Sponsorship", tone: "violet" },
  qualified_lead: { label: "Qualified lead", tone: "emerald" },
  scheduling_request: { label: "Scheduling", tone: "sky" },
  escalation: { label: "Escalation", tone: "red" },
};

const decisionMap: Record<Decision, { label: string; tone: string }> = {
  approve: { label: "Approved", tone: "emerald" },
  reject: { label: "Rejected", tone: "rose" },
  negotiate: { label: "Negotiated", tone: "amber" },
  schedule: { label: "Scheduled", tone: "sky" },
  escalate_to_owner: { label: "Owner notified", tone: "red" },
};

const tones: Record<string, string> = {
  rose: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  sky: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  red: "border-red-500/40 bg-red-500/10 text-red-200",
  ink: "border-ink-600 bg-ink-800 text-ink-200",
};

export function ClassificationBadge({ value }: { value: Classification }) {
  const v = classMap[value] ?? { label: value, tone: "ink" };
  return <span className={clsx("pill", tones[v.tone])}>{v.label}</span>;
}

export function DecisionBadge({ value }: { value: Decision }) {
  const v = decisionMap[value] ?? { label: value, tone: "ink" };
  return (
    <span className={clsx("pill", tones[v.tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {v.label}
    </span>
  );
}

export function StatusPill({
  status,
}: {
  status: "new" | "processing" | "handled";
}) {
  const tone =
    status === "new"
      ? "border-ink-600 bg-ink-800 text-ink-200"
      : status === "processing"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  return (
    <span className={clsx("pill", tone)}>
      {status === "new" ? "Awaiting AI" : status === "processing" ? "Working…" : "Handled"}
    </span>
  );
}
