import Link from "next/link";
import { demoBusiness } from "@/lib/business";

const capabilities = [
  {
    title: "Refunds via Sponge",
    body: "Approves clean refunds under your threshold through Sponge. Escalates abuse and VIPs to you.",
  },
  {
    title: "Pricing exceptions",
    body: "Holds your floor on consulting. Issues a Sponge payment link for a smaller scope instead of discounting.",
  },
  {
    title: "Sponsorships",
    body: "Counter-offers below-floor brand deals at your floor with a Sponge payment link attached.",
  },
  {
    title: "Qualified leads",
    body: "Books high-budget leads (phone, email, DM) onto your calendar automatically.",
  },
  {
    title: "Multi-channel intake",
    body: "Listens across email, SMS, AgentPhone call transcripts, and social DMs — one inbox.",
  },
  {
    title: "Owner updates via AgentPhone",
    body: "Detects escalations and texts you in real time through AgentPhone so nothing slips.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="relative pt-10">
        <div className="absolute -inset-x-10 -top-20 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-accent/20 blur-3xl" />
        <div className="flex flex-col items-center text-center">
          <span className="pill border-accent/30 bg-accent/10 text-accent">
            <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            {demoBusiness.name} · demo running in mock mode
          </span>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight sm:text-6xl">
            AI middle management for{" "}
            <span className="bg-gradient-to-r from-accent to-accent-soft bg-clip-text text-transparent">
              one-person businesses.
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-balance text-lg text-ink-300">
            Delegate operational judgment — refunds, pricing exceptions,
            sponsorships, scheduling, and escalations — to an AI manager that
            follows <em>your</em> business policies.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/inbox" className="btn-primary shine">
              Run demo workflow
              <Arrow />
            </Link>
            <Link href="/dashboard" className="btn">
              See dashboard
            </Link>
            <Link href="/policies" className="btn">
              Edit policies
            </Link>
          </div>
          <div className="mt-3 text-xs text-ink-500">
            No login. No API keys required. Sponge · AgentPhone · AgentMail · Calendar run in mock mode by default.
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {capabilities.map((c) => (
          <div key={c.title} className="card-tight">
            <div className="label">{c.title}</div>
            <p className="mt-2 text-sm text-ink-200">{c.body}</p>
          </div>
        ))}
      </section>

      <section className="card p-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="label">How it works</div>
            <h2 className="mt-1 text-2xl font-semibold">
              One pipeline. Six decisions. Every action logged.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-300">
              Inbound message → classification → policy check → decision →
              external action (refund / reply / booking / SMS) → owner summary.
              Watch it run in the Inbox tab.
            </p>
          </div>
          <Link href="/inbox" className="btn-primary">
            Open Inbox
            <Arrow />
          </Link>
        </div>

        <ol className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            "Inbound",
            "Classify",
            "Policy",
            "Decide",
            "Act",
            "Notify",
          ].map((s, i) => (
            <li
              key={s}
              className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900/70 px-3 py-3 text-sm"
            >
              <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/20 font-mono text-xs text-accent">
                {i + 1}
              </span>
              <span className="text-ink-100">{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
