"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  Customer,
  InboundMessage,
  MockExternalAction,
  ProcessResult,
} from "@/lib/types";
import {
  ChannelBadge,
  ClassificationBadge,
  DecisionBadge,
  StatusPill,
} from "@/components/Badges";

type ProcessState = {
  result: ProcessResult | null;
  loading: boolean;
  step:
    | "idle"
    | "classifying"
    | "policy"
    | "deciding"
    | "acting"
    | "notifying"
    | "done";
};

const STEP_ORDER: ProcessState["step"][] = [
  "classifying",
  "policy",
  "deciding",
  "acting",
  "notifying",
  "done",
];
const STEP_LABEL: Record<ProcessState["step"], string> = {
  idle: "Idle",
  classifying: "Classifying message",
  policy: "Checking policies",
  deciding: "Drafting decision",
  acting: "Executing actions",
  notifying: "Notifying owner",
  done: "Complete",
};

export function InboxClient() {
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resultsById, setResultsById] = useState<Record<string, ProcessResult>>(
    {},
  );
  const [stateById, setStateById] = useState<Record<string, ProcessState>>({});
  const [seeding, setSeeding] = useState(false);

  const refresh = async () => {
    const r = await fetch("/api/messages", { cache: "no-store" });
    const data = await r.json();
    setMessages(data.messages);
    setCustomers(data.customers);
    if (!selectedId && data.messages.length) {
      setSelectedId(data.messages[0].id);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId],
  );
  const selectedCustomer = useMemo(
    () =>
      selected ? customers.find((c) => c.id === selected.customer_id) : null,
    [selected, customers],
  );
  const selectedResult = selected ? resultsById[selected.id] : undefined;
  const selectedState = selected
    ? stateById[selected.id] ?? { result: null, loading: false, step: "idle" }
    : null;

  const runAI = async (messageId: string) => {
    setStateById((s) => ({
      ...s,
      [messageId]: { result: null, loading: true, step: "classifying" },
    }));

    // Visual step progression while the request runs.
    const fakeSteps: ProcessState["step"][] = [
      "classifying",
      "policy",
      "deciding",
      "acting",
      "notifying",
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = Math.min(idx + 1, fakeSteps.length - 1);
      setStateById((s) => ({
        ...s,
        [messageId]: {
          ...(s[messageId] ?? { result: null, loading: true, step: "classifying" }),
          step: fakeSteps[idx],
        },
      }));
    }, 480);

    try {
      const r = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, use_llm: true }),
      });
      const data = await r.json();
      clearInterval(interval);
      if (!r.ok) {
        setStateById((s) => ({
          ...s,
          [messageId]: { result: null, loading: false, step: "idle" },
        }));
        alert(data.error ?? "Failed to process");
        return;
      }
      const result: ProcessResult = data.result;
      setResultsById((s) => ({ ...s, [messageId]: result }));
      setStateById((s) => ({
        ...s,
        [messageId]: { result, loading: false, step: "done" },
      }));
      await refresh();
    } catch (e) {
      clearInterval(interval);
      setStateById((s) => ({
        ...s,
        [messageId]: { result: null, loading: false, step: "idle" },
      }));
    }
  };

  const reseed = async () => {
    setSeeding(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      setResultsById({});
      setStateById({});
      await refresh();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="label">Inbox</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Inbound requests
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            Pick a message, then <span className="text-ink-100">Run AI Manager</span> to
            classify, decide, and execute downstream actions.
          </p>
        </div>
        <button onClick={reseed} disabled={seeding} className="btn">
          {seeding ? "Resetting…" : "Reset demo data"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <ul className="card divide-y divide-ink-800/80 overflow-hidden">
          {messages.map((m) => {
            const c = customers.find((x) => x.id === m.customer_id);
            const isSelected = m.id === selectedId;
            return (
              <li key={m.id}>
                <button
                  onClick={() => setSelectedId(m.id)}
                  className={clsx(
                    "w-full px-4 py-3 text-left transition",
                    isSelected
                      ? "bg-ink-800/80"
                      : "hover:bg-ink-800/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {c?.name ?? m.customer_id}
                    </span>
                    <StatusPill status={m.status} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ChannelBadge value={m.channel} />
                    <span className="truncate text-xs text-ink-400">
                      {m.subject}
                    </span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs text-ink-300">
                    {m.body}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <section className="space-y-4">
          {selected && selectedCustomer ? (
            <>
              <div className="card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-300">
                      <span className="font-medium text-ink-100">
                        {selectedCustomer.name}
                      </span>
                      <span className="text-ink-500">·</span>
                      <span>{selectedCustomer.email}</span>
                      {selectedCustomer.vip && (
                        <span className="pill border-accent/40 bg-accent/10 text-accent">
                          VIP
                        </span>
                      )}
                      <ChannelBadge value={selected.channel} />
                    </div>
                    <h2 className="mt-1 text-xl font-semibold">
                      {selected.subject}
                    </h2>
                  </div>
                  <button
                    onClick={() => runAI(selected.id)}
                    disabled={selectedState?.loading}
                    className="btn-primary shine"
                  >
                    {selectedState?.loading ? "Running…" : "Run AI Manager"}
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 3l14 9-14 9V3z" />
                    </svg>
                  </button>
                </div>
                <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-ink-800 bg-ink-950/60 p-4 font-sans text-sm leading-relaxed text-ink-200">
                  {selected.body}
                </pre>
              </div>

              {selectedState && selectedState.step !== "idle" && (
                <StepStrip step={selectedState.step} loading={selectedState.loading} />
              )}

              {selectedResult && (
                <ResultPanel result={selectedResult} />
              )}
            </>
          ) : (
            <div className="card-tight text-sm text-ink-400">
              Select a message to begin.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StepStrip({
  step,
  loading,
}: {
  step: ProcessState["step"];
  loading: boolean;
}) {
  const activeIdx = STEP_ORDER.indexOf(step);
  return (
    <div className="card p-4">
      <div className="label mb-3 flex items-center gap-2">
        <span className={clsx("h-1.5 w-1.5 rounded-full", loading ? "bg-accent" : "bg-emerald-400")} />
        {loading ? "AI manager working" : "AI manager finished"}
      </div>
      <ol className="flex flex-wrap gap-2">
        {STEP_ORDER.slice(0, 5).map((s, i) => {
          const done = i < activeIdx || step === "done";
          const current = i === activeIdx && step !== "done";
          return (
            <li
              key={s}
              className={clsx(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
                done
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : current
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-ink-700 bg-ink-900 text-ink-400",
              )}
            >
              <span className="font-mono text-[10px] opacity-70">
                {String(i + 1).padStart(2, "0")}
              </span>
              {STEP_LABEL[s]}
              {current && (
                <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ResultPanel({ result }: { result: ProcessResult }) {
  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ClassificationBadge value={result.classification} />
          <DecisionBadge value={result.decision} />
          {result.llm_used ? (
            <span className="pill border-accent/40 bg-accent/10 text-accent">
              LLM-enhanced reply
            </span>
          ) : (
            <span className="pill border-ink-600 bg-ink-800 text-ink-200">
              Deterministic engine
            </span>
          )}
          {typeof result.revenue_delta === "number" && result.revenue_delta !== 0 && (
            <span
              className={clsx(
                "pill",
                result.revenue_delta > 0
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-200",
              )}
            >
              {result.revenue_delta > 0 ? "+" : "−"}$
              {Math.abs(result.revenue_delta).toFixed(2)}
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <div className="label">Reasoning summary</div>
            <p className="mt-1 text-sm text-ink-200">
              {result.reasoning_summary}
            </p>
            <div className="label mt-4">Policy applied</div>
            <p className="mt-1 text-sm text-ink-200">{result.policy_applied}</p>
          </div>
          <div>
            <div className="label">Owner summary</div>
            <p className="mt-1 text-sm text-ink-200">{result.owner_summary}</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="label mb-2">Drafted reply to customer</div>
        <pre className="whitespace-pre-wrap rounded-lg border border-ink-800 bg-ink-950/60 p-4 font-sans text-sm leading-relaxed text-ink-100">
          {result.customer_response}
        </pre>
      </div>

      <ActionsList actions={result.mock_external_actions} />
    </div>
  );
}

function ActionsList({ actions }: { actions: MockExternalAction[] }) {
  return (
    <div className="card p-6">
      <div className="label mb-3">External actions</div>
      <ul className="space-y-2">
        {actions.map((a, i) => (
          <li
            key={a.ref + i}
            className="flex items-start gap-3 rounded-lg border border-ink-800 bg-ink-950/60 px-3 py-2.5"
          >
            <span
              className={clsx(
                "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                a.ok
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-rose-500/15 text-rose-300",
              )}
            >
              {a.ok ? "✓" : "✕"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-100">{a.name}</span>
                <span className="font-mono text-[10px] text-ink-500">
                  {a.ref}
                </span>
              </div>
              {a.detail && (
                <div className="mt-0.5 truncate text-xs text-ink-400">
                  {a.detail}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
