import Link from "next/link";
import { store } from "@/lib/db/store";
import {
  ActionRecord,
  Channel,
  Customer,
  InboundMessage,
} from "@/lib/types";
import {
  ChannelBadge,
  ClassificationBadge,
  DecisionBadge,
  StatusPill,
} from "@/components/Badges";
import { demoBusiness } from "@/lib/business";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [actions, messages, customers] = await Promise.all([
    store.listActions(),
    store.listMessages(),
    store.listCustomers(),
  ]);
  const stats = computeStats(actions);
  const recentMessages = messages.slice(0, 5);
  const recentActions = actions.slice(0, 6);
  const byChannel = countByChannel(messages);
  const externalActionRollup = rollupExternalActions(actions);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="label">Owner dashboard · {demoBusiness.name}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            What your AI manager did this week
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {stats.totalActions === 0
              ? "No actions yet — head to the Inbox and run the AI manager on a message."
              : `Across ${stats.totalActions} inbound request${stats.totalActions === 1 ? "" : "s"}, here's the impact.`}
          </p>
        </div>
        <Link href="/inbox" className="btn-primary">
          Open Inbox
        </Link>
      </div>

      <OwnerSummaryCard stats={stats} actions={actions} customers={customers} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Revenue protected / generated"
          value={`$${stats.revenueImpact.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          tone="emerald"
          hint={`Refunds: $${stats.refundsTotal.toFixed(0)} · New: $${stats.revenueGenerated.toFixed(0)}`}
        />
        <Stat
          label="Refunds via Sponge (approved / held)"
          value={`${stats.refundsApproved} / ${stats.refundsEscalated}`}
          tone="rose"
          hint="Auto-approved vs. owner-reviewed"
        />
        <Stat
          label="Meetings booked"
          value={String(stats.meetingsBooked)}
          tone="sky"
          hint="From qualified leads + scheduling"
        />
        <Stat
          label="Owner updates via AgentPhone"
          value={String(stats.escalations)}
          tone="amber"
          hint="SMS sent to your phone"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="border-b border-ink-800 px-5 py-3 flex items-center justify-between">
            <div className="label">Inbound by channel</div>
            <span className="text-xs text-ink-500">last {messages.length}</span>
          </div>
          <ul className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
            {(Object.keys(byChannel) as Channel[]).map((ch) => (
              <li
                key={ch}
                className="rounded-lg border border-ink-800 bg-ink-950/40 p-3"
              >
                <div className="flex items-center justify-between">
                  <ChannelBadge value={ch} />
                  <span className="text-lg font-semibold text-ink-100">
                    {byChannel[ch]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="border-b border-ink-800 px-5 py-3">
            <div className="label">External actions executed</div>
          </div>
          <ul className="divide-y divide-ink-800/80">
            {externalActionRollup.length === 0 && (
              <li className="px-5 py-4 text-sm text-ink-400">
                Nothing yet — run a message to populate.
              </li>
            )}
            {externalActionRollup.map((row) => (
              <li
                key={row.name}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs text-ink-100">
                    {row.name}
                  </div>
                  <div className="text-xs text-ink-500">
                    {row.providerLabel}
                  </div>
                </div>
                <span className="pill border-ink-600 bg-ink-800 text-ink-100">
                  ×{row.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="border-b border-ink-800 px-5 py-3">
            <div className="label">Recent inbound requests</div>
          </div>
          <ul className="divide-y divide-ink-800/80">
            {recentMessages.length === 0 && (
              <li className="px-5 py-4 text-sm text-ink-400">No messages.</li>
            )}
            {recentMessages.map((m) => {
              const c = customers.find((x) => x.id === m.customer_id);
              return (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{c?.name}</span>
                      <ChannelBadge value={m.channel} />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-400">
                      {m.subject}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-ink-300">
                      {m.body}
                    </p>
                  </div>
                  <StatusPill status={m.status} />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card">
          <div className="border-b border-ink-800 px-5 py-3">
            <div className="label">Recent AI decisions</div>
          </div>
          <ul className="divide-y divide-ink-800/80">
            {recentActions.length === 0 && (
              <li className="px-5 py-4 text-sm text-ink-400">
                Nothing yet — run a message through the AI manager to populate this.
              </li>
            )}
            {recentActions.map((a) => {
              const m = messages.find((x) => x.id === a.message_id);
              const c = customers.find((x) => x.id === a.customer_id);
              return (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClassificationBadge value={a.classification} />
                    <DecisionBadge value={a.decision} />
                    <span className="text-xs text-ink-400">{c?.name}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-ink-200">
                    {a.owner_summary}
                  </p>
                  {m && (
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      Re: {m.subject}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function OwnerSummaryCard({
  stats,
  actions,
  customers,
}: {
  stats: Stats;
  actions: ActionRecord[];
  customers: Customer[];
}) {
  if (stats.totalActions === 0) {
    return (
      <div className="card p-6">
        <div className="label">Daily summary</div>
        <p className="mt-2 text-lg text-ink-200">
          Your AI manager is on standby. The Inbox has demo requests ready —
          run the pipeline to see how Opelo handles each one.
        </p>
      </div>
    );
  }
  const summary = buildOwnerSummary(stats, actions, customers);
  return (
    <div className="card relative overflow-hidden p-6">
      <div className="absolute inset-x-0 -top-24 -z-0 mx-auto h-48 max-w-md rounded-full bg-accent/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="pill border-accent/30 bg-accent/10 text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Owner summary
          </span>
          <span className="text-xs text-ink-500">
            Generated for {new Date().toLocaleDateString()}
          </span>
        </div>
        <p className="mt-3 text-lg leading-relaxed text-ink-100">{summary}</p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "emerald" | "rose" | "sky" | "amber";
}) {
  const ring: Record<typeof tone, string> = {
    emerald: "from-emerald-500/20 to-transparent",
    rose: "from-rose-500/20 to-transparent",
    sky: "from-sky-500/20 to-transparent",
    amber: "from-amber-500/20 to-transparent",
  };
  return (
    <div className="card relative overflow-hidden p-5">
      <div
        className={`pointer-events-none absolute inset-0 -z-0 bg-gradient-to-br ${ring[tone]}`}
      />
      <div className="relative">
        <div className="label">{label}</div>
        <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 text-xs text-ink-400">{hint}</div>
      </div>
    </div>
  );
}

interface Stats {
  totalActions: number;
  refundsApproved: number;
  refundsEscalated: number;
  refundsTotal: number;
  revenueGenerated: number;
  revenueImpact: number;
  meetingsBooked: number;
  escalations: number;
  negotiations: number;
}

function computeStats(actions: ActionRecord[]): Stats {
  let refundsApproved = 0;
  let refundsEscalated = 0;
  let refundsTotal = 0;
  let revenueGenerated = 0;
  let meetingsBooked = 0;
  let escalations = 0;
  let negotiations = 0;
  for (const a of actions) {
    if (a.classification === "refund_request") {
      if (a.action_type === "refund_issued") {
        refundsApproved += 1;
        refundsTotal += Math.abs(a.revenue_delta || 0);
      } else if (a.action_type === "owner_escalated") {
        refundsEscalated += 1;
      }
    }
    if (a.action_type === "meeting_booked") meetingsBooked += 1;
    if (a.action_type === "owner_escalated") escalations += 1;
    if (a.decision === "negotiate") negotiations += 1;
    if (a.revenue_delta > 0) revenueGenerated += a.revenue_delta;
  }
  return {
    totalActions: actions.length,
    refundsApproved,
    refundsEscalated,
    refundsTotal,
    revenueGenerated,
    revenueImpact: revenueGenerated - refundsTotal,
    meetingsBooked,
    escalations,
    negotiations,
  };
}

function buildOwnerSummary(
  stats: Stats,
  actions: ActionRecord[],
  customers: Customer[],
): string {
  const parts: string[] = [];
  if (stats.refundsApproved > 0)
    parts.push(
      `auto-approved ${stats.refundsApproved} refund${stats.refundsApproved === 1 ? "" : "s"} totaling $${stats.refundsTotal.toFixed(0)}`,
    );
  if (stats.refundsEscalated > 0)
    parts.push(
      `held ${stats.refundsEscalated} refund${stats.refundsEscalated === 1 ? "" : "s"} for your review`,
    );
  if (stats.negotiations > 0)
    parts.push(
      `negotiated ${stats.negotiations} below-floor offer${stats.negotiations === 1 ? "" : "s"}`,
    );
  if (stats.meetingsBooked > 0)
    parts.push(
      `booked ${stats.meetingsBooked} meeting${stats.meetingsBooked === 1 ? "" : "s"}`,
    );
  if (stats.escalations > 0)
    parts.push(
      `sent ${stats.escalations} item${stats.escalations === 1 ? "" : "s"} to your phone`,
    );

  const tail =
    stats.revenueGenerated > 0
      ? ` Net new revenue routed to you: $${stats.revenueGenerated.toLocaleString(undefined, { maximumFractionDigits: 0 })}.`
      : "";
  const head =
    parts.length === 0
      ? "Your AI manager handled inbound traffic without changes to revenue."
      : `Today I ${joinList(parts)}.`;
  return head + tail;
}

function countByChannel(messages: InboundMessage[]): Record<Channel, number> {
  const out: Record<Channel, number> = {
    email: 0,
    sms: 0,
    form: 0,
    phone_transcript: 0,
    social_dm: 0,
  };
  for (const m of messages) out[m.channel] = (out[m.channel] ?? 0) + 1;
  return out;
}

function rollupExternalActions(
  actions: ActionRecord[],
): { name: string; count: number; providerLabel: string }[] {
  const counts = new Map<string, number>();
  for (const a of actions) {
    for (const act of a.mock_external_actions) {
      counts.set(act.name, (counts.get(act.name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      providerLabel: providerLabelFor(name),
    }));
}

function providerLabelFor(name: string): string {
  if (name.startsWith("sponge")) return "Sponge · payments";
  if (name.startsWith("agentphone")) return "AgentPhone · SMS / calls";
  if (name.startsWith("agentmail")) return "AgentMail · email";
  if (name.startsWith("google_calendar")) return "Google Calendar";
  return "Integration";
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return parts.join(" and ");
  return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
}
