import { Cockpit } from "@/components/Cockpit";

export const dynamic = "force-dynamic";

export default function CockpitPage() {
  return (
    <div className="mx-auto max-w-[1600px] bg-stone-950 px-4 py-6 text-ink-100 sm:px-6 min-h-screen">
      <Cockpit />
    </div>
  );
}
