"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  ActionRecord,
  Channel,
  Customer,
  InboundMessage,
  MockExternalAction,
  Policies,
  ProcessResult,
} from "@/lib/types";
import { DEFAULT_MANAGER_NAME, demoBusiness } from "@/lib/business";
import { BookingsBoard } from "@/components/BookingsBoard";

type PipelineStep =
  | "idle"
  | "classifying"
  | "policy"
  | "deciding"
  | "acting"
  | "notifying"
  | "done";

const TIMELINE: { id: PipelineStep; label: string }[] = [
  { id: "classifying", label: "Classified request" },
  { id: "policy", label: "Checked business policy" },
  { id: "deciding", label: "Made decision" },
  { id: "acting", label: "Took action" },
  { id: "notifying", label: "Updated owner" },
];

const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  sms: "SMS",
  phone_transcript: "Phone",
  social_dm: "Social DM",
  form: "Form",
};

const CHANNEL_TONE: Record<Channel, string> = {
  email: "border-ink-700 bg-ink-800 text-ink-200",
  sms: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  phone_transcript: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  social_dm: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  form: "border-ink-700 bg-ink-800 text-ink-200",
};

const DECISION_LABEL: Record<string, string> = {
  approve: "Approved",
  reject: "Rejected",
  negotiate: "Counter-offered",
  schedule: "Booked",
  escalate_to_owner: "Owner notified",
};

const ACTION_TYPE_LABEL: Record<string, string> = {
  deposit_requested: "Deposit sent",
  event_confirmed: "Event confirmed",
  day_of_reminder_sent: "Reminder sent",
};

export function Cockpit() {
  const [managerName, setManagerName] = useState<string>(DEFAULT_MANAGER_NAME);
  const [messages, setMessages] = useState<InboundMessage[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [policies, setPolicies] = useState<Policies | null>(null);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<ProcessResult | null>(null);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [working, setWorking] = useState(false);
  const [llmProvider, setLlmProvider] = useState<string | null>(null);
  const [llmModel, setLlmModel] = useState<string | null>(null);

  // Load manager name from localStorage.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("opelo.managerName");
      if (saved) setManagerName(saved);
    } catch {
      // ignore
    }
  }, []);

  // Persist manager name.
  useEffect(() => {
    try {
      window.localStorage.setItem("opelo.managerName", managerName);
    } catch {
      // ignore
    }
  }, [managerName]);

  const fetchAll = useCallback(async () => {
    const [msgRes, polRes, actRes, statusRes] = await Promise.all([
      fetch("/api/messages", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/policies", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/actions", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/status", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null),
    ]);
    setMessages(msgRes.messages ?? []);
    setCustomers(msgRes.customers ?? []);
    setPolicies(polRes);
    setActions(actRes.actions ?? []);
    if (statusRes?.llm) {
      setLlmProvider(statusRes.llm.provider);
      setLlmModel(statusRes.llm.model);
    }
    if (!selectedId && (msgRes.messages ?? []).length) {
      const firstNew =
        (msgRes.messages as InboundMessage[]).find((m) => m.status === "new") ??
        msgRes.messages[0];
      setSelectedId(firstNew.id);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchAll();
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

  const runManager = async (messageId: string) => {
    if (working) return;
    setWorking(true);
    setActiveResult(null);
    setPipelineStep("classifying");

    const seq: PipelineStep[] = [
      "classifying",
      "policy",
      "deciding",
      "acting",
      "notifying",
    ];
    let i = 0;
    const tick = setInterval(() => {
      i = Math.min(i + 1, seq.length - 1);
      setPipelineStep(seq[i]);
    }, 520);

    try {
      const r = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message_id: messageId,
          use_llm: true,
          manager_name: managerName,
        }),
      });
      const data = await r.json();
      clearInterval(tick);
      if (!r.ok) {
        setPipelineStep("idle");
        setWorking(false);
        alert(data.error ?? "Failed to process");
        return;
      }
      setActiveResult(data.result as ProcessResult);
      setPipelineStep("done");
      await fetchAll();
    } catch {
      clearInterval(tick);
      setPipelineStep("idle");
    } finally {
      setWorking(false);
    }
  };

  const onSelectMessage = (id: string) => {
    setSelectedId(id);
    setActiveResult(null);
    setPipelineStep("idle");
  };

  const reseed = async () => {
    await fetch("/api/seed", { method: "POST" });
    setActiveResult(null);
    setPipelineStep("idle");
    setSelectedId(null);
    await fetchAll();
  };

  const updatePolicies = async (next: Policies) => {
    setPolicies(next);
    await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  };

  const stats = useMemo(() => computeStats(actions), [actions]);

  return (
    <div className="space-y-6">
      <TopBar
        managerName={managerName}
        setManagerName={setManagerName}
        llmProvider={llmProvider}
        llmModel={llmModel}
        onReset={reseed}
      />

      <Hero managerName={managerName} />

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="lg:col-span-4">
          <IntakeColumn
            messages={messages}
            customers={customers}
            selectedId={selectedId}
            onSelect={onSelectMessage}
            onRun={runManager}
            managerName={managerName}
            working={working}
          />
        </section>

        <section className="lg:col-span-5">
          <DecisionColumn
            managerName={managerName}
            selected={selected}
            selectedCustomer={selectedCustomer ?? null}
            result={activeResult}
            step={pipelineStep}
            working={working}
            onRun={() => selected && runManager(selected.id)}
          />
        </section>

        <section className="lg:col-span-3 space-y-5">
          <BookingsBoard />
          <ActionsFeed actions={actions} currentResult={activeResult} />
        </section>
      </div>

      <LeverageStrip stats={stats} />
    </div>
  );
}

function TopBar({
  managerName,
  setManagerName,
  llmProvider,
  llmModel,
  onReset,
}: {
  managerName: string;
  setManagerName: (n: string) => void;
  llmProvider: string | null;
  llmModel: string | null;
  onReset: () => void;
}) {
  const liveLlm = !!llmProvider;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-800/80 bg-ink-900/40 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col">
          <label className="text-[10px] uppercase tracking-wider text-ink-500">
            AI Manager name
          </label>
          <input
            value={managerName}
            onChange={(e) => setManagerName(e.target.value.slice(0, 24))}
            placeholder="Name your AI Manager"
            className="mt-0.5 w-44 rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-sm text-ink-100 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="hidden h-10 w-px bg-ink-800 sm:block" />
        <div className="hidden sm:block">
          <div className="text-[10px] uppercase tracking-wider text-ink-500">
            Business
          </div>
          <div className="text-sm font-medium text-ink-100">
            {demoBusiness.name}
          </div>
          <div className="text-xs text-ink-500">{demoBusiness.website}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={clsx(
            "pill",
            liveLlm
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-ink-600 bg-ink-800 text-ink-200",
          )}
        >
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              liveLlm ? "bg-emerald-400" : "bg-ink-500",
            )}
          />
          {liveLlm
            ? `${llmProvider}${llmModel ? ` · ${llmModel}` : ""}`
            : "Demo mode · deterministic"}
        </span>
        <button onClick={onReset} className="btn">
          Reset demo
        </button>
      </div>
    </div>
  );
}

function Hero({ managerName }: { managerName: string }) {
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-gradient-to-br from-ink-900 to-ink-950 px-6 py-7">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Meet {managerName}, your AI Manager.
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-300 sm:text-base">
        Opelo handles refunds, pricing exceptions, sponsorships, scheduling,
        and escalations using your business rules. Pick an inbound request and
        let {managerName} handle it.
      </p>
    </div>
  );
}

function IntakeColumn({
  messages,
  customers,
  selectedId,
  onSelect,
  onRun,
  managerName,
  working,
}: {
  messages: InboundMessage[];
  customers: Customer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRun: (id: string) => void;
  managerName: string;
  working: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-ink-800/80 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-100">
          Inbound
        </h2>
        <span className="text-xs text-ink-500">
          {messages.filter((m) => m.status === "new").length} new
        </span>
      </div>
      <ul className="divide-y divide-ink-800/60">
        {messages.map((m) => {
          const c = customers.find((x) => x.id === m.customer_id);
          const isSelected = m.id === selectedId;
          const isHandled = m.status === "handled";
          return (
            <li
              key={m.id}
              className={clsx(
                "px-5 py-4 transition",
                isSelected ? "bg-ink-800/60" : "hover:bg-ink-800/30",
              )}
            >
              <button
                className="w-full text-left"
                onClick={() => onSelect(m.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx("pill", CHANNEL_TONE[m.channel])}
                    >
                      {CHANNEL_LABEL[m.channel]}
                    </span>
                    <span className="text-sm font-medium text-ink-100">
                      {c?.name ?? m.customer_id}
                    </span>
                  </div>
                  {isHandled ? (
                    <span className="pill border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
                      Handled
                    </span>
                  ) : (
                    <span className="text-xs text-ink-500">
                      {timeAgo(m.received_at)}
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-300">
                  {m.body}
                </p>
                {m.amount_hint != null && (
                  <div className="mt-1.5 text-xs text-ink-400">
                    Est. value ·{" "}
                    <span className="text-ink-100">
                      ${m.amount_hint.toLocaleString()}
                    </span>
                  </div>
                )}
              </button>
              {isSelected && (
                <button
                  onClick={() => onRun(m.id)}
                  disabled={working}
                  className="btn-primary mt-3 w-full"
                >
                  {working ? `${managerName} is working…` : `Let ${managerName} handle this`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DecisionColumn({
  managerName,
  selected,
  selectedCustomer,
  result,
  step,
  working,
  onRun,
}: {
  managerName: string;
  selected: InboundMessage | null;
  selectedCustomer: Customer | null;
  result: ProcessResult | null;
  step: PipelineStep;
  working: boolean;
  onRun: () => void;
}) {
  return (
    <div className="card min-h-[480px]">
      <div className="border-b border-ink-800/80 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-100">
          {managerName}&apos;s decision
        </h2>
      </div>

      {!selected ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-ink-400">
            Select an inbound request and let your AI Manager handle it.
          </p>
        </div>
      ) : (
        <div className="space-y-5 p-5">
          <MessagePreview
            customer={selectedCustomer}
            message={selected}
            managerName={managerName}
            working={working}
            hasResult={!!result}
            onRun={onRun}
          />

          <Timeline step={step} hasResult={!!result} />

          {result ? (
            <ResultPanel result={result} managerName={managerName} />
          ) : !working ? (
            <p className="text-sm text-ink-400">
              Click <span className="text-ink-100">Let {managerName} handle this</span> to
              run the request through your business policies.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MessagePreview({
  customer,
  message,
  managerName,
  working,
  hasResult,
  onRun,
}: {
  customer: Customer | null;
  message: InboundMessage;
  managerName: string;
  working: boolean;
  hasResult: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={clsx("pill", CHANNEL_TONE[message.channel])}>
            {CHANNEL_LABEL[message.channel]}
          </span>
          <span className="font-medium text-ink-100">
            {customer?.name ?? message.customer_id}
          </span>
          {customer?.email && (
            <span className="text-xs text-ink-500">{customer.email}</span>
          )}
        </div>
        {!hasResult && (
          <button
            onClick={onRun}
            disabled={working}
            className="btn-primary"
          >
            {working ? `${managerName} is working…` : `Let ${managerName} handle this`}
          </button>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-ink-200">
        {message.body}
      </p>
    </div>
  );
}

function Timeline({
  step,
  hasResult,
}: {
  step: PipelineStep;
  hasResult: boolean;
}) {
  const activeIdx = TIMELINE.findIndex((s) => s.id === step);
  return (
    <ol className="space-y-2">
      {TIMELINE.map((s, i) => {
        const isPast = hasResult || (activeIdx > -1 && i < activeIdx);
        const isCurrent =
          !hasResult && activeIdx > -1 && i === activeIdx && step !== "done";
        const isFuture = !isPast && !isCurrent;
        return (
          <li
            key={s.id}
            className={clsx(
              "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
              isPast
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-100"
                : isCurrent
                  ? "border-accent/40 bg-accent/5 text-accent"
                  : "border-ink-800 bg-ink-950/40 text-ink-500",
            )}
          >
            <span
              className={clsx(
                "grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold",
                isPast
                  ? "bg-emerald-500/20 text-emerald-200"
                  : isCurrent
                    ? "bg-accent/20 text-accent"
                    : "bg-ink-800 text-ink-500",
              )}
            >
              {isPast ? "✓" : i + 1}
            </span>
            <span>{s.label}</span>
            {isCurrent && (
              <span className="ml-auto inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            )}
            {isFuture && <span className="ml-auto text-[10px]">—</span>}
          </li>
        );
      })}
    </ol>
  );
}

function ResultPanel({
  result,
  managerName,
}: {
  result: ProcessResult;
  managerName: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailRow label="Classification" value={prettyClass(result.classification)} />
        <DetailRow
          label="Decision"
          value={DECISION_LABEL[result.decision] ?? result.decision}
          accent
        />
        <DetailRow
          label="Action"
          value={prettyActionType(result.action_type)}
        />
        <DetailRow
          label="Policy used"
          value={result.policy_applied}
          full
        />
        <DetailRow
          label="Reasoning summary"
          value={result.reasoning_summary}
          full
        />
      </div>

      <div className="rounded-xl border border-ink-800 bg-ink-950/60 p-4">
        <div className="label">{managerName}&apos;s reply to the customer</div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-100">
          {result.customer_response}
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="label text-amber-200/80">Owner update</div>
        <p className="mt-2 text-sm text-amber-50">{result.owner_summary}</p>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  full,
  accent,
}: {
  label: string;
  value: string;
  full?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-ink-800 bg-ink-950/40 p-3",
        full && "sm:col-span-2",
      )}
    >
      <div className="label">{label}</div>
      <div
        className={clsx(
          "mt-1 text-sm",
          accent ? "font-semibold text-accent" : "text-ink-100",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function PoliciesCard({
  policies,
  onChange,
}: {
  policies: Policies;
  onChange: (next: Policies) => void;
}) {
  const updateNumber =
    (key: keyof Policies) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      if (!Number.isFinite(v)) return;
      onChange({ ...policies, [key]: v });
    };

  return (
    <div className="card">
      <div className="border-b border-ink-800/80 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-100">
          Business policies
        </h2>
      </div>
      <ul className="divide-y divide-ink-800/60">
        <PolicyRow
          label="Refunds auto-approved under"
          value={`$${policies.refund_auto_approve_under}`}
        >
          <NumberInline
            value={policies.refund_auto_approve_under}
            onChange={updateNumber("refund_auto_approve_under")}
          />
        </PolicyRow>
        <PolicyRow
          label="Sponsorship floor"
          value={`$${policies.min_sponsorship_price.toLocaleString()}`}
        >
          <NumberInline
            value={policies.min_sponsorship_price}
            onChange={updateNumber("min_sponsorship_price")}
          />
        </PolicyRow>
        <PolicyRow
          label="Event deposit threshold"
          value={`$${policies.min_project_price.toLocaleString()}`}
        >
          <NumberInline
            value={policies.min_project_price}
            onChange={updateNumber("min_project_price")}
          />
        </PolicyRow>
        <PolicyRow
          label="Auto-confirm events over"
          value={`$${policies.auto_book_lead_above.toLocaleString()}`}
        >
          <NumberInline
            value={policies.auto_book_lead_above}
            onChange={updateNumber("auto_book_lead_above")}
          />
        </PolicyRow>
        <li className="flex items-center justify-between px-5 py-3 text-sm">
          <span className="text-ink-300">Angry customers escalated</span>
          <span className="pill border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
            Always
          </span>
        </li>
      </ul>
    </div>
  );
}

function PolicyRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="px-5 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-ink-300">{label}</span>
        {editing ? (
          <div className="flex items-center gap-2">
            {children}
            <button
              className="text-xs text-accent hover:underline"
              onClick={() => setEditing(false)}
            >
              Done
            </button>
          </div>
        ) : (
          <button
            className="text-sm font-medium text-ink-100 hover:text-accent"
            onClick={() => setEditing(true)}
            title="Click to edit"
          >
            {value}
          </button>
        )}
      </div>
    </li>
  );
}

function NumberInline({
  value,
  onChange,
}: {
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-ink-500">$</span>
      <input
        type="number"
        value={value}
        onChange={onChange}
        className="w-24 rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-right text-sm"
      />
    </div>
  );
}

function ActionsFeed({
  actions,
  currentResult,
}: {
  actions: ActionRecord[];
  currentResult: ProcessResult | null;
}) {
  const recent = useMemo(() => {
    const items: { name: string; detail?: string; ts: string; isLive?: boolean }[] = [];
    if (currentResult) {
      for (const a of currentResult.mock_external_actions) {
        items.push({
          name: a.name,
          detail: a.detail,
          ts: new Date().toISOString(),
          isLive: true,
        });
      }
    }
    for (const act of actions.slice(0, 8)) {
      for (const a of act.mock_external_actions) {
        items.push({
          name: a.name,
          detail: a.detail,
          ts: act.created_at,
        });
      }
    }
    return items.slice(0, 12);
  }, [actions, currentResult]);

  return (
    <div className="card">
      <div className="border-b border-ink-800/80 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-100">
          Actions taken
        </h2>
      </div>
      <ul className="divide-y divide-ink-800/60">
        {recent.length === 0 && (
          <li className="px-5 py-4 text-sm text-ink-400">
            Nothing yet — run a request to see live actions appear here.
          </li>
        )}
        {recent.map((a, i) => (
          <li key={i} className="px-5 py-3 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  a.isLive ? "bg-accent" : "bg-emerald-400/70",
                )}
              />
              <span className="font-medium text-ink-100">
                {humanizeAction(a.name)}
              </span>
            </div>
            {a.detail && (
              <p className="mt-1 line-clamp-2 pl-3.5 text-xs text-ink-400">
                {a.detail}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LeverageStrip({ stats }: { stats: Stats }) {
  return (
    <div className="card">
      <div className="border-b border-ink-800/80 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-100">
          Today&apos;s leverage
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-px bg-ink-800/60 sm:grid-cols-4">
        <LeverageCell
          label="Revenue protected"
          value={`$${stats.revenueImpact.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}`}
          hint={`+$${stats.revenueGenerated.toFixed(0)} new · −$${stats.refundsTotal.toFixed(0)} refunds`}
        />
        <LeverageCell
          label="Meetings booked"
          value={String(stats.meetingsBooked)}
          hint="From leads and scheduling"
        />
        <LeverageCell
          label="Deposits sent"
          value={String(stats.depositsSent)}
          hint={`${stats.eventsConfirmed} events confirmed`}
        />
        <LeverageCell
          label="Owner interruptions avoided"
          value={String(stats.interruptionsAvoided)}
          hint={`${stats.escalations} sent to phone`}
        />
      </div>
    </div>
  );
}

function LeverageCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-ink-900/70 px-5 py-4">
      <div className="label">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-ink-100">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

interface Stats {
  refundsApproved: number;
  refundsEscalated: number;
  refundsTotal: number;
  revenueGenerated: number;
  revenueImpact: number;
  meetingsBooked: number;
  depositsSent: number;
  eventsConfirmed: number;
  escalations: number;
  interruptionsAvoided: number;
}

function computeStats(actions: ActionRecord[]): Stats {
  let refundsApproved = 0;
  let refundsEscalated = 0;
  let refundsTotal = 0;
  let revenueGenerated = 0;
  let meetingsBooked = 0;
  let depositsSent = 0;
  let eventsConfirmed = 0;
  let escalations = 0;
  let interruptionsAvoided = 0;
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
    if (a.action_type === "deposit_requested") depositsSent += 1;
    if (a.action_type === "event_confirmed") eventsConfirmed += 1;
    if (a.action_type === "owner_escalated") escalations += 1;
    if (a.decision !== "escalate_to_owner") interruptionsAvoided += 1;
    if (a.revenue_delta > 0) revenueGenerated += a.revenue_delta;
  }
  return {
    refundsApproved,
    refundsEscalated,
    refundsTotal,
    revenueGenerated,
    revenueImpact: revenueGenerated - refundsTotal,
    meetingsBooked,
    depositsSent,
    eventsConfirmed,
    escalations,
    interruptionsAvoided,
  };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function prettyClass(c: string): string {
  const map: Record<string, string> = {
    refund_request: "Refund request",
    pricing_exception: "Pricing exception",
    sponsorship_offer: "Sponsorship offer",
    qualified_lead: "Qualified lead",
    event_inquiry: "Event inquiry",
    scheduling_request: "Scheduling request",
    escalation: "Escalation",
  };
  return map[c] ?? c;
}

function humanizeAction(name: string): string {
  if (name.includes("sponge") && name.includes("payment_link"))
    return "Sponge deposit link created";
  if (name.includes("memory") && name.includes("decision"))
    return "Booking saved to memory";
  if (name.includes("memory") && name.includes("searched"))
    return "Customer history checked";
  if (name.includes("sponge") && name.includes("refund"))
    return "Sponge refund created";
  if (name.includes("agentmail.reply")) return "AgentMail reply sent";
  if (name.includes("agentphone") && name.includes("owner"))
    return "AgentPhone owner SMS sent";
  if (name.includes("agentphone") && name.includes("sms"))
    return "AgentPhone SMS sent";
  if (name.includes("agentphone") && name.includes("call"))
    return "AgentPhone call placed";
  if (name.includes("google_calendar")) return "Calendar event booked";
  return name;
}

function prettyActionType(t: string): string {
  return ACTION_TYPE_LABEL[t] ?? t.replace(/_/g, " ");
}

export type { MockExternalAction };
