"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type PipelineStep =
  | "idle"
  | "received"
  | "policy"
  | "decided"
  | "acting"
  | "reply"
  | "owner"
  | "done";

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

const CLASS_LABEL: Record<string, string> = {
  refund_request: "Refund request",
  pricing_exception: "Pricing exception",
  sponsorship_offer: "Sponsorship offer",
  qualified_lead: "Qualified lead",
  scheduling_request: "Scheduling request",
  escalation: "Escalation",
};

const SIMULATE_INTERVAL_MS = 28000;

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
  const [justArrived, setJustArrived] = useState<{
    id: string;
    name: string;
    channel: Channel;
  } | null>(null);
  const [arrivalIds, setArrivalIds] = useState<Set<string>>(new Set());
  const [pendingRemaining, setPendingRemaining] = useState<number>(0);
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("opelo.managerName");
      if (saved) setManagerName(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("opelo.managerName", managerName);
    } catch {
      // ignore
    }
  }, [managerName]);

  const fetchAll = useCallback(async () => {
    const [msgRes, polRes, actRes, statusRes, simRes] = await Promise.all([
      fetch("/api/messages", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/policies", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/actions", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/status", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/simulate/next", { cache: "no-store" })
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
    if (simRes && typeof simRes.remaining === "number") {
      setPendingRemaining(simRes.remaining);
    }
    setSelectedId((prev) => {
      if (prev) return prev;
      const list: InboundMessage[] = msgRes.messages ?? [];
      const firstNew = list.find((m) => m.status === "new") ?? list[0];
      return firstNew?.id ?? null;
    });
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // General message polling: detects new inbound from any source —
  // AgentMail webhook, /api/agentmail/test, or the seeded simulate queue.
  // Compares against last-seen ids; for each new id fires the arrival toast.
  const knownIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/messages", { cache: "no-store" });
        const data = await r.json();
        if (cancelled) return;
        const msgs = (data.messages ?? []) as InboundMessage[];
        const custs = (data.customers ?? []) as Customer[];
        setMessages(msgs);
        setCustomers(custs);

        const prev = knownIdsRef.current;
        if (prev.size > 0) {
          // Only flag arrivals after the first poll has seeded the baseline.
          const newOnes = msgs.filter((m) => !prev.has(m.id));
          if (newOnes.length > 0) {
            // Show the toast for the freshest one.
            const latest = newOnes[0];
            const c = custs.find((x) => x.id === latest.customer_id);
            setJustArrived({
              id: latest.id,
              name: c?.name ?? latest.customer_id,
              channel: latest.channel,
            });
            setArrivalIds((s) => {
              const next = new Set(s);
              for (const n of newOnes) next.add(n.id);
              return next;
            });
            if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
            arrivalTimer.current = setTimeout(
              () => setJustArrived(null),
              6000,
            );
            setSelectedId((s) => s ?? latest.id);
          }
        }
        knownIdsRef.current = new Set(msgs.map((m) => m.id));
      } catch {
        // ignore network blip
      }
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Seeded demo queue: every ~28s, ask the server to dequeue the next pending
  // inbound. The new message gets picked up by the messages poll above.
  useEffect(() => {
    const tick = async () => {
      try {
        const r = await fetch("/api/simulate/next", { method: "POST" });
        const data = await r.json();
        if (typeof data.remaining === "number") {
          setPendingRemaining(data.remaining);
        }
      } catch {
        // ignore
      }
    };
    const id = setInterval(tick, SIMULATE_INTERVAL_MS);
    return () => clearInterval(id);
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
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    setSelectedId(messageId);
    setWorking(true);
    setActiveResult(null);
    setPipelineStep("received");

    // Kick off the network request immediately, animate while we wait.
    const fetchPromise = fetch("/api/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: messageId,
        use_llm: true,
        manager_name: managerName,
      }),
    });

    const stepOrder: PipelineStep[] = [
      "received",
      "policy",
      "decided",
      "acting",
      "reply",
      "owner",
    ];
    let i = 0;
    const tick = setInterval(() => {
      i = Math.min(i + 1, stepOrder.length - 1);
      setPipelineStep(stepOrder[i]);
    }, 520);

    try {
      const r = await fetchPromise;
      const data = await r.json();
      // Let the timeline finish playing.
      const playoutDelay = Math.max(
        0,
        (stepOrder.length - 1 - i) * 520 + 320,
      );
      await new Promise((res) => setTimeout(res, playoutDelay));
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
    setArrivalIds(new Set());
    setJustArrived(null);
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
        pendingRemaining={pendingRemaining}
        onReset={reseed}
      />

      <Hero managerName={managerName} />

      <JustArrivedToast item={justArrived} onDismiss={() => setJustArrived(null)} />

      <div className="grid gap-5 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <IntakeColumn
            messages={messages}
            customers={customers}
            selectedId={selectedId}
            onSelect={onSelectMessage}
            onRun={runManager}
            managerName={managerName}
            working={working}
            arrivalIds={arrivalIds}
          />
        </section>

        <section className="lg:col-span-5">
          <ActiveWorkflowColumn
            managerName={managerName}
            selected={selected}
            selectedCustomer={selectedCustomer ?? null}
            result={activeResult}
            step={pipelineStep}
            working={working}
            onRun={() => selected && runManager(selected.id)}
          />
        </section>

        <section className="lg:col-span-2">
          {policies && (
            <PoliciesCard policies={policies} onChange={updatePolicies} />
          )}
        </section>
      </div>

      <LeverageStrip stats={stats} />

      <OperationalFeed
        actions={actions}
        customers={customers}
        messages={messages}
        managerName={managerName}
      />
    </div>
  );
}

function TopBar({
  managerName,
  setManagerName,
  llmProvider,
  llmModel,
  pendingRemaining,
  onReset,
}: {
  managerName: string;
  setManagerName: (n: string) => void;
  llmProvider: string | null;
  llmModel: string | null;
  pendingRemaining: number;
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
          title={liveLlm ? "LLM key detected" : "No LLM key — deterministic engine"}
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
        {pendingRemaining > 0 && (
          <span
            className="pill border-accent/40 bg-accent/10 text-accent"
            title="Queued inbound that will arrive live during the demo"
          >
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            {pendingRemaining} arriving live
          </span>
        )}
        <button onClick={onReset} className="btn">
          Reset demo
        </button>
      </div>
    </div>
  );
}

function Hero({ managerName }: { managerName: string }) {
  return (
    <div className="rounded-2xl border border-ink-800/80 bg-gradient-to-br from-ink-900 to-ink-950 px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {managerName} is running your operations.
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm text-ink-300">
        Refunds, pricing exceptions, sponsorships, scheduling, and escalations
        — handled across email, SMS, phone, and DMs using your business rules.
      </p>
    </div>
  );
}

function JustArrivedToast({
  item,
  onDismiss,
}: {
  item: { id: string; name: string; channel: Channel } | null;
  onDismiss: () => void;
}) {
  if (!item) return null;
  return (
    <div className="pointer-events-auto fixed bottom-6 right-6 z-40 flex max-w-sm items-center gap-3 rounded-xl border border-accent/40 bg-ink-900/90 px-4 py-3 shadow-glow backdrop-blur">
      <span className="pulse-dot inline-block h-2 w-2 flex-none rounded-full bg-accent" />
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wider text-accent">
          New {CHANNEL_LABEL[item.channel]} just arrived
        </div>
        <div className="text-sm font-medium text-ink-100">From {item.name}</div>
      </div>
      <button
        onClick={onDismiss}
        className="text-ink-500 hover:text-ink-200"
        aria-label="dismiss"
      >
        ×
      </button>
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
  arrivalIds,
}: {
  messages: InboundMessage[];
  customers: Customer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRun: (id: string) => void;
  managerName: string;
  working: boolean;
  arrivalIds: Set<string>;
}) {
  const newOnly = messages.filter((m) => m.status !== "handled");
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-ink-800/80 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-100">
          Inbound
        </h2>
        <span className="text-xs text-ink-500">
          {newOnly.filter((m) => m.status === "new").length} new ·{" "}
          {messages.filter((m) => m.status === "handled").length} handled today
        </span>
      </div>
      <ul className="divide-y divide-ink-800/60">
        {newOnly.length === 0 && (
          <li className="px-5 py-8 text-center text-sm text-ink-400">
            Inbox is clear. Waiting for the next inbound…
          </li>
        )}
        {newOnly.map((m) => {
          const c = customers.find((x) => x.id === m.customer_id);
          const isSelected = m.id === selectedId;
          const isFresh = arrivalIds.has(m.id);
          return (
            <li
              key={m.id}
              className={clsx(
                "px-5 py-4 transition",
                isSelected ? "bg-ink-800/60" : "hover:bg-ink-800/30",
                isFresh && "ring-1 ring-inset ring-accent/40",
              )}
            >
              <button
                className="w-full text-left"
                onClick={() => onSelect(m.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={clsx("pill", CHANNEL_TONE[m.channel])}>
                      {CHANNEL_LABEL[m.channel]}
                    </span>
                    <span className="text-sm font-medium text-ink-100">
                      {c?.name ?? m.customer_id}
                    </span>
                    {isFresh && (
                      <span className="pill border-accent/40 bg-accent/10 text-accent">
                        Just arrived
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ink-500">
                    {timeAgo(m.received_at)}
                  </span>
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

function ActiveWorkflowColumn({
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
    <div className="card min-h-[520px]">
      <div className="border-b border-ink-800/80 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-100">
          {managerName}&apos;s workflow
        </h2>
      </div>

      {!selected ? (
        <div className="px-6 py-20 text-center">
          <p className="text-sm text-ink-400">
            Pick an inbound request to watch {managerName} run the workflow.
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

          <WorkflowTimeline
            channel={selected.channel}
            step={step}
            result={result}
            managerName={managerName}
          />

          {result && <ResultPanel result={result} managerName={managerName} />}
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
          <button onClick={onRun} disabled={working} className="btn-primary">
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

function WorkflowTimeline({
  channel,
  step,
  result,
  managerName,
}: {
  channel: Channel;
  step: PipelineStep;
  result: ProcessResult | null;
  managerName: string;
}) {
  const steps = buildTimelineSteps(channel, result);
  const order: PipelineStep[] = [
    "received",
    "policy",
    "decided",
    "acting",
    "reply",
    "owner",
  ];
  const activeIdx = order.indexOf(step);
  const isDone = step === "done";

  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const isPast = isDone || (activeIdx > -1 && i < activeIdx);
        const isCurrent = !isDone && activeIdx > -1 && i === activeIdx;
        return (
          <li
            key={s.id}
            className={clsx(
              "flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-all",
              isPast
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-100"
                : isCurrent
                  ? "border-accent/50 bg-accent/10 text-accent shadow-glow"
                  : "border-ink-800 bg-ink-950/40 text-ink-500",
            )}
          >
            <span
              className={clsx(
                "grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold",
                isPast
                  ? "bg-emerald-500/20 text-emerald-200"
                  : isCurrent
                    ? "bg-accent/30 text-accent"
                    : "bg-ink-800 text-ink-500",
              )}
            >
              {isPast ? "✓" : i + 1}
            </span>
            <span className="flex-1">{s.label}</span>
            {isCurrent && (
              <span className="text-[10px] uppercase tracking-wider text-accent/80">
                {managerName}&apos;s working
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function buildTimelineSteps(
  channel: Channel,
  result: ProcessResult | null,
): { id: PipelineStep; label: string }[] {
  const channelLabel =
    channel === "email"
      ? "Email received"
      : channel === "sms"
        ? "SMS received"
        : channel === "phone_transcript"
          ? "Phone call transcribed"
          : channel === "social_dm"
            ? "Instagram DM received"
            : "Inbound received";

  const decisionLabel = result
    ? `${DECISION_LABEL[result.decision] ?? result.decision} · ${CLASS_LABEL[result.classification] ?? result.classification}`
    : "Decision made";

  const primaryAction = result
    ? prettyPrimaryAction(result)
    : "External actions executed";

  return [
    { id: "received", label: channelLabel },
    { id: "policy", label: "Policy checked" },
    { id: "decided", label: decisionLabel },
    { id: "acting", label: primaryAction },
    { id: "reply", label: "Reply sent to customer" },
    { id: "owner", label: "Owner updated" },
  ];
}

function prettyPrimaryAction(result: ProcessResult): string {
  const names = result.mock_external_actions.map((a) => a.name);
  if (names.some((n) => n.includes("sponge") && n.includes("refund")))
    return "Sponge refund created";
  if (names.some((n) => n.includes("sponge") && n.includes("payment_link")))
    return "Sponge payment link sent";
  if (names.some((n) => n.includes("google_calendar")))
    return "Calendar meeting booked";
  if (names.some((n) => n.includes("agentphone") && n.includes("owner")))
    return "Owner SMS sent via AgentPhone";
  return "External actions executed";
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
        <DetailRow label="Policy used" value={result.policy_applied} full />
        <DetailRow
          label="Reasoning summary"
          value={result.reasoning_summary}
          full
        />
      </div>

      <div className="rounded-xl border border-ink-800 bg-ink-950/60 p-4">
        <div className="label">
          {managerName}&apos;s reply to the customer
        </div>
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
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-ink-800 bg-ink-950/40 p-3",
        full && "sm:col-span-2",
      )}
    >
      <div className="label">{label}</div>
      <div className="mt-1 text-sm text-ink-100">{value}</div>
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
          label="Refunds under"
          value={`$${policies.refund_auto_approve_under}`}
          trail="auto-approved"
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
          label="Consulting floor"
          value={`$${policies.min_project_price.toLocaleString()}`}
        >
          <NumberInline
            value={policies.min_project_price}
            onChange={updateNumber("min_project_price")}
          />
        </PolicyRow>
        <PolicyRow
          label="Leads over"
          value={`$${policies.auto_book_lead_above.toLocaleString()}`}
          trail="auto-booked"
        >
          <NumberInline
            value={policies.auto_book_lead_above}
            onChange={updateNumber("auto_book_lead_above")}
          />
        </PolicyRow>
        <li className="px-5 py-3 text-xs text-ink-300">
          <span className="text-ink-400">Angry customers</span> · always escalate
        </li>
      </ul>
    </div>
  );
}

function PolicyRow({
  label,
  value,
  trail,
  children,
}: {
  label: string;
  value: string;
  trail?: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="px-5 py-3 text-sm">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-ink-400">{label}</span>
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
            className="text-left text-sm font-medium text-ink-100 hover:text-accent"
            onClick={() => setEditing(true)}
            title="Click to edit"
          >
            {value}
            {trail && (
              <span className="ml-1 text-xs font-normal text-ink-400">
                {trail}
              </span>
            )}
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

function OperationalFeed({
  actions,
  customers,
  messages,
  managerName,
}: {
  actions: ActionRecord[];
  customers: Customer[];
  messages: InboundMessage[];
  managerName: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-ink-800/80 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink-100">
            Live operational feed
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Every workflow {managerName} has run. Click any item to expand.
          </p>
        </div>
        <span className="text-xs text-ink-500">{actions.length} total</span>
      </div>
      <ul className="divide-y divide-ink-800/60">
        {actions.length === 0 && (
          <li className="px-5 py-6 text-center text-sm text-ink-400">
            No workflows yet. Run an inbound request to start the feed.
          </li>
        )}
        {actions.map((a) => {
          const m = messages.find((x) => x.id === a.message_id);
          const c = customers.find((x) => x.id === a.customer_id);
          const isOpen = expanded.has(a.id);
          return (
            <li key={a.id}>
              <button
                onClick={() => toggle(a.id)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-ink-800/30"
              >
                {m && (
                  <span className={clsx("pill", CHANNEL_TONE[m.channel])}>
                    {CHANNEL_LABEL[m.channel]}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-ink-100">
                      {c?.name ?? a.customer_id}
                    </span>
                    <span className="text-ink-500">·</span>
                    <span className="truncate text-ink-300">
                      {prettySentence(a, managerName)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    {timeAgo(a.created_at)} · {prettyDecision(a.decision)}
                  </div>
                </div>
                <span
                  className={clsx(
                    "text-ink-400 transition-transform",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              {isOpen && (
                <ExpandedWorkflow
                  action={a}
                  message={m ?? null}
                  managerName={managerName}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ExpandedWorkflow({
  action,
  message,
  managerName,
}: {
  action: ActionRecord;
  message: InboundMessage | null;
  managerName: string;
}) {
  return (
    <div className="space-y-4 border-t border-ink-800/60 bg-ink-950/30 px-5 py-5">
      {message && (
        <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-3">
          <div className="label">Inbound message</div>
          <p className="mt-1 text-sm text-ink-200">{message.body}</p>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-ink-800 bg-ink-950/40 p-3">
          <div className="label">Policy used</div>
          <p className="mt-1 text-sm text-ink-100">{action.policy_applied}</p>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-950/40 p-3">
          <div className="label">Reasoning summary</div>
          <p className="mt-1 text-sm text-ink-100">
            {action.reasoning_summary || "—"}
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-ink-800 bg-ink-950/40 p-3">
        <div className="label">{managerName}&apos;s reply to the customer</div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-100">
          {action.customer_response}
        </p>
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="label text-amber-200/80">Owner update</div>
        <p className="mt-1 text-sm text-amber-50">{action.owner_summary}</p>
      </div>
      <div>
        <div className="label mb-2">Actions taken</div>
        <ul className="space-y-1.5">
          {action.mock_external_actions.map((act, i) => (
            <li
              key={act.ref + i}
              className="flex items-start gap-2 rounded-md border border-ink-800 bg-ink-950/40 px-3 py-2 text-xs text-ink-300"
            >
              <span
                className={clsx(
                  "mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                  act.ok
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-rose-500/15 text-rose-300",
                )}
              >
                {act.ok ? "✓" : "✕"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-ink-100">{humanizeAction(act.name)}</div>
                {act.detail && (
                  <div className="text-ink-400">{act.detail}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
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
          label="Revenue impact"
          value={`${stats.revenueImpact >= 0 ? "+" : "−"}$${Math.abs(
            stats.revenueImpact,
          ).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          hint={`+$${stats.revenueGenerated.toFixed(0)} new · −$${stats.refundsTotal.toFixed(0)} refunds`}
        />
        <LeverageCell
          label="Meetings booked"
          value={String(stats.meetingsBooked)}
          hint="From leads and scheduling"
        />
        <LeverageCell
          label="Refunds handled"
          value={`${stats.refundsApproved + stats.refundsEscalated}`}
          hint={`${stats.refundsApproved} approved · ${stats.refundsEscalated} held`}
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
  escalations: number;
  interruptionsAvoided: number;
}

function computeStats(actions: ActionRecord[]): Stats {
  let refundsApproved = 0;
  let refundsEscalated = 0;
  let refundsTotal = 0;
  let revenueGenerated = 0;
  let meetingsBooked = 0;
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

function prettyDecision(d: string): string {
  return DECISION_LABEL[d] ?? d;
}

function prettySentence(action: ActionRecord, managerName: string): string {
  if (action.action_type === "refund_issued")
    return `${managerName} approved refund · ${action.owner_summary}`;
  if (action.action_type === "sponsorship_countered")
    return `${managerName} countered sponsorship · ${action.owner_summary}`;
  if (action.action_type === "discount_offered")
    return `${managerName} held pricing floor · ${action.owner_summary}`;
  if (action.action_type === "meeting_booked")
    return `${managerName} booked a meeting · ${action.owner_summary}`;
  if (action.action_type === "owner_escalated")
    return `${managerName} escalated to owner · ${action.owner_summary}`;
  if (action.action_type === "auto_reply_sent")
    return `${managerName} replied · ${action.owner_summary}`;
  return action.owner_summary;
}

function humanizeAction(name: string): string {
  if (name.includes("sponge") && name.includes("refund"))
    return "Sponge refund created";
  if (name.includes("sponge") && name.includes("payment_link"))
    return "Sponge payment link generated";
  if (name.includes("agentmail")) return "AgentMail reply sent";
  if (name.includes("agentphone") && name.includes("owner"))
    return "AgentPhone owner SMS sent";
  if (name.includes("agentphone") && name.includes("sms"))
    return "AgentPhone SMS sent";
  if (name.includes("google_calendar")) return "Calendar meeting booked";
  if (name.includes("supermemory")) return "Decision saved to Supermemory";
  return name;
}

export type { MockExternalAction };
