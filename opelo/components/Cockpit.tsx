"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  ActionRecord,
  ActionType,
  Channel,
  CompanyWallet,
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
  const [wallet, setWallet] = useState<CompanyWallet | null>(null);
  const [walletFlash, setWalletFlash] = useState<{
    kind: "refund" | "pipeline" | "revenue";
    delta_cents: number;
  } | null>(null);
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const walletFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const [msgRes, polRes, actRes, statusRes, simRes, walletRes] = await Promise.all([
      fetch("/api/messages", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/policies", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/actions", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/status", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/simulate/next", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/wallet", { cache: "no-store" })
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
    if (walletRes?.wallet) setWallet(walletRes.wallet);
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
      const processed = data.result as ProcessResult;
      setActiveResult(processed);
      setPipelineStep("done");
      // Apply the wallet update returned by /api/process — flash the card so
      // the audience can see the available balance move in real time.
      if (data.wallet) {
        const prevAvail = wallet?.available_cents ?? null;
        const prevRefund = wallet?.refunded_today_cents ?? null;
        const prevPending = wallet?.pending_cents ?? null;
        setWallet(data.wallet as CompanyWallet);
        const next = data.wallet as CompanyWallet;
        let kind: "refund" | "pipeline" | "revenue" | null = null;
        let delta = 0;
        if (
          prevRefund != null &&
          next.refunded_today_cents > prevRefund
        ) {
          kind = "refund";
          delta = next.refunded_today_cents - prevRefund;
        } else if (
          prevPending != null &&
          next.pending_cents > prevPending
        ) {
          kind = "pipeline";
          delta = next.pending_cents - prevPending;
        } else if (
          prevAvail != null &&
          next.available_cents > prevAvail
        ) {
          kind = "revenue";
          delta = next.available_cents - prevAvail;
        }
        if (kind) {
          setWalletFlash({ kind, delta_cents: delta });
          if (walletFlashTimer.current) clearTimeout(walletFlashTimer.current);
          walletFlashTimer.current = setTimeout(
            () => setWalletFlash(null),
            6000,
          );
        }
      }
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
        <section className="lg:col-span-4">
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

        <section className="lg:col-span-3 space-y-5">
          <WalletCard wallet={wallet} flash={walletFlash} />
          {policies && (
            <PoliciesCard policies={policies} onChange={updatePolicies} />
          )}
        </section>
      </div>

      <LeverageStrip stats={stats} wallet={wallet} />

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
  const channelReceived = channelReceivedLabel(channel);

  // When there's no result yet, fall back to generic-but-honest labels.
  if (!result) {
    return [
      { id: "received", label: channelReceived },
      { id: "policy", label: "Policy checked" },
      { id: "decided", label: "Decision made" },
      { id: "acting", label: "External actions executed" },
      { id: "reply", label: "Reply sent to customer" },
      { id: "owner", label: "Owner updated" },
    ];
  }

  const replyLabel = replySentLabel(channel);

  switch (result.action_type as ActionType) {
    case "refund_issued": {
      const amt = result.detected_amount
        ? ` ($${result.detected_amount.toFixed(2)})`
        : "";
      return [
        { id: "received", label: channelReceived },
        { id: "policy", label: "Refund policy checked" },
        { id: "decided", label: `Refund approved${amt}` },
        { id: "acting", label: "Sponge wallet debited" },
        { id: "reply", label: replyLabel },
        { id: "owner", label: "Owner updated" },
      ];
    }
    case "sponsorship_countered":
    case "discount_offered": {
      const counter = result.counter_offer
        ? ` at $${result.counter_offer.toLocaleString()}`
        : "";
      return [
        { id: "received", label: channelReceived },
        { id: "policy", label: "Pricing policy checked" },
        { id: "decided", label: `Counter-offered${counter}` },
        { id: "acting", label: "Sponge payment link created" },
        { id: "reply", label: replyLabel },
        { id: "owner", label: "Owner updated" },
      ];
    }
    case "meeting_booked": {
      const channelLabel =
        channel === "phone_transcript"
          ? "Call transcript received"
          : channelReceived;
      return [
        { id: "received", label: channelLabel },
        { id: "policy", label: "Lead qualified" },
        { id: "decided", label: "Calendar checked" },
        { id: "acting", label: "Meeting booked" },
        { id: "reply", label: replyLabel },
        { id: "owner", label: "Owner updated" },
      ];
    }
    case "owner_escalated": {
      return [
        { id: "received", label: channelReceived },
        { id: "policy", label: "Escalation language detected" },
        { id: "decided", label: "Routed to owner" },
        { id: "acting", label: "Holding reply drafted" },
        { id: "reply", label: replyLabel },
        { id: "owner", label: "Owner texted directly" },
      ];
    }
    case "auto_reply_sent":
    default: {
      return [
        { id: "received", label: channelReceived },
        { id: "policy", label: "Policy checked" },
        {
          id: "decided",
          label: `${DECISION_LABEL[result.decision] ?? result.decision} · ${CLASS_LABEL[result.classification] ?? result.classification}`,
        },
        { id: "acting", label: prettyPrimaryAction(result) },
        { id: "reply", label: replyLabel },
        { id: "owner", label: "Owner updated" },
      ];
    }
  }
}

function replySentLabel(channel: Channel): string {
  switch (channel) {
    case "sms":
      return "SMS reply sent";
    case "phone_transcript":
      return "SMS follow-up sent";
    case "social_dm":
      return "DM reply queued";
    case "email":
    default:
      return "Reply sent to customer";
  }
}

function channelReceivedLabel(channel: Channel): string {
  switch (channel) {
    case "email":
      return "Email received";
    case "sms":
      return "SMS received";
    case "phone_transcript":
      return "Phone call transcribed";
    case "social_dm":
      return "Instagram DM received";
    default:
      return "Inbound received";
  }
}

function prettyPrimaryAction(result: ProcessResult): string {
  const names = result.mock_external_actions.map((a) => a.name);
  for (const n of names) {
    const h = humanizeAction(n);
    if (h !== n) return h;
  }
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

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="label text-emerald-200/80">Reply sent to customer</div>
            <div className="text-xs text-emerald-300/70">
              via AgentMail · signed from {managerName}
            </div>
          </div>
          <span className="pill border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
            ✓ Delivered
          </span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-emerald-50">
          {result.customer_response}
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="label text-amber-200/80">Owner update</div>
        <p className="mt-2 text-sm text-amber-50">{result.owner_summary}</p>
      </div>

      <div className="rounded-xl border border-ink-800 bg-ink-950/40 p-3">
        <div className="label mb-2">Actions taken</div>
        <ul className="space-y-1.5">
          {result.mock_external_actions.map((act, i) => (
            <li
              key={act.ref + i}
              className="flex items-center gap-2 text-xs text-ink-200"
            >
              <span
                className={clsx(
                  "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                  act.ok
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-rose-500/15 text-rose-300",
                )}
              >
                {act.ok ? "✓" : "✕"}
              </span>
              <span className="text-ink-100">{humanizeAction(act.name)}</span>
              <span className="ml-auto font-mono text-[10px] text-ink-500">
                {act.ref}
              </span>
            </li>
          ))}
        </ul>
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

function WalletCard({
  wallet,
  flash,
}: {
  wallet: CompanyWallet | null;
  flash: { kind: "refund" | "pipeline" | "revenue"; delta_cents: number } | null;
}) {
  if (!wallet) {
    return (
      <div className="card-tight text-sm text-ink-400">Loading wallet…</div>
    );
  }
  const flashing = !!flash;
  return (
    <div
      className={clsx(
        "card relative overflow-hidden transition",
        flashing && "ring-1 ring-accent/60 shadow-glow",
      )}
    >
      <div className="border-b border-ink-800/80 px-5 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-100">
          Company wallet
        </h2>
        <p className="mt-0.5 text-[11px] text-ink-500">
          Sponge powers financial actions.
        </p>
      </div>

      <div className="px-5 py-4">
        <div className="label">Available</div>
        <div
          className={clsx(
            "mt-1 text-3xl font-semibold tracking-tight transition",
            flash?.kind === "refund" ? "text-rose-200" : "text-ink-100",
          )}
        >
          ${(wallet.available_cents / 100).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        {flash?.kind === "refund" && (
          <div className="mt-1 text-xs font-medium text-rose-300">
            −${(flash.delta_cents / 100).toFixed(2)} refunded via Sponge
          </div>
        )}
        {flash?.kind === "pipeline" && (
          <div className="mt-1 text-xs font-medium text-accent">
            +${(flash.delta_cents / 100).toFixed(2)} pipeline (payment link)
          </div>
        )}
        {flash?.kind === "revenue" && (
          <div className="mt-1 text-xs font-medium text-emerald-300">
            +${(flash.delta_cents / 100).toFixed(2)} revenue captured
          </div>
        )}
      </div>

      <ul className="divide-y divide-ink-800/60 border-t border-ink-800/80">
        <WalletRow
          label="Pending"
          value={`$${(wallet.pending_cents / 100).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
        />
        <WalletRow
          label="Refunded today"
          value={`$${(wallet.refunded_today_cents / 100).toLocaleString(
            undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 },
          )}`}
          highlight={flash?.kind === "refund"}
        />
        <WalletRow
          label="Revenue today"
          value={`$${(wallet.revenue_generated_today_cents / 100).toLocaleString(
            undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 },
          )}`}
          highlight={flash?.kind === "revenue"}
        />
      </ul>

      <div className="border-t border-ink-800/80 px-5 py-2 text-[11px] text-ink-500">
        Updated {timeAgo(wallet.updated_at)}
      </div>
    </div>
  );
}

function WalletRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-center justify-between px-5 py-2.5 text-sm">
      <span className="text-ink-400">{label}</span>
      <span
        className={clsx(
          "font-medium",
          highlight ? "text-rose-200" : "text-ink-100",
        )}
      >
        {value}
      </span>
    </li>
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
  const financial = financialCallout(action);
  return (
    <div className="space-y-4 border-t border-ink-800/60 bg-ink-950/30 px-5 py-5">
      {message && (
        <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-3">
          <div className="label">
            Inbound · {CHANNEL_LABEL[message.channel]}
          </div>
          <div className="mt-1 text-xs text-ink-500">{message.subject}</div>
          <p className="mt-1 text-sm text-ink-200">{message.body}</p>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-ink-800 bg-ink-950/40 p-3">
          <div className="label">Policy used</div>
          <p className="mt-1 text-sm text-ink-100">{action.policy_applied}</p>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-950/40 p-3">
          <div className="label">Decision</div>
          <p className="mt-1 text-sm font-medium text-accent">
            {DECISION_LABEL[action.decision] ?? action.decision} ·{" "}
            <span className="text-ink-100 font-normal">
              {CLASS_LABEL[action.classification] ?? action.classification}
            </span>
          </p>
          <div className="mt-1 text-xs text-ink-400">
            {action.reasoning_summary || "—"}
          </div>
        </div>
      </div>
      {financial && (
        <div
          className={clsx(
            "rounded-lg border p-3",
            financial.tone === "debit"
              ? "border-rose-500/30 bg-rose-500/5"
              : "border-accent/30 bg-accent/5",
          )}
        >
          <div
            className={clsx(
              "label",
              financial.tone === "debit"
                ? "text-rose-200/80"
                : "text-accent/80",
            )}
          >
            Financial action
          </div>
          <p
            className={clsx(
              "mt-1 text-sm",
              financial.tone === "debit" ? "text-rose-50" : "text-accent",
            )}
          >
            {financial.label}
          </p>
        </div>
      )}
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="label text-emerald-200/80">
          {managerName}&apos;s reply to the customer
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-50">
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
              <span className="ml-2 font-mono text-[10px] text-ink-500">
                {act.ref}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function financialCallout(
  action: ActionRecord,
): { label: string; tone: "debit" | "credit" } | null {
  if (action.action_type === "refund_issued") {
    const amt = Math.abs(action.revenue_delta || 0);
    return {
      label: `Sponge refund created for $${amt.toFixed(2)} · debited from wallet`,
      tone: "debit",
    };
  }
  if (
    action.action_type === "sponsorship_countered" ||
    action.action_type === "discount_offered"
  ) {
    const amt = action.counter_offer ?? 0;
    if (amt > 0) {
      return {
        label: `Sponge payment link sent for $${amt.toLocaleString()} · added to pending`,
        tone: "credit",
      };
    }
  }
  if (action.action_type === "meeting_booked" && action.revenue_delta > 0) {
    return {
      label: `Lead booked · $${action.revenue_delta.toLocaleString()} expected revenue`,
      tone: "credit",
    };
  }
  return null;
}

function LeverageStrip({
  stats,
  wallet,
}: {
  stats: Stats;
  wallet: CompanyWallet | null;
}) {
  const refundedToday = wallet
    ? wallet.refunded_today_cents / 100
    : stats.refundsTotal;
  const revenueToday = wallet
    ? wallet.revenue_generated_today_cents / 100
    : stats.revenueGenerated;
  const pipelineDollars = stats.pipelineCreated;
  const impact = revenueToday + pipelineDollars - refundedToday;

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
          value={`${impact >= 0 ? "+" : "−"}$${Math.abs(impact).toLocaleString(
            undefined,
            { maximumFractionDigits: 0 },
          )}`}
          hint={`+$${revenueToday.toFixed(0)} revenue · +$${pipelineDollars.toFixed(0)} pipeline · −$${refundedToday.toFixed(0)} refunds`}
        />
        <LeverageCell
          label="Meetings booked"
          value={String(stats.meetingsBooked)}
          hint="From leads and scheduling"
        />
        <LeverageCell
          label="Refunds handled"
          value={`$${refundedToday.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}`}
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
  pipelineCreated: number;
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
  let pipelineCreated = 0;
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
    if (
      (a.action_type === "discount_offered" ||
        a.action_type === "sponsorship_countered") &&
      typeof a.counter_offer === "number"
    ) {
      pipelineCreated += a.counter_offer;
    }
  }
  return {
    refundsApproved,
    refundsEscalated,
    refundsTotal,
    revenueGenerated,
    pipelineCreated,
    revenueImpact: revenueGenerated + pipelineCreated - refundsTotal,
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
  if (/sponge\.(mock\.)?refund\.created/i.test(name))
    return "Sponge refund created";
  if (/sponge\.(mock\.)?payment_link\.created/i.test(name))
    return "Sponge payment link created";
  if (/sponge\.(mock\.)?customer\.loaded/i.test(name))
    return "Sponge customer looked up";
  if (/sponge\.(mock\.)?balance\.loaded/i.test(name))
    return "Sponge balance fetched";
  if (/agentmail\.(mock\.)?reply/i.test(name)) return "Customer reply sent";
  if (/agentmail\.(mock\.)?inbox\.listed/i.test(name))
    return "AgentMail inbox listed";
  if (/agentphone\.(mock\.)?owner_update/i.test(name)) return "Owner texted";
  if (/agentphone\.(mock\.)?sms\.owner/i.test(name)) return "Owner texted";
  if (/agentphone\.sms\.failed/i.test(name)) return "SMS send failed";
  if (/agentphone\.sms\.skipped/i.test(name)) return "SMS skipped (synthetic)";
  if (/agentphone\.(mock\.)?sms/i.test(name)) return "SMS reply sent";
  if (/agentphone\.(mock\.)?call/i.test(name))
    return "Call placed via AgentPhone";
  if (/agentphone\.(mock\.)?inbound_sms/i.test(name))
    return "Inbound SMS received";
  if (/agentphone\.(mock\.)?transcript/i.test(name))
    return "Call transcript loaded";
  if (/social\.(mock\.)?dm\.replied/i.test(name)) return "DM reply queued";
  if (
    /google_calendar\.events\.insert/i.test(name) ||
    /calendar\.(mock\.)?meeting/i.test(name)
  )
    return "Meeting booked";
  if (/supermemory\.(mock\.)?decision\.saved/i.test(name))
    return "Decision saved to company memory";
  if (/supermemory\.(mock\.)?memory\.searched/i.test(name))
    return "Company memory searched";
  return name;
}

export type { MockExternalAction };
