"use client";

import { grade } from "@/lib/scoring";
import { SOURCE_LABELS, STAGE_LABELS, type Lead, type ScoredListing } from "@/lib/types";
import { Chip, FlagChip, ScoreBadge, STAGE_STYLES, cx, money } from "./ui";

const MODE_VERB = { transit: "by transit", walk: "walking", bike: "by bike", drive: "driving" } as const;

export function ListingCard({
  listing: l,
  lead,
  selected,
  onSelect,
  onShortlist,
}: {
  listing: ScoredListing;
  lead?: Lead;
  selected: boolean;
  onSelect: () => void;
  onShortlist: () => void;
}) {
  const topFlags = [...l.flags].sort((a, b) => (a.severity === "high" ? -1 : b.severity === "high" ? 1 : 0)).slice(0, 2);
  const excluded = l.excluded.length > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cx(
        "group flex cursor-pointer gap-3 rounded-2xl bg-white p-3 ring-1 transition",
        selected ? "ring-2 ring-indigo-500" : "ring-slate-200 hover:ring-slate-300",
        excluded && "opacity-60",
      )}
    >
      <div
        className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl"
        style={{ background: `linear-gradient(135deg, hsl(${l.hue} 60% 78%), hsl(${(l.hue + 40) % 360} 55% 60%))` }}
      >
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/40 px-1.5 text-[10px] font-medium text-white">
          {l.beds === 0 ? "Studio" : `${l.beds} bd`} · {l.baths} ba{l.sqft ? ` · ${l.sqft} ft²` : ""}
        </span>
        {l.waitlistOnly && <span className="absolute top-1.5 left-1.5 rounded bg-amber-400 px-1.5 text-[10px] font-semibold text-amber-950">Waitlist</span>}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{l.title}</p>
            <p className="truncate text-xs text-slate-500">
              {l.address}
              {l.unit ? ` ${l.unit}` : ""} · {l.neighborhood}
            </p>
          </div>
          <div className="flex flex-col items-center">
            <ScoreBadge score={l.scores.total} size="sm" />
            <span className="mt-0.5 text-[10px] font-semibold text-slate-400">{grade(l.scores.total)}</span>
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold text-slate-900">{money(l.rent)}/mo</span>
          {l.share !== l.rent && <span className="text-xs text-slate-500">{money(l.share)} your share</span>}
          <span className="text-xs text-slate-600">
            <b>{l.commute.minutes} min</b> {MODE_VERB[l.commute.mode]}
          </span>
          {l.reviewAvg > 0 && (
            <span className="text-xs text-slate-600">
              ★ {l.reviewAvg.toFixed(1)} <span className="text-slate-400">({l.reviews.length})</span>
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {l.postings.map((p) => (
            <Chip key={p.externalId}>{SOURCE_LABELS[p.source]}</Chip>
          ))}
          {topFlags.map((f) => (
            <FlagChip key={f.id} severity={f.severity}>
              {f.label}
            </FlagChip>
          ))}
          {excluded && <span className="text-[11px] text-rose-600">{l.excluded[0]}</span>}
        </div>
      </div>

      <div className="flex flex-col justify-center">
        {lead && lead.stage !== "shortlisted" ? (
          <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", STAGE_STYLES[lead.stage])}>{STAGE_LABELS[lead.stage]}</span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShortlist();
            }}
            title={lead ? "Remove from shortlist" : "Shortlist"}
            className={cx(
              "grid h-9 w-9 place-items-center rounded-full text-lg ring-1 transition",
              lead ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-400 ring-slate-200 hover:text-indigo-600",
            )}
          >
            {lead ? "✓" : "+"}
          </button>
        )}
      </div>
    </div>
  );
}
