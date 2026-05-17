import Link from "next/link";
import { store } from "@/lib/db/store";
import { ChannelBadge, ClassificationBadge, DecisionBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const [actions, customers, messages] = await Promise.all([
    store.listActions(), store.listCustomers(), store.listMessages(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="label">Audit log</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Every action your AI manager took
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Each row is an immutable record of one inbound message, the policy applied, the decision, the reply sent, and the downstream actions.
          </p>
        </div>
        <Link href="/inbox" className="btn-primary shrink-0">Process more</Link>
      </div>

      {actions.length === 0 ? (
        <div className="card p-6 text-sm text-stone-400">
          No actions yet. Go to the{" "}
          <Link className="font-medium text-stone-700 underline underline-offset-2" href="/inbox">Inbox</Link>{" "}
          and run the AI manager on a message.
        </div>
      ) : (
        <ol className="space-y-4">
          {actions.map((a) => {
            const m = messages.find((x) => x.id === a.message_id);
            const c = customers.find((x) => x.id === a.customer_id);
            return (
              <li key={a.id} className="card p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <ClassificationBadge value={a.classification} />
                  <DecisionBadge value={a.decision} />
                  {m && <ChannelBadge value={m.channel} />}
                  {a.llm_used && (
                    <span className="pill border-lime-200 bg-lime-50 text-lime-700">LLM</span>
                  )}
                  <span className="ml-auto font-mono text-[11px] text-stone-400">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="mt-4 grid gap-6 md:grid-cols-2">
                  <div>
                    <div className="label">Inbound</div>
                    <p className="mt-1.5 text-xs text-stone-400">{c?.name} · {c?.email}</p>
                    {m && <p className="mt-1 text-sm font-medium text-stone-900">{m.subject}</p>}
                    {m && <p className="mt-1 text-sm leading-relaxed text-stone-600 whitespace-pre-wrap">{m.body}</p>}
                  </div>
                  <div>
                    <div className="label">Policy applied</div>
                    <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{a.policy_applied}</p>
                    <div className="label mt-4">Owner summary</div>
                    <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{a.owner_summary}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="label mb-2">Response sent</div>
                  <pre className="whitespace-pre-wrap rounded-xl border border-stone-100 bg-stone-50 p-4 font-sans text-sm leading-relaxed text-stone-700">
                    {a.customer_response}
                  </pre>
                </div>

                <div className="mt-4">
                  <div className="label mb-2">External actions</div>
                  <ul className="space-y-1">
                    {a.mock_external_actions.map((act, i) => (
                      <li key={act.ref + i} className="flex items-start gap-2 text-xs">
                        <span className={act.ok ? "text-emerald-600" : "text-rose-600"}>{act.ok ? "✓" : "✕"}</span>
                        <span className="font-mono font-medium text-stone-800">{act.name}</span>
                        <span className="font-mono text-stone-400">{act.ref}</span>
                        {act.detail && <span className="text-stone-500">— {act.detail}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
