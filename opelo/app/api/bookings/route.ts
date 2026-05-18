import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/db/store";
import { Booking } from "@/lib/types";
import { nanoid } from "@/lib/integrations/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const booking = await store.getBooking(id);
    if (!booking) {
      return NextResponse.json({ error: "booking not found" }, { status: 404 });
    }
    return NextResponse.json({ booking });
  }
  const bookings = await store.listBookings();
  return NextResponse.json({ bookings });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : undefined;

    if (id) {
      const patch: Partial<Booking> = {};
      const fields: (keyof Booking)[] = [
        "customer_id",
        "customer_name",
        "event_date",
        "event_address",
        "guest_count",
        "setup_time",
        "drink_notes",
        "day_of_contact",
        "deposit_amount_cents",
        "deposit_link",
        "deposit_paid",
        "stage",
        "message_id",
      ];
      for (const f of fields) {
        if (body[f] !== undefined) {
          (patch as Record<string, unknown>)[f] = body[f];
        }
      }
      const updated = await store.updateBooking(id, patch);
      if (!updated) {
        return NextResponse.json({ error: "booking not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, booking: updated });
    }

    const now = new Date().toISOString();
    const booking: Booking = {
      id: nanoid("bkg"),
      customer_id: String(body.customer_id ?? ""),
      customer_name: String(body.customer_name ?? "Guest"),
      event_date: body.event_date,
      event_address: body.event_address,
      guest_count: body.guest_count,
      setup_time: body.setup_time,
      drink_notes: body.drink_notes,
      day_of_contact: body.day_of_contact,
      deposit_amount_cents: body.deposit_amount_cents,
      deposit_link: body.deposit_link,
      deposit_paid: Boolean(body.deposit_paid),
      stage: body.stage ?? "inquiry",
      message_id: String(body.message_id ?? ""),
      created_at: now,
      updated_at: now,
    };
    await store.addBooking(booking);
    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
