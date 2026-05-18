import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/db/store";
import { demoBusiness } from "@/lib/business";
import {
  sendOwnerUpdate as agentphoneSendOwnerUpdate,
  sendSMS as agentphoneSendSMS,
} from "@/lib/integrations/agentphone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bookingId = body.booking_id as string | undefined;
    if (!bookingId) {
      return NextResponse.json({ error: "booking_id required" }, { status: 400 });
    }

    const booking = await store.getBooking(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "booking not found" }, { status: 404 });
    }

    const customer = await store.getCustomer(booking.customer_id);
    const firstName = booking.customer_name.split(/\s+/)[0] || "there";
    const setup = booking.setup_time ?? "your scheduled time";
    const drinks = booking.drink_notes ? ` (${booking.drink_notes})` : "";

    const customerSms = `Hi ${firstName}! Just confirming tomorrow's coffee cart with ${demoBusiness.name} — starting around ${setup}. Could you send the full address and confirm the best person to meet on arrival?${drinks}`;

    const ownerSms = `Opelo: Tomorrow — ${booking.customer_name}${booking.event_date ? `, ${booking.event_date}` : ""}${booking.guest_count ? `, ${booking.guest_count} guests` : ""}${booking.drink_notes ? `, ${booking.drink_notes} requested` : ""}${booking.setup_time ? `, setup ${booking.setup_time}` : ""}${booking.day_of_contact ? `. Contact: ${booking.day_of_contact}` : ""}. Waiting on address confirmation.`;

    const actions = [];

    const to = customer?.phone;
    if (to) {
      actions.push(
        await agentphoneSendSMS({
          to,
          body: customerSms,
          live: customer.id.startsWith("cus_live_"),
        }),
      );
    }

    actions.push(await agentphoneSendOwnerUpdate(ownerSms));

    await store.updateBooking(bookingId, { stage: "day_before" });

    return NextResponse.json({
      ok: true,
      booking_id: bookingId,
      actions,
      customer_sms: customerSms,
      owner_sms: ownerSms,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
