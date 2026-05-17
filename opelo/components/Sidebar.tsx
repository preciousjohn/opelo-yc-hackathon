"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { OpeloWordmark } from "@/components/OpeloWordmark";

const nav = [
  { href: "/dashboard", label: "Overview", emoji: "📊" },
  { href: "/inbox",     label: "Messages", emoji: "📬" },
  { href: "/policies",  label: "My Rules",  emoji: "📋" },
  { href: "/logs",      label: "Activity",  emoji: "📜" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-stone-100 flex flex-col min-h-screen sticky top-0 h-screen overflow-y-auto">
      {/* Logo at top — same wordmark + size as the marketing nav so the
          brand mark reads identically across both views. */}
      <div className="px-5 py-5 border-b border-stone-100">
        <Link href="/" aria-label="Opelo home">
          <OpeloWordmark width={80} height={27} />
        </Link>
      </div>
      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-0.5 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 px-3 pb-2">Main</p>
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition",
                active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
              )}
            >
              <span className="text-base">{item.emoji}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-stone-100 mt-auto">
        <Link href="/" className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-50 transition">
          ← Home
        </Link>
      </div>
    </aside>
  );
}
