import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Opelo — AI middle management for one-person businesses",
  description:
    "Delegate operational judgment — refunds, pricing, sponsorships, scheduling, and escalations — to an AI manager that follows your business policies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-950 text-ink-100">
        <div className="grid-bg min-h-screen">
          <Nav />
          <main className="mx-auto max-w-6xl px-6 pb-24 pt-8">{children}</main>
          <footer className="border-t border-ink-800/80 py-6 text-center text-xs text-ink-500">
            Opelo · AI middle management for one-person businesses · demo build
          </footer>
        </div>
      </body>
    </html>
  );
}
