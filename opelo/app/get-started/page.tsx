"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GetStartedPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: `${name ? `Business: ${name}. ` : ""}${description}` }),
      });
      router.push("/inbox");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal header */}
      <header className="border-b border-stone-100 px-6 py-4 flex items-center">
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800 transition">← Back to home</Link>
      </header>

      <div className="flex items-center justify-center min-h-[calc(100vh-65px)]">
        <div className="w-full max-w-lg px-6 py-12">
          <div className="mb-8">
            <div className="text-4xl mb-4">👋</div>
            <h1 className="font-serif text-3xl text-stone-900">Let's set up Opelo for your business</h1>
            <p className="text-stone-500 mt-2">Tell us what you do and we'll configure your AI manager in seconds.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Your business name <span className="text-stone-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Brew Haven Coffee"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-300/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">What do you do? What should Opelo handle?</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                required
                placeholder="e.g. I run a photography studio. Approve refunds under $100, automatically book meetings with leads who have a budget above $500, and hold my pricing floor at $800 per session."
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-300/40 resize-none"
              />
              <p className="text-xs text-stone-400 mt-1.5">The more you share, the better Opelo handles things on your behalf.</p>
            </div>

            <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-3">Opelo will handle</p>
              <div className="grid grid-cols-2 gap-2">
                {["✅ Refund requests", "📅 Meeting bookings", "💬 Pricing questions", "🤝 Sponsorship offers"].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-stone-600">{item}</div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !description.trim()}
              className="w-full rounded-full py-3 text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ background: "#030303" }}
            >
              {loading ? "Setting up your AI manager…" : "Set up Opelo →"}
            </button>
          </form>

          <p className="text-xs text-stone-400 text-center mt-6">No credit card needed · You can change everything later in My Rules</p>
        </div>
      </div>
    </div>
  );
}
