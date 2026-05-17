import Link from "next/link";
import { store } from "@/lib/db/store";
import {
  ChannelBadge,
  ClassificationBadge,
  DecisionBadge,
} from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const [actions, customers, messages] = await Promise.all([
    store.listActions(),
    store.listCustomers(),
    store.listMessages(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="label">Audit log</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Every action your AI manager took
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            Each row is an immutable record of one inbound message, the policy
            applied, the decision, the reply sent, and the downstream actions.
          </p>
        </div>
        <Link href="/inbox" className="btn-primary">
          Process more
        </Link>
      </div>

      {actions.length === 0 ? (
        <div className="card-tight text-sm text-ink-400">
          No actions yet. Go to the{" "}
          <Link className="text-accent underline" href="/inbox">
            Inbox
          </Link>{" "}
          and run the AI manager on a message.
        </div>
      ) : (
        <ol className="space-y-4">
          {actions.map((a) => {
            const m = messages.find((x) => x.id === a.message_id);
            const c = customers.find((x) => x.id === a.customer_id);
            return (
              <li key={a.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <ClassificationBadge value={a.classification} />
                  <DecisionBadge value={a.decision} />
                  {m && <ChannelBadge value={m.channel} />}
                  {a.llm_used ? (
                    <span className="pill border-accent/40 bg-accent/10 text-accent">
                      LLM
                    </span>
                  ) : null}
                  <span className="ml-auto font-mono text-[11px] text-ink-500">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="label">Inbound</div>
                    <p className="mt-1 text-xs text-ink-400">
                      {c?.name} · {c?.email}
                    </p>
                    {m && (
                      <p className="mt-1 text-sm font-medium text-ink-100">
                        {m.subject}
                      </p>
                    )}
                    {m && (
                      <p className="mt-1 text-sm text-ink-300 whitespace-pre-wrap">
                        {m.body}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="label">Policy applied</div>
                    <p className="mt-1 text-sm text-ink-200">
                      {a.policy_applied}
                    </p>
                    <div className="label mt-3">Owner summary</div>
                    <p className="mt-1 text-sm text-ink-200">
                      {a.owner_summary}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="label">Response sent</div>
                  <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-ink-800 bg-ink-950/60 p-3 font-sans text-sm text-ink-100">
                    {a.customer_response}
                  </pre>
                </div>
                <div className="mt-4">
                  <div className="label">External actions</div>
                  <ul className="mt-1 space-y-1">
                    {a.mock_external_actions.map((act, i) => (
                      <li
                        key={act.ref + i}
                        className="flex items-start gap-2 text-xs text-ink-300"
                      >
                        <span
                          className={
                            act.ok ? "text-emerald-400" : "text-rose-400"
                          }
                        >
                          {act.ok ? "✓" : "✕"}
                        </span>
                        <span className="font-mono text-ink-100">
                          {act.name}
                        </span>
                        <span className="font-mono text-ink-500">
                          {act.ref}
                        </span>
                        {act.detail && (
                          <span className="text-ink-400">— {act.detail}</span>
                        )}
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
