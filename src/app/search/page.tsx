"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ListingCard } from "@/components/ListingCard";
import { ListingDetail } from "@/components/ListingDetail";
import { Button, Card, EmptyState } from "@/components/ui";
import { newLead, setState, toggleShortlist, useApp, useHydrated, useScored } from "@/lib/store";
import { SOURCE_LABELS, type Weights } from "@/lib/types";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" />,
});

const WEIGHT_LABELS: Record<keyof Weights, string> = {
  price: "Price",
  commute: "Commute",
  reviews: "Reviews",
  lease: "Lease fairness",
  amenities: "Amenities",
};

type Sort = "score" | "price" | "commute";

export default function SearchPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { intake, search, agent } = useApp();
  const scored = useScored();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const [sort, setSort] = useState<Sort>("score");

  const visible = useMemo(() => {
    const list = showExcluded ? scored : scored.filter((l) => !l.excluded.length);
    if (sort === "price") return [...list].sort((a, b) => a.share - b.share);
    if (sort === "commute") return [...list].sort((a, b) => a.commute.minutes - b.commute.minutes);
    return list;
  }, [scored, showExcluded, sort]);

  if (!hydrated) return null;
  if (!intake || !search) {
    return <EmptyState title="No search yet" body="Do the two-minute intake and Partly will pull listings from every platform." action={<Link href="/"><Button>Start intake</Button></Link>} />;
  }

  const eligible = scored.filter((l) => !l.excluded.length);
  const excludedCount = scored.length - eligible.length;
  const scams = scored.filter((l) => l.excluded.includes("Likely scam")).length;
  const merged = search.meta.rawCount - search.meta.dedupedCount;
  const selected = scored.find((l) => l.id === selectedId) ?? null;
  const shortlistCount = Object.values(agent.leads).filter((l) => l.stage === "shortlisted").length;

  const updateIntake = (patch: Partial<typeof intake>) => setState((s) => (s.intake ? { ...s, intake: { ...s.intake, ...patch } } : s));

  const sendTop = (n: number) => {
    setState((s) => {
      const leads = { ...s.agent.leads };
      let added = 0;
      for (const l of eligible) {
        if (added >= n) break;
        if (!leads[l.id]) {
          leads[l.id] = newLead(l.id);
          added++;
        }
      }
      return { ...s, agent: { ...s.agent, leads } };
    });
    router.push("/agent");
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {eligible.length} matches near {intake.anchorLabel.split(",")[0]}
          </h1>
          <p className="text-sm text-slate-500">
            Pulled {search.meta.rawCount} postings from {search.meta.sources.map((s) => SOURCE_LABELS[s.source]).join(", ")}, merged {merged} cross-posted
            duplicates, filtered out {excludedCount}
            {scams ? ` (including ${scams} likely scam${scams > 1 ? "s" : ""})` : ""}. Commutes{" "}
            {search.meta.commuteProvider === "google" ? "from Google Maps" : "estimated"} for a {intake.arriveBy} arrival.
          </p>
          {search.meta.sources.some((s) => !s.live) && (
            <p className="mt-1 text-xs text-amber-700">Demo listings: add API keys in .env.local to pull live data (see README).</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/">
            <Button variant="secondary">Edit intake</Button>
          </Link>
          {shortlistCount > 0 ? (
            <Button onClick={() => router.push("/agent")}>Send agent to {shortlistCount} shortlisted</Button>
          ) : (
            <Button onClick={() => sendTop(5)} disabled={!eligible.length}>
              Send agent to top 5
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card className="space-y-3 p-4">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Grading weights</p>
            {(Object.keys(WEIGHT_LABELS) as (keyof Weights)[]).map((k) => (
              <label key={k} className="block text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>{WEIGHT_LABELS[k]}</span>
                  <span className="tabular-nums text-slate-400">{intake.weights[k]}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={intake.weights[k]}
                  onChange={(e) => updateIntake({ weights: { ...intake.weights, [k]: Number(e.target.value) } })}
                  className="w-full"
                />
              </label>
            ))}
          </Card>
          <Card className="space-y-3 p-4">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Filters</p>
            <label className="block text-sm text-slate-600">
              Budget (your share): <b>${intake.budget}</b>
              <input type="range" min={500} max={4000} step={50} value={intake.budget} onChange={(e) => updateIntake({ budget: Number(e.target.value) })} className="w-full" />
            </label>
            <label className="block text-sm text-slate-600">
              Max commute: <b>{intake.maxCommuteMin} min</b>
              <input type="range" min={10} max={75} step={5} value={intake.maxCommuteMin} onChange={(e) => updateIntake({ maxCommuteMin: Number(e.target.value) })} className="w-full" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={showExcluded} onChange={(e) => setShowExcluded(e.target.checked)} />
              Show {excludedCount} filtered out
            </label>
            <div className="flex gap-1">
              {(["score", "price", "commute"] as Sort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`flex-1 rounded-md py-1 text-xs font-medium capitalize ${sort === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <section className="space-y-2.5 lg:max-h-[calc(100vh-230px)] lg:overflow-y-auto lg:pr-1">
          {visible.length === 0 && (
            <Card className="p-6 text-center text-sm text-slate-500">Nothing passes your filters. Try a higher budget or longer commute.</Card>
          )}
          {visible.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              lead={agent.leads[l.id]}
              selected={l.id === selectedId}
              onSelect={() => setSelectedId(l.id)}
              onShortlist={() => toggleShortlist(l.id)}
            />
          ))}
        </section>

        <section className="relative h-[60vh] overflow-hidden rounded-2xl ring-1 ring-slate-200 lg:sticky lg:top-[72px] lg:h-[calc(100vh-230px)]">
          <MapView anchor={intake.anchor} anchorLabel={intake.anchorLabel} listings={visible} selectedId={selectedId} onSelect={setSelectedId} />
          {selected && (
            <div className="absolute inset-y-0 right-0 z-[500] w-full max-w-md bg-white shadow-2xl">
              <ListingDetail listing={selected} lead={agent.leads[selected.id]} onClose={() => setSelectedId(null)} onShortlist={() => toggleShortlist(selected.id)} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
