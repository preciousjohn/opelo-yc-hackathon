"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

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
      {/* Logo at top */}
      <div className="px-5 py-5 border-b border-stone-100">
        <Link href="/">
          {/* Inline the small OPELO wordmark SVG paths in dark color */}
          <OpeloWordmark />
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

// Inline the Opelo wordmark SVG (smaller version, 60px wide)
function OpeloWordmark() {
  return (
    <svg width="60" height="20" viewBox="0 0 80 27" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0.837123 26.0595L3.44996 23.3199H9.71571L12.1763 26.0595H0.837123ZM0.0761019 13.6042L2.81578 16.2424V22.4574L0.0761019 24.9434V13.6042ZM12.9881 24.9434L10.2484 22.3305V16.0902L12.9881 13.6042V24.9434ZM0.811756 0.286289H12.151L9.63961 3.02597H3.4246L0.811756 0.286289ZM0 12.7163V1.37709L2.73968 3.83772V10.1288L0 12.7163ZM12.912 1.37709V12.7163L10.1723 10.2557V3.98993L12.912 1.37709Z" fill="#1c1917"/>
      <path d="M14.2492 26.4546C13.8868 26.4546 13.7056 26.3217 13.7056 26.0559C13.7056 25.8385 13.8627 25.6935 14.1767 25.6211L15.0102 25.4761C15.5176 25.3795 15.8437 25.2466 15.9887 25.0775C16.1578 24.9084 16.2424 24.5701 16.2424 24.0628V2.75417C16.2424 2.24682 16.1578 1.90859 15.9887 1.73948C15.8437 1.57036 15.5176 1.43749 15.0102 1.34085L14.1767 1.19589C13.8627 1.12341 13.7056 0.978455 13.7056 0.76102C13.7056 0.495267 13.8868 0.362391 14.2492 0.362391H21.8232C23.2486 0.362391 24.5049 0.676463 25.5921 1.30461C26.6792 1.90859 27.5248 2.75417 28.1288 3.84135C28.7328 4.92852 29.0348 6.18481 29.0348 7.61021C29.0348 8.9873 28.7328 10.2073 28.1288 11.2704C27.5248 12.3334 26.6913 13.1669 25.6283 13.7709C24.5653 14.3507 23.3332 14.6406 21.9319 14.6406H19.3227C18.9845 14.6406 18.8153 14.8097 18.8153 15.148V23.9178C18.8153 24.4252 18.912 24.7755 19.1053 24.9688C19.2985 25.1379 19.7334 25.2828 20.4099 25.4036L21.7507 25.6211C22.0165 25.6694 22.1493 25.8022 22.1493 26.0197C22.1493 26.3096 21.9682 26.4546 21.6058 26.4546H14.2492Z" fill="#1c1917"/>
      <path d="M71.665 26.7807C70.5054 26.7807 69.4182 26.4425 68.4035 25.766C67.3888 25.0654 66.4949 24.1111 65.7218 22.9031C64.9728 21.6952 64.3809 20.2818 63.9461 18.6631C63.5354 17.0203 63.33 15.2567 63.33 13.3722C63.33 11.4878 63.5354 9.73624 63.9461 8.11756C64.3809 6.49888 64.9728 5.08556 65.7218 3.87758C66.4949 2.64545 67.3888 1.69116 68.4035 1.0147C69.4182 0.338232 70.5054 0 71.665 0C72.8247 0 73.8998 0.338232 74.8903 1.0147C75.905 1.69116 76.7989 2.64545 77.572 3.87758C78.3451 5.08556 78.937 6.49888 79.3477 8.11756C79.7826 9.73624 80 11.4878 80 13.3722C80 15.2567 79.7826 17.0203 79.3477 18.6631C78.937 20.2818 78.3451 21.6952 77.572 22.9031C76.7989 24.1111 75.905 25.0654 74.8903 25.766C73.8998 26.4425 72.8247 26.7807 71.665 26.7807ZM71.665 25.8023C73.3803 25.8023 74.7212 24.7755 75.6876 22.7219C76.6539 20.6684 77.1371 17.5518 77.1371 13.3722C77.1371 9.19265 76.6539 6.08817 75.6876 4.05878C74.7212 2.00523 73.3803 0.978456 71.665 0.978456C69.9738 0.978456 68.633 2.00523 67.6425 4.05878C66.6761 6.08817 66.1929 9.19265 66.1929 13.3722C66.1929 17.5518 66.6761 20.6684 67.6425 22.7219C68.633 24.7755 69.9738 25.8023 71.665 25.8023Z" fill="#1c1917"/>
    </svg>
  );
}
