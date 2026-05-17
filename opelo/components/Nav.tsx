import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-800/60 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-base font-semibold tracking-tight">Opelo</span>
          <span className="hidden text-xs text-ink-500 sm:inline">
            AI middle management for one-person businesses
          </span>
        </Link>
        <span className="text-[11px] uppercase tracking-wider text-ink-500">
          Cockpit
        </span>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-accent to-accent-soft text-ink-950 shadow-glow">
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
        <path d="M4 12c0-4 3-8 8-8s8 4 8 8" />
        <path d="M4 12c0 4 3 8 8 8" />
        <path d="M12 12h8" />
      </svg>
    </span>
  );
}
