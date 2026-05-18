import {
  ActionRecord,
  Booking,
  CompanyWallet,
  Customer,
  InboundMessage,
  OwnerSummary,
  Policies,
  WebhookEvent,
} from "../types";
import { nanoid } from "../integrations/util";
import { demoBusiness } from "../business";
import { createServiceClient } from "../supabase/service";

// Get a fresh Supabase client for each operation
function getClient() {
  return createServiceClient();
}

// Default policies for when the table is empty
function defaultPolicies(): Policies {
  return {
    refund_auto_approve_under: 5000,
    min_sponsorship_price: 50000,
    min_project_price: 100000,
    vip_customers: [],
    escalation_keywords: [],
    booking_availability: "Weekends preferred, 2 weeks notice",
    auto_book_lead_above: 200000,
    event_detail_fields: ["guest count", "setup time", "drink preferences"],
  };
}

// Default wallet for when the table is empty
function defaultWallet(): CompanyWallet {
  return {
    available_cents: 1250000,
    pending_cents: 0,
    refunded_today_cents: 0,
    revenue_generated_today_cents: 0,
    currency: "USD",
    updated_at: new Date().toISOString(),
  };
}

export const store = {
  /**
   * Single-business helpers — we only support one business profile in this
   * build. Read-through to demoBusiness + BUSINESS_DESCRIPTION env so the
   * dashboard can present an editable identity without a separate table.
   */
  async getBusinessName(): Promise<string> {
    return demoBusiness.name;
  },

  async getBusinessDescription(): Promise<string> {
    return (
      process.env.BUSINESS_DESCRIPTION?.trim() ||
      `${demoBusiness.name} — operated by ${demoBusiness.ownerName}.`
    );
  },

  async getPolicies(): Promise<Policies> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("policies")
      .select("*")
      .limit(1)
      .single();

    if (error || !data) {
      console.warn("[store] Failed to get policies, using defaults:", error?.message);
      return defaultPolicies();
    }

    return {
      refund_auto_approve_under: data.refund_auto_approve_under,
      min_sponsorship_price: data.min_sponsorship_price,
      min_project_price: data.min_project_price,
      vip_customers: data.vip_customers || [],
      escalation_keywords: data.escalation_keywords || [],
      booking_availability: data.booking_availability,
      auto_book_lead_above: data.auto_book_lead_above,
      event_detail_fields: data.event_detail_fields || [],
    };
  },

  async setPolicies(next: Policies): Promise<Policies> {
    const supabase = getClient();
    
    // Get existing policy row
    const { data: existing } = await supabase
      .from("policies")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      await supabase
        .from("policies")
        .update({
          ...next,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("policies").insert(next);
    }

    return next;
  },

  async listCustomers(): Promise<Customer[]> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[store] Failed to list customers:", error.message);
      return [];
    }

    return data || [];
  },

  async getCustomer(id: string): Promise<Customer | undefined> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;
    return data;
  },

  async upsertCustomer(c: Customer): Promise<Customer> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("customers")
      .upsert(c, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("[store] Failed to upsert customer:", error.message);
      return c;
    }

    return data || c;
  },

  async listMessages(): Promise<InboundMessage[]> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("received_at", { ascending: false });

    if (error) {
      console.error("[store] Failed to list messages:", error.message);
      return [];
    }

    return data || [];
  },

  async getMessage(id: string): Promise<InboundMessage | undefined> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;
    return data;
  },

  async addMessage(
    message: InboundMessage
  ): Promise<{ inserted: boolean; message: InboundMessage }> {
    const supabase = getClient();

    // Check for duplicate by id
    const { data: dupById } = await supabase
      .from("messages")
      .select("*")
      .eq("id", message.id)
      .single();

    if (dupById) return { inserted: false, message: dupById };

    // Check for duplicate by source_id
    if (message.source_id) {
      const { data: dupBySource } = await supabase
        .from("messages")
        .select("*")
        .eq("source_id", message.source_id)
        .single();

      if (dupBySource) return { inserted: false, message: dupBySource };
    }

    const { data, error } = await supabase
      .from("messages")
      .insert(message)
      .select()
      .single();

    if (error) {
      console.error("[store] Failed to add message:", error.message);
      return { inserted: false, message };
    }

    return { inserted: true, message: data || message };
  },

  async updateMessageStatus(
    id: string,
    status: InboundMessage["status"]
  ): Promise<void> {
    const supabase = getClient();
    await supabase.from("messages").update({ status }).eq("id", id);
  },

  async addAction(action: ActionRecord): Promise<ActionRecord> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("actions")
      .insert(action)
      .select()
      .single();

    if (error) {
      console.error("[store] Failed to add action:", error.message);
      return action;
    }

    return data || action;
  },

  async listActions(): Promise<ActionRecord[]> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("actions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[store] Failed to list actions:", error.message);
      return [];
    }

    return data || [];
  },

  async addOwnerSummary(s: OwnerSummary): Promise<OwnerSummary> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("owner_summaries")
      .insert(s)
      .select()
      .single();

    if (error) {
      console.error("[store] Failed to add owner summary:", error.message);
      return s;
    }

    return data || s;
  },

  async listOwnerSummaries(): Promise<OwnerSummary[]> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("owner_summaries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[store] Failed to list owner summaries:", error.message);
      return [];
    }

    return data || [];
  },

  async getWallet(): Promise<CompanyWallet> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("wallet")
      .select("*")
      .limit(1)
      .single();

    if (error || !data) {
      console.warn("[store] Failed to get wallet, using defaults:", error?.message);
      return defaultWallet();
    }

    return {
      available_cents: data.available_cents,
      pending_cents: data.pending_cents,
      refunded_today_cents: data.refunded_today_cents,
      revenue_generated_today_cents: data.revenue_generated_today_cents,
      currency: data.currency,
      updated_at: data.updated_at,
    };
  },

  async applyRefund(amountCents: number): Promise<CompanyWallet> {
    const supabase = getClient();
    const wallet = await this.getWallet();
    const cents = Math.max(0, Math.round(amountCents));

    const updated = {
      available_cents: Math.max(0, wallet.available_cents - cents),
      refunded_today_cents: wallet.refunded_today_cents + cents,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("wallet")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      await supabase.from("wallet").update(updated).eq("id", existing.id);
    }

    return { ...wallet, ...updated };
  },

  async applyPaymentLinkCreated(amountCents: number): Promise<CompanyWallet> {
    const supabase = getClient();
    const wallet = await this.getWallet();
    const cents = Math.max(0, Math.round(amountCents));

    const updated = {
      pending_cents: wallet.pending_cents + cents,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("wallet")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      await supabase.from("wallet").update(updated).eq("id", existing.id);
    }

    return { ...wallet, ...updated };
  },

  async applyRevenueGenerated(amountCents: number): Promise<CompanyWallet> {
    const supabase = getClient();
    const wallet = await this.getWallet();
    const cents = Math.max(0, Math.round(amountCents));

    const updated = {
      revenue_generated_today_cents: wallet.revenue_generated_today_cents + cents,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("wallet")
      .select("id")
      .limit(1)
      .single();

    if (existing) {
      await supabase.from("wallet").update(updated).eq("id", existing.id);
    }

    return { ...wallet, ...updated };
  },

  async addWebhookEvent(
    event: Omit<WebhookEvent, "id" | "created_at"> & {
      id?: string;
      created_at?: string;
    }
  ): Promise<WebhookEvent> {
    const supabase = getClient();
    const full: WebhookEvent = {
      id: event.id ?? nanoid("wh"),
      created_at: event.created_at ?? new Date().toISOString(),
      provider: event.provider,
      event_type: event.event_type,
      payload: event.payload,
      parsed_kind: event.parsed_kind,
      inserted_message_id: event.inserted_message_id,
    };

    const { data, error } = await supabase
      .from("webhook_events")
      .insert(full)
      .select()
      .single();

    if (error) {
      console.error("[store] Failed to add webhook event:", error.message);
      return full;
    }

    return data || full;
  },

  async updateWebhookEvent(
    id: string,
    patch: Partial<Pick<WebhookEvent, "parsed_kind" | "inserted_message_id">>
  ): Promise<WebhookEvent | null> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("webhook_events")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[store] Failed to update webhook event:", error.message);
      return null;
    }

    return data;
  },

  async listWebhookEvents(provider?: string): Promise<WebhookEvent[]> {
    const supabase = getClient();
    let query = supabase
      .from("webhook_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (provider) {
      query = query.eq("provider", provider);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[store] Failed to list webhook events:", error.message);
      return [];
    }

    return data || [];
  },

  // Note: pending_inbound is not used in production - messages come via webhooks
  async dequeueNextPending(): Promise<InboundMessage | null> {
    return null;
  },

  async pendingInboundCount(): Promise<number> {
    return 0;
  },

  async reset(): Promise<void> {
    const supabase = getClient();
    // Clear all tables (be careful with this in production!)
    await supabase.from("bookings").delete().neq("id", "");
    await supabase.from("actions").delete().neq("id", "");
    await supabase.from("messages").delete().neq("id", "");
    await supabase.from("customers").delete().neq("id", "");
    await supabase.from("webhook_events").delete().neq("id", "");
    await supabase.from("owner_summaries").delete().neq("id", "");
    console.log("[store] Reset complete");
  },

  async listBookings(): Promise<Booking[]> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("event_date", { ascending: true });

    if (error) {
      console.error("[store] Failed to list bookings:", error.message);
      return [];
    }

    return data || [];
  },

  async getBooking(id: string): Promise<Booking | undefined> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return undefined;
    return data;
  },

  async getBookingByCustomer(customerId: string): Promise<Booking | undefined> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return undefined;
    return data;
  },

  async addBooking(booking: Booking): Promise<Booking> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("bookings")
      .insert(booking)
      .select()
      .single();

    if (error) {
      console.error("[store] Failed to add booking:", error.message);
      return booking;
    }

    return data || booking;
  },

  async updateBooking(
    id: string,
    patch: Partial<Booking>
  ): Promise<Booking | null> {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("bookings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[store] Failed to update booking:", error.message);
      return null;
    }

    return data;
  },
};
