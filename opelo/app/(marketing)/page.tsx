import Image from "next/image";
import Link from "next/link";
import { CTAInput } from "@/components/CTAInput";
import { RotatingWord } from "@/components/RotatingWord";
import { SeeDemoButton } from "@/components/SeeDemoButton";

const features = [
  {
    title: "Operational judgment,\nnot just automation",
    body: "Learns your pricing floor, refund policy, and VIP clients — then makes the right call on every request without asking you twice.",
  },
  {
    title: "Every channel,\none inbox",
    body: "Email, SMS, voice calls, DMs, inquiry forms — all handled in one place before anything falls through the cracks.",
  },
  {
    title: "It remembers\ncontextually, for you",
    body: "Memory that compounds. Remembers every client interaction. The longer it runs, the better it knows your business and your people.",
  },
  {
    title: "Finds new clients\nwhile you're busy",
    body: "Proactively sources leads that match your business, drafts personalized outreach, and queues them for your review.",
  },
];

export default function HomePage() {
  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pt-10 pb-16">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" style={{ minHeight: "580px" }}>

          {/* Left box */}
          <div className="relative flex flex-col justify-start overflow-hidden rounded-3xl bg-stone-50 p-10 lg:p-14">
            <div>
              <h1 className="font-serif leading-[1.08] text-stone-800" style={{ fontSize: "70px" }}>
                Make great <RotatingWord />
                <br />
                <span className="text-stone-500">
                  Opelo handles
                  <br />
                  everything else
                </span>
              </h1>
              <p className="mt-6 max-w-sm text-base leading-relaxed text-stone-500">
                Delegate refunds, pricing exceptions, sponsorships, scheduling,
                &amp; escalations to an AI manager that follows your business policies.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/get-started" className="btn-primary">Get Started</Link>
                <SeeDemoButton />
              </div>
            </div>

            {/* Rating — bottom-right, half-clipped by overflow-hidden */}
            <div className="pointer-events-none absolute" style={{ bottom: "-24px", right: "-12px", width: "210px" }}>
              <Image src="/rating.svg" alt="" width={250} height={205} unoptimized className="h-auto w-full" />
            </div>
          </div>

          {/* Right box — lime green */}
          <div className="relative overflow-hidden rounded-3xl bg-lime-300" style={{ minHeight: "520px" }}>
            <Image
              src="/phone-hero.png"
              alt="Opelo app interface"
              width={480}
              height={820}
              priority
              style={{ position: "absolute", bottom: "-80px", right: "10px", filter: "drop-shadow(0 25px 25px rgba(0,0,0,0.15))" }}
            />
          </div>
        </div>
      </section>

      {/* ── Tagline ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h2 className="max-w-4xl font-serif text-4xl leading-[1.2] text-stone-800 lg:text-5xl">
          Built for how solo to small teams &amp; businesses actually work.
          Everything you need to handle operations, keep clients happy, and
          grow&nbsp;— in one place.
        </h2>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="flex min-h-[300px] flex-col rounded-2xl bg-stone-100 p-7 transition hover:bg-stone-200/60">
              <h3 className="whitespace-pre-line font-serif leading-snug text-stone-900" style={{ fontSize: "32px" }}>
                {f.title}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-stone-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="py-16 text-center">
          <h2 className="font-serif text-4xl text-stone-900 lg:text-5xl">
            Tell Opelo about your business
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-stone-500">
            Describe your business once, let Opelo learn your rules for operations
          </p>

          <CTAInput />
        </div>
      </section>

      {/* ── Copyright — sits completely above the watermark ──── */}
      <div className="pb-1 text-center">
        <p className="text-xs text-stone-400">
          © {new Date().getFullYear()} Opelo · AI middle management for one-person businesses
        </p>
      </div>

      {/* ── Watermark — own container, no z-index fights ─────── */}
      {/*
        text-lime-300 (#bef264) is clearly visible on white.
        At font-size 1000px, cap letters start ≈50px into the line box and
        run to ≈750px. A 380px container shows ≈330/700 ≈ 47% of cap height
        from the very top — just under half, which is the desired half-shown look.
      */}
      <div className="overflow-hidden" style={{ height: "520px" }}>
        <p
          aria-hidden
          className="pointer-events-none select-none whitespace-nowrap text-center font-serif"
          style={{
            fontSize: "900px",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: "#c8f07a",   /* visible soft lime, not #ecfccb which is invisible */
          }}
        >
          Opelo
        </p>
      </div>
    </div>
  );
}
