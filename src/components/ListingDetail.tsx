"use client";

import { grade } from "@/lib/scoring";
import { SOURCE_LABELS, type Lead, type ScoredListing } from "@/lib/types";
import { Bar, Button, Chip, FlagChip, ScoreBadge, money } from "./ui";

export function ListingDetail({
  listing: l,
  lead,
  onClose,
  onShortlist,
}: {
  listing: ScoredListing;
  lead?: Lead;
  onClose: () => void;
  onShortlist: () => void;
}) {
  const cheapest = Math.min(...l.postings.map((p) => p.price));
  return (
    <div className="flex h-full flex-col">
      <div
        className="relative h-36 shrink-0"
        style={{ background: `linear-gradient(135deg, hsl(${l.hue} 60% 78%), hsl(${(l.hue + 40) % 360} 55% 55%))` }}
      >
        <button onClick={onClose} className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-slate-600 shadow hover:bg-white">
          ✕
        </button>
        <div className="absolute bottom-3 left-4 flex items-end gap-3">
          <ScoreBadge score={l.scores.total} size="lg" />
          <div className="text-white drop-shadow">
            <p className="text-xs font-semibold uppercase">Grade {grade(l.scores.total)}</p>
            <p className="text-lg leading-tight font-semibold">{money(l.rent)}/mo</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{l.title}</h2>
          <p className="text-sm text-slate-500">
            {l.address}
            {l.unit ? ` ${l.unit}` : ""} · {l.neighborhood} · available {l.availableFrom}
          </p>
          <p className="mt-2 text-sm text-slate-700">{l.description}</p>
          {l.excluded.length > 0 && (
            <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">Filtered out: {l.excluded.join(" · ")}</div>
          )}
        </div>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Score breakdown</h3>
          <div className="space-y-1.5">
            <Bar label="Price" value={l.scores.price} />
            <Bar label="Commute" value={l.scores.commute} />
            <Bar label="Reviews" value={l.scores.reviews} />
            <Bar label="Lease" value={l.scores.lease} />
            <Bar label="Amenities" value={l.scores.amenities} />
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Door-to-door commute · {l.commute.minutes} min
            <span className="ml-2 font-normal normal-case">{l.commute.provider === "google" ? "via Google Maps" : "estimated for rush hour"}</span>
          </h3>
          <div className="flex overflow-hidden rounded-lg ring-1 ring-slate-200">
            {l.commute.legs.map((leg, i) => (
              <div
                key={i}
                className="border-r border-white bg-indigo-50 px-2 py-1.5 text-[11px] text-indigo-900 last:border-r-0"
                style={{ flexGrow: leg.minutes, flexBasis: 0 }}
                title={leg.label}
              >
                <p className="font-semibold">{leg.minutes}m</p>
                <p className="truncate text-indigo-700/80">{leg.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">{l.commute.distanceKm.toFixed(1)} km route</p>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Found on {l.postings.length} platform{l.postings.length > 1 ? "s" : ""}</h3>
          <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
            {l.postings.map((p) => (
              <li key={p.externalId} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{SOURCE_LABELS[p.source]}</p>
                  <p className="truncate text-xs text-slate-400">
                    “{p.title}” · posted {p.postedDaysAgo === 0 ? "today" : `${p.postedDaysAgo}d ago`}
                  </p>
                </div>
                <span className={p.price === cheapest && l.postings.length > 1 ? "font-semibold text-emerald-600" : "text-slate-700"}>
                  {money(p.price)}
                  {p.price === cheapest && l.postings.length > 1 && <span className="ml-1 text-[10px]">lowest</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Lease & landlord check</h3>
          {l.flags.length === 0 ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">No red flags found in the listing or lease terms.</p>
          ) : (
            <ul className="space-y-2">
              {l.flags.map((f) => (
                <li key={f.id} className="rounded-lg p-3 ring-1 ring-slate-200">
                  <FlagChip severity={f.severity}>
                    {f.kind === "scam" ? "Scam risk" : f.kind === "lease" ? "Lease" : "Listing"} · {f.label}
                  </FlagChip>
                  <p className="mt-1.5 text-xs text-slate-600">{f.detail}</p>
                </li>
              ))}
            </ul>
          )}
          {l.lease && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {[
                ["Lease", `${l.lease.lengthMonths} months`],
                ["Deposit", money(l.lease.deposit)],
                ["Application fee", money(l.lease.applicationFee)],
                ["Broker fee", l.lease.brokerFee ? money(l.lease.brokerFee) : "None"],
                ["Late fee", l.lease.lateFee],
                ["Landlord", `${l.landlord.name} (${l.landlord.kind})`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="font-medium text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Amenities</h3>
          <div className="flex flex-wrap gap-1">
            {l.amenities.length ? l.amenities.map((a) => <Chip key={a} className="capitalize">{a}</Chip>) : <span className="text-xs text-slate-400">None listed</span>}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Student reviews {l.reviewAvg > 0 && `· ★ ${l.reviewAvg.toFixed(1)}`}
          </h3>
          {l.reviews.length === 0 ? (
            <p className="text-xs text-slate-400">No reviews yet for this address.</p>
          ) : (
            <ul className="space-y-2">
              {l.reviews.map((r, i) => (
                <li key={i} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      {r.author} · {r.year}
                    </span>
                    <span className="text-amber-500">{"★".repeat(r.rating)}<span className="text-slate-200">{"★".repeat(5 - r.rating)}</span></span>
                  </div>
                  <p className="mt-1 text-slate-600">{r.text}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="border-t border-slate-100 p-4">
        <Button className="w-full" variant={lead ? "secondary" : "primary"} onClick={onShortlist} disabled={!!lead && lead.stage !== "shortlisted"}>
          {!lead ? "Shortlist for agent outreach" : lead.stage === "shortlisted" ? "Remove from shortlist" : "Agent is working this lead"}
        </Button>
      </div>
    </div>
  );
}
