import Link from "next/link";
import { store } from "@/lib/db/store";
import { ActionRecord, Customer, ActionType } from "@/lib/types";

export const dynamic = "force-dynamic";

// Plain-English helpers
function actionEmoji(t: ActionType): string {
  const map: Partial<Record<ActionType, string>> = {
    refund_issued: "✅", meeting_booked: "📅", owner_escalated: "🔔",
    sponsorship_countered: "💬", discount_offered: "💬", auto_reply_sent: "✉️",
    sponsorship_declined: "✖️", lead_nurtured: "🌱",
    deposit_requested: "💳", event_confirmed: "🎉", day_of_reminder_sent: "☕",
  };
  return map[t] ?? "⚡";
}

function actionBadge(t: ActionType): { label: string; cls: string } {
  const map: Partial<Record<ActionType, { label: string; cls: string }>> = {
    refund_issued:         { label: "REFUND APPROVED",   cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    meeting_booked:        { label: "MEETING BOOKED",    cls: "text-sky-700     bg-sky-50     border-sky-200"     },
    deposit_requested:     { label: "DEPOSIT SENT",      cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    event_confirmed:       { label: "EVENT CONFIRMED",   cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    day_of_reminder_sent:  { label: "REMINDER SENT",     cls: "text-sky-700     bg-sky-50     border-sky-200"     },
    owner_escalated:       { label: "NEEDS YOUR REVIEW", cls: "text-amber-700   bg-amber-50   border-amber-200"   },
    sponsorship_countered: { label: "COUNTER SENT",      cls: "text-violet-700  bg-violet-50  border-violet-200"  },
    discount_offered:      { label: "PRICE HELD",        cls: "text-blue-700    bg-blue-50    border-blue-200"    },
    auto_reply_sent:       { label: "REPLIED",           cls: "text-stone-700   bg-stone-100  border-stone-200"   },
  };
  return map[t] ?? { label: "HANDLED", cls: "text-stone-600 bg-stone-100 border-stone-200" };
}

function describeAction(a: ActionRecord, customers: Customer[]): string {
  const c = customers.find(x => x.id === a.customer_id);
  const first = c?.name?.split(" ")[0] ?? "A customer";
  const amt = a.revenue_delta ? `$${Math.abs(a.revenue_delta).toFixed(0)}` : "";
  const deposit = a.counter_offer ? `$${a.counter_offer.toFixed(0)}` : amt;
  switch (a.action_type) {
    case "refund_issued": return `${first} got a ${amt} refund processed`;
    case "meeting_booked": return `Sent ${first} availability to book an event`;
    case "deposit_requested": return `Sent ${first} a ${deposit} deposit link to hold their date`;
    case "event_confirmed": return `${first}'s event is confirmed on the calendar`;
    case "day_of_reminder_sent": return `Sent ${first} a day-of event reminder`;
    case "owner_escalated": return `${first}'s request needs your personal attention`;
    case "sponsorship_countered": return `Sent ${first} a counter-offer for their sponsorship`;
    case "discount_offered": return `Held your pricing floor with ${first}`;
    case "auto_reply_sent": return `Replied to ${first}'s message`;
    default: return `Handled ${first}'s request`;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function DashboardPage() {
  const [actions, customers, messages] = await Promise.all([
    store.listActions(), store.listCustomers(), store.listMessages(),
  ]);

  // Simple stats
  const totalHandled = actions.length;
  const moneySaved = actions.reduce((sum, a) => {
    if (a.action_type === "refund_issued") return sum + Math.abs(a.revenue_delta || 0);
    if (a.revenue_delta > 0) return sum + a.revenue_delta;
    return sum;
  }, 0);
  const deposits = actions.filter(a => a.action_type === "deposit_requested").length;
  const eventsConfirmed = actions.filter(a => a.action_type === "event_confirmed").length;
  const needsReview = actions.filter(a => a.action_type === "owner_escalated").length;

  const recent = actions.slice(0, 8);
  const pendingMessages = messages.filter(m => m.status === "new");

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Overview</h1>
          <p className="text-stone-400 text-sm mt-0.5">Here's what Opelo handled for you</p>
        </div>
        <Link href="/inbox" className="btn-primary">
          + New message
        </Link>
      </div>

      {/* Stat cards — Autosend style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { emoji: "📬", label: "Requests handled", value: String(totalHandled), sub: "total this session" },
          { emoji: "💰", label: "Money saved & earned", value: `$${moneySaved.toFixed(0)}`, sub: "refunds + new revenue" },
          { emoji: "💳", label: "Deposits sent", value: String(deposits), sub: `${eventsConfirmed} events confirmed` },
          { emoji: "🔔", label: "Need your review", value: String(needsReview), sub: "waiting on you", highlight: needsReview > 0 },
        ].map(card => (
          <div key={card.label} className={`rounded-2xl border p-5 bg-white ${card.highlight ? "border-amber-200" : "border-stone-100"}`}>
            <div className="text-2xl mb-3">{card.emoji}</div>
            <div className={`text-3xl font-semibold tracking-tight ${card.highlight ? "text-amber-600" : "text-stone-900"}`}>
              {card.value}
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 mt-1">{card.label}</div>
            <div className="text-xs text-stone-400 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Pending messages banner */}
      {pendingMessages.length > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-lime-200 bg-lime-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">📬</span>
            <div>
              <p className="text-sm font-semibold text-lime-800">
                {pendingMessages.length} new {pendingMessages.length === 1 ? "message" : "messages"} waiting
              </p>
              <p className="text-xs text-lime-600">Opelo hasn't handled these yet — go to Messages to run them.</p>
            </div>
          </div>
          <Link href="/inbox" className="rounded-full bg-lime-400 px-4 py-1.5 text-xs font-semibold text-stone-900 transition hover:bg-lime-300">
            Open Messages →
          </Link>
        </div>
      )}

      {/* Activity section — Autosend campaign list style */}
      <div className="mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400 mb-4">
          📋 Recent activity
        </h2>

        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center">
            <div className="text-4xl mb-3">🤖</div>
            <p className="font-semibold text-stone-700">Opelo hasn't handled anything yet</p>
            <p className="text-sm text-stone-400 mt-1">Go to Messages and run Opelo on your first request.</p>
            <Link href="/inbox" className="mt-4 inline-flex btn-primary">Go to Messages →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map(a => {
              const c = customers.find(x => x.id === a.customer_id);
              const m = messages.find(x => x.id === a.message_id);
              const badge = actionBadge(a.action_type);
              return (
                <div key={a.id} className="rounded-2xl border border-stone-100 bg-white px-6 py-4">
                  {/* Row 1: badge + name + time */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{actionEmoji(a.action_type)}</span>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${badge.cls}`}>
                        {badge.label}
                      </span>
                      <span className="text-sm font-semibold text-stone-800">
                        {c?.name ?? "Unknown"}
                      </span>
                    </div>
                    <span className="text-xs text-stone-400">{timeAgo(a.created_at)}</span>
                  </div>

                  {/* Row 2: plain description */}
                  <p className="text-sm text-stone-600 pl-10">{describeAction(a, customers)}</p>

                  {/* Row 3: message subject if available */}
                  {m && (
                    <p className="text-xs text-stone-400 pl-10 mt-1 truncate">Re: {m.subject}</p>
                  )}

                  {/* Row 4: mini stats */}
                  <div className="mt-3 pl-10 flex items-center gap-6">
                    {a.revenue_delta !== 0 && (
                      <Stat label="Revenue impact" value={`${a.revenue_delta > 0 ? "+" : "−"}$${Math.abs(a.revenue_delta).toFixed(0)}`} color={a.revenue_delta > 0 ? "emerald" : "rose"} />
                    )}
                    <Stat label="Decision" value={a.decision.replace("_", " ")} />
                    {a.llm_used && <Stat label="AI enhanced" value="✓" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      {actions.length > 0 && (
        <div className="mt-6 text-center">
          <Link href="/logs" className="text-sm text-stone-400 hover:text-stone-600 transition">
            View full activity history →
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "stone" }: { label: string; value: string; color?: string }) {
  const cls = color === "emerald" ? "text-emerald-700" : color === "rose" ? "text-rose-600" : "text-stone-600";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-stone-400">{label}</div>
      <div className={`text-xs font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
