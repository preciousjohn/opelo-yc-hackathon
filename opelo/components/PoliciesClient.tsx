"use client";

import { useEffect, useState } from "react";
import { Policies } from "@/lib/types";

export function PoliciesClient() {
  const [policies, setPolicies] = useState<Policies | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    fetch("/api/policies", { cache: "no-store" }).then((r) => r.json()).then(setPolicies);
  }, []);

  if (!policies) {
    return <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-stone-400">Loading policies…</div>;
  }

  const update = <K extends keyof Policies>(key: K, value: Policies[K]) => {
    setPolicies({ ...policies, [key]: value });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const r = await fetch("/api/policies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(policies) });
      const data = await r.json();
      setPolicies(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div>
        <div className="label">Policies</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
          Business rules your AI manager follows
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Edit the thresholds, lists, and copy below. Changes apply on the next message processed.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <NumberField label="Refund auto-approve threshold ($)" hint="Refunds strictly under this amount are auto-approved for customers without prior refunds." value={policies.refund_auto_approve_under} onChange={(v) => update("refund_auto_approve_under", v)} />
        <NumberField label="Auto-book qualified lead above ($)" hint="Leads with budgets at or above this amount are auto-booked onto your calendar." value={policies.auto_book_lead_above} onChange={(v) => update("auto_book_lead_above", v)} />
        <NumberField label="Minimum sponsorship price ($)" hint="Offers below this amount are counter-offered at the floor." value={policies.min_sponsorship_price} onChange={(v) => update("min_sponsorship_price", v)} />
        <NumberField label="Minimum project price ($)" hint="Consulting / project work is never discounted below this floor." value={policies.min_project_price} onChange={(v) => update("min_project_price", v)} />
      </div>

      <ListField label="VIP customer emails" hint="VIP customers always escalate to you before any rejection." values={policies.vip_customers} placeholder="founder@partnerco.com" onChange={(arr) => update("vip_customers", arr)} />
      <ListField label="Escalation keywords" hint="Words that flag a message for owner review instead of auto-reply." values={policies.escalation_keywords} placeholder="ridiculous" onChange={(arr) => update("escalation_keywords", arr)} />

      <div className="card p-5">
        <div className="label">Booking availability text</div>
        <p className="mt-1 text-xs text-stone-500">What Opelo says when a customer asks for a meeting (and the lead doesn't auto-book).</p>
        <textarea className="field mt-3 min-h-[88px]" value={policies.booking_availability} onChange={(e) => update("booking_availability", e.target.value)} />
      </div>

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3">
        {saved && <span className="pill border-emerald-200 bg-emerald-50 text-emerald-700">✓ Saved</span>}
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Save policies"}
        </button>
      </div>
    </div>
  );
}

function NumberField({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="card p-5">
      <label className="label">{label}</label>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-stone-400">$</span>
        <input type="number" className="field" value={value} min={0} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    </div>
  );
}

function ListField({ label, hint, values, onChange, placeholder }: { label: string; hint?: string; values: string[]; onChange: (next: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const add = () => { const t = input.trim(); if (!t || values.includes(t)) return; onChange([...values, t]); setInput(""); };
  const remove = (i: number) => onChange(values.filter((_, j) => j !== i));

  return (
    <div className="card p-5">
      <label className="label">{label}</label>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
      <div className="mt-3 flex gap-2">
        <input className="field" placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button onClick={add} className="btn shrink-0">Add</button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {values.length === 0 && <li className="text-xs text-stone-400">None yet.</li>}
        {values.map((v, i) => (
          <li key={v + i} className="pill border-stone-200 bg-stone-100 text-stone-700">
            <span>{v}</span>
            <button onClick={() => remove(i)} className="text-stone-400 transition hover:text-rose-500" aria-label={`remove ${v}`}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
