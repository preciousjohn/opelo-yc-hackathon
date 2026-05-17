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
        <div className="min-h-screen">
          <Nav />
          <main className="mx-auto max-w-7xl px-6 pb-16 pt-6">{children}</main>
          <footer className="border-t border-ink-800/60 py-5 text-center text-xs text-ink-500">
            Opelo · AI middle management for one-person businesses · demo mode
          </footer>
        </div>
      </body>
    </html>
  );
}
