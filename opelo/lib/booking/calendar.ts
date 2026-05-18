import { Booking } from "../types";
import { demoBusiness } from "../business";

function parseEventDateForCalendar(eventDate?: string): Date | null {
  if (!eventDate) return null;
  if (/tomorrow/i.test(eventDate)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const parsed = Date.parse(eventDate);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  const withYear = `${eventDate}, ${new Date().getFullYear()}`;
  const p2 = Date.parse(withYear);
  return Number.isNaN(p2) ? null : new Date(p2);
}

function parseSetupHour(setupTime?: string): { hour: number; minute: number } {
  if (!setupTime) return { hour: 9, minute: 0 };
  const m = setupTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return { hour: 9, minute: 0 };
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return { hour, minute };
}

function formatGoogleDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

export function googleCalendarUrl(booking: Booking): string {
  const start = parseEventDateForCalendar(booking.event_date) ?? new Date();
  const { hour, minute } = parseSetupHour(booking.setup_time);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

  const title = `${booking.customer_name} — ${demoBusiness.name}`;
  const details = [
    `Guests: ${booking.guest_count ?? "TBD"}`,
    booking.drink_notes ? `Drinks: ${booking.drink_notes}` : "",
    booking.day_of_contact ? `Day-of: ${booking.day_of_contact}` : "",
    booking.deposit_link ? `Deposit: ${booking.deposit_link}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
    details,
  });
  if (booking.event_address) params.set("location", booking.event_address);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function bookingFormUrl(bookingId: string, baseUrl?: string): string {
  const origin =
    baseUrl?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${origin}/book/${bookingId}`;
}
