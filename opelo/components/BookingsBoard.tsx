"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Booking, BookingStage } from "@/lib/types";
import { googleCalendarUrl } from "@/lib/booking/calendar";
import { demoBusiness } from "@/lib/business";

const STAGES: { id: BookingStage; label: string }[] = [
  { id: "inquiry", label: "Inquiry" },
  { id: "details_needed", label: "Details needed" },
  { id: "deposit_sent", label: "Deposit sent" },
  { id: "confirmed", label: "Confirmed" },
  { id: "day_before", label: "Day before" },
  { id: "complete", label: "Complete" },
];

const STAGE_TONE: Record<BookingStage, string> = {
  inquiry: "border-stone-200 bg-stone-50 text-stone-600",
  details_needed: "border-amber-200 bg-amber-50 text-amber-700",
  deposit_sent: "border-sky-200 bg-sky-50 text-sky-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  day_before: "border-violet-200 bg-violet-50 text-violet-700",
  complete: "border-stone-200 bg-stone-100 text-stone-500",
};

export function BookingsBoard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reminding, setReminding] = useState(false);

  const fetchBookings = useCallback(async () => {
    const r = await fetch("/api/bookings", { cache: "no-store" });
    const data = await r.json();
    const list: Booking[] = data.bookings ?? [];
    setBookings(list);
    setSelectedId((prev) => prev ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    fetchBookings();
    const t = setInterval(fetchBookings, 8000);
    return () => clearInterval(t);
  }, [fetchBookings]);

  const selected = useMemo(
    () => bookings.find((b) => b.id === selectedId) ?? null,
    [bookings, selectedId],
  );

  const byStage = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    for (const s of STAGES) map[s.id] = [];
    for (const b of bookings) {
      const key = map[b.stage] ? b.stage : "inquiry";
      map[key].push(b);
    }
    return map;
  }, [bookings]);

  const updateStage = async (
    id: string,
    stage: BookingStage,
    deposit_paid?: boolean,
  ) => {
    setLoading(true);
    try {
      await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          stage,
          ...(deposit_paid !== undefined ? { deposit_paid } : {}),
        }),
      });
      await fetchBookings();
    } finally {
      setLoading(false);
    }
  };

  const sendReminder = async (id: string) => {
    setReminding(true);
    try {
      const r = await fetch("/api/bookings/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: id }),
      });
      const data = await r.json();
      if (!r.ok) {
        alert(data.error ?? "Failed to send reminder");
        return;
      }
      await fetchBookings();
    } finally {
      setReminding(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-ink-800/80 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-ink-100">
            Event bookings
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {demoBusiness.name} · inquiry → deposit → confirmed
          </p>
        </div>
        <button type="button" className="btn text-xs" onClick={() => fetchBookings()}>
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto p-4">
        <div className="flex min-w-[720px] gap-3">
          {STAGES.map((col) => (
            <div key={col.id} className="w-36 shrink-0">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {col.label}
              </div>
              <div className="space-y-2">
                {(byStage[col.id] ?? []).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className={clsx(
                      "w-full rounded-lg border p-2.5 text-left transition",
                      selectedId === b.id
                        ? "border-accent/50 bg-accent/10"
                        : "border-ink-800 bg-ink-950/40 hover:border-ink-700",
                    )}
                  >
                    <div className="truncate text-xs font-medium text-ink-100">
                      {b.customer_name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink-500">
                      {b.event_date ?? "Date TBD"}
                    </div>
                    {b.guest_count ? (
                      <div className="text-[10px] text-ink-400">
                        {b.guest_count} guests
                      </div>
                    ) : null}
                  </button>
                ))}
                {(byStage[col.id] ?? []).length === 0 && (
                  <div className="py-4 text-center text-[10px] text-ink-600">—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="space-y-3 border-t border-ink-800/80 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink-100">
              {selected.customer_name}
            </span>
            <span className={clsx("pill text-[10px]", STAGE_TONE[selected.stage])}>
              {selected.stage.replace(/_/g, " ")}
            </span>
            <span
              className={clsx(
                "pill text-[10px]",
                selected.deposit_paid
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-200",
              )}
            >
              {selected.deposit_paid ? "Deposit paid" : "Awaiting deposit"}
            </span>
          </div>

          <dl className="grid gap-1 text-xs text-ink-300 sm:grid-cols-2">
            {selected.event_date && (
              <>
                <dt className="text-ink-500">Event date</dt>
                <dd>{selected.event_date}</dd>
              </>
            )}
            {selected.event_address && (
              <>
                <dt className="text-ink-500">Address</dt>
                <dd>{selected.event_address}</dd>
              </>
            )}
            {selected.setup_time && (
              <>
                <dt className="text-ink-500">Setup</dt>
                <dd>{selected.setup_time}</dd>
              </>
            )}
            {selected.drink_notes && (
              <>
                <dt className="text-ink-500">Drinks</dt>
                <dd>{selected.drink_notes}</dd>
              </>
            )}
            {selected.day_of_contact && (
              <>
                <dt className="text-ink-500">Day-of contact</dt>
                <dd>{selected.day_of_contact}</dd>
              </>
            )}
          </dl>

          <div className="flex flex-wrap gap-2 pt-1">
            {selected.deposit_link && (
              <a
                href={selected.deposit_link}
                target="_blank"
                rel="noreferrer"
                className="btn text-xs"
              >
                Open deposit link
              </a>
            )}
            <a
              href={googleCalendarUrl(selected)}
              target="_blank"
              rel="noreferrer"
              className="btn text-xs"
            >
              Add to Calendar
            </a>
            <button
              type="button"
              disabled={loading}
              className="btn text-xs"
              onClick={() => updateStage(selected.id, "confirmed", true)}
            >
              Mark confirmed
            </button>
            <button
              type="button"
              disabled={reminding}
              className="btn-primary text-xs"
              onClick={() => sendReminder(selected.id)}
            >
              {reminding ? "Sending…" : "Send day-before reminder"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
