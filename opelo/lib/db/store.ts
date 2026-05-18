import { promises as fs } from "fs";
import path from "path";
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
import {
  defaultPolicies,
  seedActions,
  seedBookings,
  seedCustomers,
  seedMessages,
  seedPendingInbound,
  seedWallet,
} from "./seed";

const DATA_DIR = path.join(process.cwd(), ".opelo-data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

interface Snapshot {
  policies: Policies;
  customers: Customer[];
  messages: InboundMessage[];
  actions: ActionRecord[];
  owner_summaries: OwnerSummary[];
  pending_inbound: InboundMessage[];
  wallet: CompanyWallet;
  webhook_events: WebhookEvent[];
  bookings: Booking[];
}

let cache: Snapshot | null = null;
let writeLock: Promise<void> = Promise.resolve();

function initial(): Snapshot {
  return {
    policies: defaultPolicies(),
    customers: seedCustomers(),
    messages: seedMessages(),
    actions: seedActions(),
    owner_summaries: [],
    pending_inbound: seedPendingInbound(),
    wallet: seedWallet(),
    webhook_events: [],
    bookings: seedBookings(),
  };
}

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

async function readSnapshot(): Promise<Snapshot> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    cache = JSON.parse(raw) as Snapshot;
    if (!cache.owner_summaries) cache.owner_summaries = [];
    if (!cache.pending_inbound) cache.pending_inbound = seedPendingInbound();
    if (!cache.wallet) cache.wallet = seedWallet();
    if (!cache.webhook_events) cache.webhook_events = [];
    if (!cache.bookings) cache.bookings = seedBookings();
    return cache;
  } catch {
    cache = initial();
    await persist();
    return cache;
  }
}

async function persist(): Promise<void> {
  if (!cache) return;
  await ensureDir();
  const data = JSON.stringify(cache, null, 2);
  await fs.writeFile(DATA_FILE, data, "utf8");
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeLock;
  let release: () => void = () => {};
  writeLock = new Promise<void>((res) => (release = res));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export const store = {
  async getPolicies(): Promise<Policies> {
    const snap = await readSnapshot();
    return snap.policies;
  },
  async setPolicies(next: Policies): Promise<Policies> {
    return withLock(async () => {
      const snap = await readSnapshot();
      snap.policies = next;
      await persist();
      return snap.policies;
    });
  },
  async listCustomers(): Promise<Customer[]> {
    const snap = await readSnapshot();
    return snap.customers;
  },
  async getCustomer(id: string): Promise<Customer | undefined> {
    const snap = await readSnapshot();
    return snap.customers.find((c) => c.id === id);
  },
  async upsertCustomer(c: Customer): Promise<Customer> {
    return withLock(async () => {
      const snap = await readSnapshot();
      const idx = snap.customers.findIndex((x) => x.id === c.id);
      if (idx >= 0) snap.customers[idx] = c;
      else snap.customers.push(c);
      await persist();
      return c;
    });
  },
  async listMessages(): Promise<InboundMessage[]> {
    const snap = await readSnapshot();
    return [...snap.messages].sort((a, b) =>
      b.received_at.localeCompare(a.received_at),
    );
  },
  async getMessage(id: string): Promise<InboundMessage | undefined> {
    const snap = await readSnapshot();
    return snap.messages.find((m) => m.id === id);
  },
  async addMessage(
    message: InboundMessage,
  ): Promise<{ inserted: boolean; message: InboundMessage }> {
    return withLock(async () => {
      const snap = await readSnapshot();
      const dupById = snap.messages.find((m) => m.id === message.id);
      if (dupById) return { inserted: false, message: dupById };
      if (message.source_id) {
        const dupBySource = snap.messages.find(
          (m) => m.source_id === message.source_id,
        );
        if (dupBySource) return { inserted: false, message: dupBySource };
      }
      snap.messages.push(message);
      await persist();
      return { inserted: true, message };
    });
  },
  async updateMessageStatus(
    id: string,
    status: InboundMessage["status"],
  ): Promise<void> {
    return withLock(async () => {
      const snap = await readSnapshot();
      const m = snap.messages.find((x) => x.id === id);
      if (m) m.status = status;
      await persist();
    });
  },
  async addAction(action: ActionRecord): Promise<ActionRecord> {
    return withLock(async () => {
      const snap = await readSnapshot();
      snap.actions.unshift(action);
      await persist();
      return action;
    });
  },
  async listActions(): Promise<ActionRecord[]> {
    const snap = await readSnapshot();
    return [...snap.actions].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  },
  async addOwnerSummary(s: OwnerSummary): Promise<OwnerSummary> {
    return withLock(async () => {
      const snap = await readSnapshot();
      snap.owner_summaries.unshift(s);
      await persist();
      return s;
    });
  },
  async listOwnerSummaries(): Promise<OwnerSummary[]> {
    const snap = await readSnapshot();
    return snap.owner_summaries;
  },
  async getWallet(): Promise<CompanyWallet> {
    const snap = await readSnapshot();
    return snap.wallet;
  },
  async applyRefund(amountCents: number): Promise<CompanyWallet> {
    return withLock(async () => {
      const snap = await readSnapshot();
      const cents = Math.max(0, Math.round(amountCents));
      snap.wallet.available_cents = Math.max(
        0,
        snap.wallet.available_cents - cents,
      );
      snap.wallet.refunded_today_cents += cents;
      snap.wallet.updated_at = new Date().toISOString();
      await persist();
      return snap.wallet;
    });
  },
  async applyPaymentLinkCreated(amountCents: number): Promise<CompanyWallet> {
    return withLock(async () => {
      const snap = await readSnapshot();
      const cents = Math.max(0, Math.round(amountCents));
      // Pending = pipeline created via a payment link. Available is unchanged
      // because the customer hasn't paid yet.
      snap.wallet.pending_cents += cents;
      snap.wallet.updated_at = new Date().toISOString();
      await persist();
      return snap.wallet;
    });
  },
  async applyRevenueGenerated(amountCents: number): Promise<CompanyWallet> {
    return withLock(async () => {
      const snap = await readSnapshot();
      const cents = Math.max(0, Math.round(amountCents));
      snap.wallet.revenue_generated_today_cents += cents;
      snap.wallet.updated_at = new Date().toISOString();
      await persist();
      return snap.wallet;
    });
  },
  async addWebhookEvent(
    event: Omit<WebhookEvent, "id" | "created_at"> & {
      id?: string;
      created_at?: string;
    },
  ): Promise<WebhookEvent> {
    return withLock(async () => {
      const snap = await readSnapshot();
      const full: WebhookEvent = {
        id: event.id ?? nanoid("wh"),
        created_at: event.created_at ?? new Date().toISOString(),
        provider: event.provider,
        event_type: event.event_type,
        payload: event.payload,
        parsed_kind: event.parsed_kind,
        inserted_message_id: event.inserted_message_id,
      };
      snap.webhook_events.unshift(full);
      // Cap to last 200 to keep the store readable.
      if (snap.webhook_events.length > 200) {
        snap.webhook_events.length = 200;
      }
      await persist();
      return full;
    });
  },
  async updateWebhookEvent(
    id: string,
    patch: Partial<Pick<WebhookEvent, "parsed_kind" | "inserted_message_id">>,
  ): Promise<WebhookEvent | null> {
    return withLock(async () => {
      const snap = await readSnapshot();
      const e = snap.webhook_events.find((w) => w.id === id);
      if (!e) return null;
      if (patch.parsed_kind !== undefined) e.parsed_kind = patch.parsed_kind;
      if (patch.inserted_message_id !== undefined)
        e.inserted_message_id = patch.inserted_message_id;
      await persist();
      return e;
    });
  },
  async listWebhookEvents(provider?: string): Promise<WebhookEvent[]> {
    const snap = await readSnapshot();
    const events = provider
      ? snap.webhook_events.filter((e) => e.provider === provider)
      : snap.webhook_events;
    return [...events];
  },
  async dequeueNextPending(): Promise<InboundMessage | null> {
    return withLock(async () => {
      const snap = await readSnapshot();
      const next = snap.pending_inbound.shift();
      if (!next) return null;
      next.received_at = new Date().toISOString();
      next.status = "new";
      snap.messages.push(next);
      await persist();
      return next;
    });
  },
  async pendingInboundCount(): Promise<number> {
    const snap = await readSnapshot();
    return snap.pending_inbound.length;
  },
  async reset(): Promise<void> {
    return withLock(async () => {
      cache = initial();
      await persist();
    });
  },
  async listBookings(): Promise<Booking[]> {
    const snap = await readSnapshot();
    return [...snap.bookings].sort((a, b) => {
      const da = a.event_date ?? "";
      const db = b.event_date ?? "";
      if (da && db && da !== db) return da.localeCompare(db);
      return b.updated_at.localeCompare(a.updated_at);
    });
  },
  async getBooking(id: string): Promise<Booking | undefined> {
    const snap = await readSnapshot();
    return snap.bookings.find((b) => b.id === id);
  },
  async getBookingByCustomer(customerId: string): Promise<Booking | undefined> {
    const snap = await readSnapshot();
    return snap.bookings.find((b) => b.customer_id === customerId);
  },
  async addBooking(booking: Booking): Promise<Booking> {
    return withLock(async () => {
      const snap = await readSnapshot();
      snap.bookings.unshift(booking);
      await persist();
      return booking;
    });
  },
  async updateBooking(
    id: string,
    patch: Partial<Booking>,
  ): Promise<Booking | null> {
    return withLock(async () => {
      const snap = await readSnapshot();
      const b = snap.bookings.find((x) => x.id === id);
      if (!b) return null;
      Object.assign(b, patch, { updated_at: new Date().toISOString() });
      await persist();
      return b;
    });
  },
};
