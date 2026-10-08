"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, EmptyState, STAGE_STYLES, ScoreBadge, cx, money } from "@/components/ui";
import { isActive, startOutreach, stepAgent } from "@/lib/agent";
import { setState, updateLead, useApp, useHydrated, useScored } from "@/lib/store";
import { formatSlot } from "@/lib/templates";
import { STAGE_LABELS, type AgentEvent, type Channel, type Lead } from "@/lib/types";

const CHANNEL_LABEL: Record<Channel, string> = { email: "Email", sms: "Text", platform: "Platform DM", call: "Voicemail" };
const EVENT_ICON: Record<AgentEvent["kind"], string> = {
  sent: "✉",
  reply: "↩",
  booked: "📅",
  followup: "⟳",
  ghosted: "👻",
  backfill: "➕",
  waitlist: "⏳",
  info: "•",
};
const TICK_MS = 650;
const HOURS_PER_TICK = 3;

export default function AgentPage() {
  const hydrated = useHydrated();
  const { intake, search, agent, autoBackfill } = useApp();
  const scored = useScored();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const scoredRef = useRef(scored);
  const [status, setStatus] = useState<{ ai: boolean } | null>(null);

  useEffect(() => {
    scoredRef.current = scored;
  }, [scored]);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ ai: false }));
  }, []);

  const leads = useMemo(
    () =>
      Object.values(agent.leads)
        .map((lead) => ({ lead, listing: scored.find((l) => l.id === lead.listingId) }))
        .filter((x): x is { lead: Lead; listing: NonNullable<typeof x.listing> } => !!x.listing)
        .sort((a, b) => b.listing.scores.total - a.listing.scores.total),
    [agent.leads, scored],
  );
  const anyActive = leads.some(({ lead }) => isActive(lead));

  useEffect(() => {
    if (!running || !intake) return;
    const t = setInterval(() => {
      setState((s) => {
        if (!s.intake) return s;
        const next = stepAgent(s.agent, HOURS_PER_TICK, scoredRef.current, s.intake, s.autoBackfill);
        return { ...s, agent: next };
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [running, intake]);

  useEffect(() => {
    if (running && !anyActive) {
      const t = setTimeout(() => setRunning(false), 0);
      return () => clearTimeout(t);
    }
  }, [running, anyActive]);

  if (!hydrated) return null;
  if (!intake || !search) {
    return <EmptyState title="Nothing to work on yet" body="Run a search first, then shortlist places for the agent." action={<Link href="/"><Button>Start intake</Button></Link>} />;
  }
  if (!leads.length) {
    return <EmptyState title="No shortlisted places" body="Shortlist listings on the Matches page (or send the agent to your top 5)." action={<Link href="/search"><Button>Go to matches</Button></Link>} />;
  }

  const shortlisted = leads.filter(({ lead }) => lead.stage === "shortlisted");
  const undrafted = shortlisted.filter(({ lead }) => !lead.draft);
  const selected = leads.find(({ lead }) => lead.listingId === selectedId) ?? leads[0];
  const booked = leads.filter(({ lead }) => lead.stage === "tour_booked").length;
  const started = agent.clock > 0;

  const draftAll = async () => {
    setDrafting(true);
    await Promise.all(
      undrafted.map(async ({ lead, listing }) => {
        try {
          const res = await fetch("/api/draft", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ intake, listing, medianRentPerBed: search.meta.medianRentPerBed }),
          });
          const data = (await res.json()) as { body: string; source: "ai" | "template" };
          updateLead(lead.listingId, { draft: data.body, draftSource: data.source });
        } catch (err) {
          console.error("Draft failed", err);
        }
      }),
    );
    setDrafting(false);
  };

  const approveAndStart = () => {
    setState((s) => ({ ...s, agent: startOutreach(s.agent, shortlisted.map((x) => x.lead.listingId), Date.now()) }));
    setRunning(true);
  };

  const fastForward = (hours: number) =>
    setState((s) => (s.intake ? { ...s, agent: stepAgent(s.agent, hours, scored, s.intake, s.autoBackfill) } : s));

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Outreach agent</h1>
          <p className="text-sm text-slate-500">
            {started ? (
              <>
                Agent clock: <b className="text-slate-700">{formatSlot(agent.clock)}</b> · {booked} tour{booked === 1 ? "" : "s"} booked ·{" "}
                {leads.filter(({ lead }) => isActive(lead)).length} conversations in progress
              </>
            ) : (
              "Review the first messages, then let the agent handle replies, follow-ups and scheduling."
            )}
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Demo mode: landlords are simulated and time runs fast, so you can watch a week of back-and-forth in under a minute.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="mr-2 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={autoBackfill} onChange={(e) => setState((s) => ({ ...s, autoBackfill: e.target.checked }))} />
            Replace ghosted leads automatically
          </label>
          {shortlisted.length > 0 && (
            <>
              <Button variant="secondary" onClick={draftAll} disabled={drafting || undrafted.length === 0}>
                {drafting ? "Drafting..." : undrafted.length ? `Draft ${undrafted.length} message${undrafted.length > 1 ? "s" : ""}${status?.ai ? " with AI" : ""}` : "Drafts ready"}
              </Button>
              <Button onClick={approveAndStart}>Approve & contact {shortlisted.length}</Button>
            </>
          )}
          {started && anyActive && (
            <>
              <Button variant="secondary" onClick={() => setRunning((r) => !r)}>
                {running ? "Pause" : "Resume"}
              </Button>
              <Button variant="secondary" onClick={() => fastForward(24)}>
                +1 day
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <ul className="max-h-[calc(100vh-200px)] divide-y divide-slate-100 overflow-y-auto">
            {leads.map(({ lead, listing }) => (
              <li key={lead.listingId}>
                <button
                  onClick={() => setSelectedId(lead.listingId)}
                  className={cx("flex w-full items-center gap-3 px-3 py-2.5 text-left transition", selected.lead.listingId === lead.listingId ? "bg-indigo-50" : "hover:bg-slate-50")}
                >
                  <ScoreBadge score={listing.scores.total} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{listing.address}</p>
                    <p className="truncate text-xs text-slate-500">
                      {money(listing.rent)} · {listing.landlord.name}
                    </p>
                  </div>
                  <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap", STAGE_STYLES[lead.stage])}>{STAGE_LABELS[lead.stage]}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex max-h-[calc(100vh-200px)] min-h-[420px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{selected.listing.landlord.name}</p>
              <p className="text-xs text-slate-500">
                {selected.listing.address} · {selected.listing.landlord.email ?? selected.listing.landlord.phone ?? "via platform"}
              </p>
            </div>
            {selected.lead.tour && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Tour {formatSlot(selected.lead.tour.start)}</span>
            )}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
            {selected.lead.stage === "shortlisted" && (
              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>First message (edit before approving)</span>
                  {selected.lead.draftSource && <span>{selected.lead.draftSource === "ai" ? "AI-drafted" : "Template"}</span>}
                </div>
                {selected.lead.draft ? (
                  <textarea
                    className="h-64 w-full resize-y rounded-lg bg-slate-50 p-2 text-sm text-slate-700 ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    value={selected.lead.draft}
                    onChange={(e) => updateLead(selected.lead.listingId, { draft: e.target.value })}
                  />
                ) : (
                  <p className="text-sm text-slate-400">Click “Draft messages” to write a personalised first message for this landlord.</p>
                )}
              </div>
            )}
            {selected.lead.messages.map((m) => (
              <div key={m.id} className={cx("flex", m.from === "agent" ? "justify-end" : "justify-start")}>
                <div
                  className={cx(
                    "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap shadow-sm",
                    m.from === "agent" ? "rounded-br-sm bg-indigo-600 text-white" : "rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200",
                  )}
                >
                  {m.body}
                  <p className={cx("mt-1 text-[10px]", m.from === "agent" ? "text-indigo-200" : "text-slate-400")}>
                    {m.from === "agent" ? "Partly agent" : selected.listing.landlord.name} · {CHANNEL_LABEL[m.channel]} · {formatSlot(m.at)}
                  </p>
                </div>
              </div>
            ))}
            {selected.lead.stage === "ghosted" && (
              <p className="text-center text-xs text-rose-600">No response after {selected.lead.followUps} follow-ups. The agent stopped contacting this landlord.</p>
            )}
          </div>
        </Card>

        <Card className="max-h-[calc(100vh-200px)] overflow-hidden">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Agent activity</p>
          <ul className="max-h-[calc(100vh-250px)] space-y-0.5 overflow-y-auto p-2">
            {agent.log.length === 0 && <li className="p-3 text-sm text-slate-400">Nothing yet.</li>}
            {agent.log.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => e.listingId && setSelectedId(e.listingId)}
                  className={cx("flex w-full gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50", e.kind === "booked" && "bg-emerald-50/60")}
                >
                  <span className="w-4 shrink-0 text-center">{EVENT_ICON[e.kind]}</span>
                  <span className="flex-1 text-slate-700">{e.text}</span>
                  <span className="shrink-0 text-slate-400">{new Date(e.at).toLocaleDateString("en-US", { weekday: "short" })}</span>
                </button>
              </li>
            ))}
          </ul>
          {booked > 0 && (
            <div className="border-t border-slate-100 p-3">
              <Link href="/calendar">
                <Button className="w-full">View {booked} tour{booked > 1 ? "s" : ""} on calendar</Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
