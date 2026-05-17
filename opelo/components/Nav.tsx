"use client";

import Link from "next/link";
import { OpeloWordmark } from "@/components/OpeloWordmark";

export function Nav() {
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: "rgba(255,255,255,0.55)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderBottom: "1px solid rgba(255,255,255,0.4)",
        boxShadow: "0 1px 24px rgba(0,0,0,0.04)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="shrink-0">
          <OpeloWordmark />
        </Link>

        {/* Nav links */}
        <nav className="hidden items-center gap-8 md:flex">
          <Link href="/#features" className="text-sm text-stone-500 transition hover:text-stone-900">
            Features
          </Link>
          <Link href="/pricing" className="text-sm text-stone-500 transition hover:text-stone-900">
            Pricing
          </Link>
          <Link href="/company" className="text-sm text-stone-500 transition hover:text-stone-900">
            Company
          </Link>
        </nav>

        {/* CTA */}
        <Link
          href="/inbox"
          className="rounded-full px-5 py-2 text-sm font-semibold text-white transition"
          style={{ background: "#030303" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#030303")}
        >
          Try Opelo
        </Link>
      </div>
    </header>
  );
}
