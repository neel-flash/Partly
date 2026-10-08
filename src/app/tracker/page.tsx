"use client";

import Link from "next/link";
import { Button, Card, EmptyState, ScoreBadge, money } from "@/components/ui";
import { updateLead, useApp, useHydrated, useScored } from "@/lib/store";
import { formatSlot } from "@/lib/templates";
import { SOURCE_LABELS, STAGE_LABELS, type LeadStage } from "@/lib/types";

const COLUMNS: { title: string; stages: LeadStage[] }[] = [
  { title: "Shortlisted", stages: ["shortlisted", "queued"] },
  { title: "In conversation", stages: ["awaiting", "replied"] },
  { title: "Tour booked", stages: ["tour_booked"] },
  { title: "Toured", stages: ["toured"] },
  { title: "Applied", stages: ["applied"] },
  { title: "Waitlist", stages: ["waitlisted"] },
  { title: "Ghosted / passed", stages: ["ghosted", "dismissed"] },
];

const MANUAL_STAGES: LeadStage[] = ["shortlisted", "awaiting", "tour_booked", "toured", "applied", "waitlisted", "ghosted", "dismissed"];

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function TrackerPage() {
  const hydrated = useHydrated();
  const { agent } = useApp();
  const scored = useScored();
  if (!hydrated) return null;

  const rows = Object.values(agent.leads)
    .map((lead) => ({ lead, listing: scored.find((l) => l.id === lead.listingId) }))
    .filter((r): r is { lead: typeof r.lead; listing: NonNullable<typeof r.listing> } => !!r.listing);

  if (!rows.length) {
    return <EmptyState title="Your tracker is empty" body="Every place you shortlist shows up here with its price, contact, conversation status and tour time." action={<Link href="/search"><Button>Browse matches</Button></Link>} />;
  }

  const exportCsv = () => {
    const header = ["Address", "Rent", "Your share", "Score", "Commute (min)", "Stage", "Landlord", "Contact", "Tour", "Sources", "Red flags", "Notes"];
    const lines = rows.map(({ lead, listing: l }) =>
      [
        `${l.address} ${l.unit ?? ""}`.trim(),
        l.rent,
        l.share,
        l.scores.total,
        l.commute.minutes,
        STAGE_LABELS[lead.stage],
        l.landlord.name,
        l.landlord.email ?? l.landlord.phone ?? "",
        lead.tour ? formatSlot(lead.tour.start) : "",
        l.postings.map((p) => SOURCE_LABELS[p.source]).join(" / "),
        l.flags.map((f) => f.label).join("; "),
        lead.notes,
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "partly-leads.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lead tracker</h1>
          <p className="text-sm text-slate-500">Every lead, price, contact and tour in one place. The agent moves cards as conversations progress.</p>
        </div>
        <Button variant="secondary" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const items = rows.filter((r) => col.stages.includes(r.lead.stage)).sort((a, b) => b.listing.scores.total - a.listing.scores.total);
          return (
            <div key={col.title} className="w-72 shrink-0">
              <p className="mb-2 flex items-center justify-between px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {col.title}
                <span className="rounded-full bg-slate-200 px-2 text-slate-600">{items.length}</span>
              </p>
              <div className="space-y-2">
                {items.map(({ lead, listing: l }) => {
                  const last = lead.messages[lead.messages.length - 1];
                  return (
                    <Card key={lead.listingId} className="space-y-2 p-3">
                      <div className="flex items-start gap-2">
                        <ScoreBadge score={l.scores.total} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{l.address}</p>
                          <p className="text-xs text-slate-500">
                            {money(l.rent)} · {l.commute.minutes} min · {l.landlord.name}
                          </p>
                        </div>
                      </div>
                      {lead.tour && <p className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">Tour {formatSlot(lead.tour.start)}</p>}
                      {last && (
                        <p className="line-clamp-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-600">{last.from === "agent" ? "You: " : "Landlord: "}</span>
                          {last.body}
                        </p>
                      )}
                      <textarea
                        placeholder="Notes"
                        value={lead.notes}
                        onChange={(e) => updateLead(lead.listingId, { notes: e.target.value })}
                        className="h-12 w-full resize-none rounded-md bg-slate-50 px-2 py-1 text-xs ring-1 ring-slate-200 focus:ring-indigo-400 focus:outline-none"
                      />
                      <select
                        value={lead.stage}
                        onChange={(e) => updateLead(lead.listingId, { stage: e.target.value as LeadStage })}
                        className="w-full rounded-md bg-white px-2 py-1 text-xs ring-1 ring-slate-200"
                      >
                        {MANUAL_STAGES.concat(MANUAL_STAGES.includes(lead.stage) ? [] : [lead.stage]).map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
