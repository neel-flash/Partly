"use client";

import { IntakeForm } from "@/components/IntakeForm";
import { useHydrated } from "@/lib/store";

const PAIN_POINTS = [
  ["10+ tabs", "Zillow, Apartments.com, Craigslist and Marketplace merged and de-duplicated into one list."],
  ["Rush-hour commutes", "Every listing routed door-to-door to your campus at the time you actually leave."],
  ["Predatory leases", "Non-refundable deposits, auto-renewals and rental-scam scripts flagged before you apply."],
  ["Ghosting landlords", "The agent messages, follows up by text and call, and moves on to the next-best unit."],
  ["Spreadsheets", "Every lead, price and contact tracked in one pipeline, with tours on your calendar."],
  ["Waitlist knocking", "Full buildings get a waitlist request on day one, and the agent books you in when a unit opens."],
];

export default function Home() {
  const hydrated = useHydrated();
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[1fr_minmax(0,620px)] lg:py-16">
      <section className="space-y-6">
        <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
          For students & relocating grads
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Your apartment hunt, <span className="text-indigo-600">handled.</span>
        </h1>
        <p className="max-w-xl text-lg text-slate-600">
          Tell Partly your budget, campus and move-in date. It searches every platform, grades each place, checks real commute times and messages
          landlords for you. All you do is open your calendar and show up to the tours.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {PAIN_POINTS.map(([title, body]) => (
            <div key={title} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        {hydrated ? <IntakeForm /> : <div className="h-[480px] animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />}
        <p className="mt-3 text-center text-xs text-slate-400">Takes about two minutes. Everything stays in your browser.</p>
      </section>
    </div>
  );
}
