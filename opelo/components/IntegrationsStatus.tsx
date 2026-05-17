"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

interface IntegrationStatus {
  key: string;
  label: string;
  mode: "live" | "mock";
  expects: string[];
  present: string[];
  missing: string[];
  note?: string;
}

interface LlmStatus {
  key: string;
  label: string;
  mode: "live" | "mock";
  provider: "openai" | "anthropic" | null;
  model: string | null;
  expects: string[];
  present: string[];
  note: string;
}

interface StatusResponse {
  ok: true;
  generated_at: string;
  llm: LlmStatus;
  integrations: IntegrationStatus[];
  summary: { live_count: number; total: number };
}

export function IntegrationsStatus() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      setData(await r.json());
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!data) {
    return (
      <div className="card-tight text-sm text-ink-400">
        Checking integrations…
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
        <div>
          <div className="label">Integrations</div>
          <div className="mt-0.5 text-xs text-ink-400">
            {data.summary.live_count} of {data.summary.total} live ·{" "}
            <span className="text-ink-500">
              determined by env vars present at request time
            </span>
          </div>
        </div>
        <button onClick={refresh} disabled={refreshing} className="btn">
          {refreshing ? "Checking…" : "Re-check"}
        </button>
      </div>

      <ul className="divide-y divide-ink-800/80">
        <Row item={llmAsItem(data.llm)} />
        {data.integrations.map((it) => (
          <Row key={it.key} item={it} />
        ))}
      </ul>
    </div>
  );
}

interface Row {
  key: string;
  label: string;
  mode: "live" | "mock";
  expects: string[];
  present: string[];
  missing: string[];
  note?: string;
  badge?: string;
}

function llmAsItem(llm: LlmStatus): Row {
  return {
    key: llm.key,
    label: llm.label,
    mode: llm.mode,
    expects: llm.expects,
    present: llm.present,
    missing: llm.expects.filter((e) => !llm.present.includes(e)),
    note: llm.note,
    badge: llm.provider
      ? `${llm.provider}${llm.model ? ` · ${llm.model}` : ""}`
      : undefined,
  };
}

function Row({ item }: { item: Row }) {
  const live = item.mode === "live";
  return (
    <li className="flex items-start gap-3 px-5 py-3">
      <span
        className={clsx(
          "mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full",
          live ? "bg-emerald-400" : "bg-ink-500",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink-100">{item.label}</span>
          <span
            className={clsx(
              "pill",
              live
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-ink-600 bg-ink-800 text-ink-200",
            )}
          >
            {live ? "Live" : "Mock"}
          </span>
          {item.badge && (
            <span className="pill border-accent/40 bg-accent/10 text-accent">
              {item.badge}
            </span>
          )}
        </div>
        {item.note && (
          <p className="mt-1 text-xs text-ink-400">{item.note}</p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.expects.map((e) => {
            const has = item.present.includes(e);
            return (
              <span
                key={e}
                className={clsx(
                  "rounded border px-1.5 py-0.5 font-mono text-[10px]",
                  has
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : "border-ink-700 bg-ink-900 text-ink-500",
                )}
                title={has ? "Present" : "Missing"}
              >
                {has ? "✓" : "○"} {e}
              </span>
            );
          })}
        </div>
      </div>
    </li>
  );
}
