import { Booking, Customer, InboundMessage } from "../types";
import { store } from "../db/store";
import { demoBusiness } from "../business";
import { nanoid } from "../integrations/util";
import {
  createPaymentLink as spongeCreatePaymentLink,
} from "../integrations/sponge";
import { extractEventDetails } from "./extract";
import { bookingFormUrl } from "./calendar";

interface DepositFlowInput {
  message: InboundMessage;
  customer: Customer;
  depositDollars: number;
}

export interface DepositFlowResult {
  booking: Booking;
  appendix: string;
}

export async function createDepositBookingFlow(
  input: DepositFlowInput,
): Promise<DepositFlowResult> {
  const { message, customer, depositDollars } = input;
  const details = extractEventDetails(`${message.subject}\n${message.body}`);
  const bookingId = nanoid("bkg");
  const depositCents = Math.round(depositDollars * 100);

  const spongeResp = await spongeCreatePaymentLink({
    amountCents: depositCents,
    description: `Event deposit — ${demoBusiness.name}`,
    customerEmail: customer.email,
  });

  const formUrl = bookingFormUrl(bookingId);
  const now = new Date().toISOString();

  const booking = await store.addBooking({
    id: bookingId,
    customer_id: customer.id,
    customer_name: customer.name,
    event_date: details.date,
    event_address: details.address,
    guest_count: details.guestCount,
    drink_notes: details.drinkNotes,
    deposit_amount_cents: depositCents,
    deposit_link: spongeResp.data.url,
    deposit_paid: false,
    stage: "deposit_sent",
    message_id: message.id,
    created_at: now,
    updated_at: now,
  });

  const appendix = [
    "",
    `To hold your date, pay your deposit here: ${spongeResp.data.url}`,
    `Fill out your event details so we can get everything ready: ${formUrl}`,
  ].join("\n");

  return { booking, appendix };
}
