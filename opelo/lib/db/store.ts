import { promises as fs } from "fs";
import path from "path";
import {
  ActionRecord,
  Customer,
  InboundMessage,
  OwnerSummary,
  Policies,
} from "../types";
import { defaultPolicies, seedCustomers, seedMessages } from "./seed";

const DATA_DIR = path.join(process.cwd(), ".opelo-data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

interface Snapshot {
  policies: Policies;
  customers: Customer[];
  messages: InboundMessage[];
  actions: ActionRecord[];
  owner_summaries: OwnerSummary[];
}

let cache: Snapshot | null = null;
let writeLock: Promise<void> = Promise.resolve();

function initial(): Snapshot {
  return {
    policies: defaultPolicies(),
    customers: seedCustomers(),
    messages: seedMessages(),
    actions: [],
    owner_summaries: [],
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
    // hydrate any new fields if seed expanded later
    if (!cache.owner_summaries) cache.owner_summaries = [];
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
  async reset(): Promise<void> {
    return withLock(async () => {
      cache = initial();
      await persist();
    });
  },
};
