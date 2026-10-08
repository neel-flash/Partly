"use client";

import Link from "next/link";
import { Button, Card, EmptyState, ScoreBadge, money } from "@/components/ui";
import { googleCalendarUrl, toursToIcs } from "@/lib/ics";
import { updateLead, useApp, useHydrated, useScored } from "@/lib/store";

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function CalendarPage() {
  const hydrated = useHydrated();
  const { agent } = useApp();
  const scored = useScored();
  if (!hydrated) return null;

  const tours = Object.values(agent.leads)
    .filter((l) => l.tour && ["tour_booked", "toured", "applied"].includes(l.stage))
    .map((lead) => ({ lead, tour: lead.tour!, listing: scored.find((s) => s.id === lead.listingId) }))
    .sort((a, b) => a.tour.start - b.tour.start);

  if (!tours.length) {
    return (
      <EmptyState
        title="No tours booked yet"
        body="Once the agent confirms a viewing with a landlord it lands here, ready to export to Google, Apple or Outlook calendar."
        action={<Link href="/agent"><Button>Open agent</Button></Link>}
      />
    );
  }

  const days = Array.from(new Set(tours.map((t) => startOfDay(t.tour.start))));

  const exportIcs = () => {
    const ics = toursToIcs(
      tours.map(({ lead, tour, listing }) => ({
        ...tour,
        id: lead.listingId,
        title: listing ? `${listing.address} (${money(listing.rent)})` : tour.address,
        notes: listing ? `Score ${listing.scores.total}. ${listing.flags.map((f) => `Ask about: ${f.label}`).join(". ")}` : undefined,
      })),
    );
    const blob = new Blob([ics], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "partly-tours.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Your tours</h1>
          <p className="text-sm text-slate-500">
            {tours.length} viewing{tours.length > 1 ? "s" : ""} booked, none overlapping, all inside your availability. Just show up.
          </p>
        </div>
        <Button onClick={exportIcs}>Export all to calendar (.ics)</Button>
      </div>

      <div className="space-y-4">
        {days.map((day) => {
          const todays = tours.filter((t) => startOfDay(t.tour.start) === day);
          return (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">
                {new Date(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h2>
              <div className="space-y-2">
                {todays.map(({ lead, tour, listing }) => (
                  <Card key={lead.listingId} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="w-20 text-center">
                      <p className="text-lg font-semibold text-slate-900">
                        {new Date(tour.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </p>
                      <p className="text-xs text-slate-400">30 min</p>
                    </div>
                    {listing && <ScoreBadge score={listing.scores.total} />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{tour.address}</p>
                      <p className="text-sm text-slate-500">
                        {listing && `${money(listing.rent)}/mo · ${listing.commute.minutes} min to campus · `}
                        {tour.contact}
                      </p>
                      {listing && listing.flags.length > 0 && (
                        <p className="mt-1 text-xs text-amber-700">Ask about: {listing.flags.map((f) => f.label).join(", ")}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <a href={googleCalendarUrl(tour, listing?.address ?? tour.address)} target="_blank" rel="noreferrer">
                        <Button variant="secondary">Google Calendar</Button>
                      </a>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(tour.address)}`} target="_blank" rel="noreferrer">
                        <Button variant="secondary">Directions</Button>
                      </a>
                      {lead.stage === "tour_booked" ? (
                        <Button variant="secondary" onClick={() => updateLead(lead.listingId, { stage: "toured" })}>
                          Mark toured
                        </Button>
                      ) : lead.stage === "toured" ? (
                        <Button onClick={() => updateLead(lead.listingId, { stage: "applied" })}>Mark applied</Button>
                      ) : (
                        <span className="self-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">Applied</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
