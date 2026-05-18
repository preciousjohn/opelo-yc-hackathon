"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Booking } from "@/lib/types";
import { demoBusiness } from "@/lib/business";

export default function BookFormPage() {
  const params = useParams();
  const bookingId = String(params.id ?? "");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventDate, setEventDate] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [setupTime, setSetupTime] = useState("");
  const [drinkNotes, setDrinkNotes] = useState("");
  const [dayOfContact, setDayOfContact] = useState("");

  useEffect(() => {
    fetch(`/api/bookings?id=${encodeURIComponent(bookingId)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.booking) {
          const b = data.booking as Booking;
          setBooking(b);
          setEventDate(b.event_date ?? "");
          setEventAddress(b.event_address ?? "");
          setGuestCount(b.guest_count ? String(b.guest_count) : "");
          setSetupTime(b.setup_time ?? "");
          setDrinkNotes(b.drink_notes ?? "");
          setDayOfContact(b.day_of_contact ?? "");
        } else {
          setError("Booking not found");
        }
      })
      .catch(() => setError("Could not load booking"))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bookingId,
          event_date: eventDate,
          event_address: eventAddress,
          guest_count: guestCount ? parseInt(guestCount, 10) : undefined,
          setup_time: setupTime,
          drink_notes: drinkNotes,
          day_of_contact: dayOfContact,
          stage: "details_needed",
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-500">
        Loading…
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 text-center">
        <p className="text-stone-600">{error}</p>
        <Link href="/" className="mt-4 text-sm text-stone-800 underline">
          Back to {demoBusiness.name}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 text-center">
        <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-card">
          <div className="text-4xl mb-3">✓</div>
          <h1 className="font-serif text-2xl text-stone-900">You&apos;re all set</h1>
          <p className="mt-2 text-sm text-stone-500 leading-relaxed">
            Thanks{booking ? `, ${booking.customer_name.split(" ")[0]}` : ""}! We have your
            event details and will confirm your date shortly.
          </p>
          {booking?.deposit_link && !booking.deposit_paid && (
            <a
              href={booking.deposit_link}
              className="btn-primary mt-6 inline-block"
            >
              Pay deposit to hold your date
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800">
          {demoBusiness.name}
        </Link>
        <h1 className="mt-4 font-serif text-3xl text-stone-900">
          Event details
        </h1>
        <p className="mt-2 text-sm text-stone-500 leading-relaxed">
          Hi{booking ? ` ${booking.customer_name.split(" ")[0]}` : ""} — tell us about
          your event so we can get the cart ready.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-card"
        >
          <Field label="Event date" value={eventDate} onChange={setEventDate} placeholder="June 12, 2026" />
          <Field label="Event address" value={eventAddress} onChange={setEventAddress} placeholder="123 Main St, Palo Alto" />
          <Field label="Guest count" value={guestCount} onChange={setGuestCount} placeholder="80" type="number" />
          <Field label="Setup time" value={setupTime} onChange={setSetupTime} placeholder="3:30 PM" />
          <Field label="Drink preferences" value={drinkNotes} onChange={setDrinkNotes} placeholder="Oat milk, lavender lattes" />
          <Field label="Day-of contact (name + phone)" value={dayOfContact} onChange={setDayOfContact} placeholder="Mike, 415-555-0123" />

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Saving…" : "Submit event details"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field mt-1.5 w-full"
      />
    </label>
  );
}
