"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { blankIntake, demoIntake } from "@/lib/defaults";
import { CAMPUSES } from "@/lib/geo";
import { setState, useApp } from "@/lib/store";
import { AMENITIES, type Amenity, type CommuteMode, type Intake, type SearchResponse, type Weights } from "@/lib/types";
import { Button, Card, cx } from "./ui";

const STEPS = ["Where & when", "Budget & space", "Commute", "Priorities", "You & tours"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MODES: { id: CommuteMode; label: string }[] = [
  { id: "transit", label: "Transit" },
  { id: "walk", label: "Walk" },
  { id: "bike", label: "Bike" },
  { id: "drive", label: "Drive" },
];
const WEIGHT_LABELS: Record<keyof Weights, string> = {
  price: "Price",
  commute: "Commute",
  reviews: "Student reviews",
  lease: "Fair lease / landlord",
  amenities: "Amenities",
};

type GeoHit = { label: string; lat: number; lng: number };

export async function runSearch(intake: Intake): Promise<SearchResponse> {
  const res = await fetch("/api/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(intake) });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return (await res.json()) as SearchResponse;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {hint && <span className="ml-2 text-xs text-slate-400">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none";

export function IntakeForm() {
  const router = useRouter();
  const saved = useApp().intake;
  const [intake, setIntake] = useState<Intake>(() => saved ?? blankIntake());
  const [step, setStep] = useState(0);
  const [hits, setHits] = useState<GeoHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof Intake>(key: K, value: Intake[K]) => setIntake((i) => ({ ...i, [key]: value }));
  const hasAnchor = Number.isFinite(intake.anchor.lat);

  const onAddressChange = (q: string) => {
    setIntake((i) => ({ ...i, anchorLabel: q, anchor: { lat: NaN, lng: NaN } }));
    if (debounce.current) clearTimeout(debounce.current);
    if (q.trim().length < 3) {
      setHits([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results: GeoHit[] };
        setHits(data.results);
      } catch {
        setHits([]);
      }
    }, 350);
  };

  const chooseAnchor = (hit: GeoHit) => {
    setIntake((i) => ({ ...i, anchorLabel: hit.label, anchor: { lat: hit.lat, lng: hit.lng } }));
    setHits([]);
  };

  const toggleAmenity = (key: "mustHaves" | "niceToHaves", a: Amenity) => {
    setIntake((i) => {
      const other = key === "mustHaves" ? "niceToHaves" : "mustHaves";
      const has = i[key].includes(a);
      return { ...i, [key]: has ? i[key].filter((x) => x !== a) : [...i[key], a], [other]: i[other].filter((x) => x !== a) };
    });
  };

  const submit = async (data: Intake) => {
    setSearching(true);
    setError(null);
    try {
      const search = await runSearch(data);
      setState((s) => ({ ...s, intake: data, search }));
      router.push("/search");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setSearching(false);
    }
  };

  const canNext = step !== 0 || hasAnchor;
  const last = step === STEPS.length - 1;

  return (
    <Card className="overflow-hidden shadow-xl shadow-slate-200/60">
      <div className="flex border-b border-slate-100">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => (i === 0 || hasAnchor) && setStep(i)}
            className={cx(
              "flex-1 border-b-2 px-2 py-3 text-xs font-medium transition",
              i === step ? "border-indigo-600 text-indigo-700" : i < step ? "border-indigo-200 text-slate-600" : "border-transparent text-slate-400",
            )}
          >
            <span className="hidden sm:inline">{i + 1}. </span>
            {s}
          </button>
        ))}
      </div>

      <div className="min-h-[340px] space-y-5 p-6">
        {step === 0 && (
          <>
            <Field label="Campus or work address" hint="we route every listing door-to-door to here">
              <div className="relative">
                <input
                  className={inputCls}
                  placeholder="e.g. Boston University or 1 Main St, Cambridge"
                  value={intake.anchorLabel}
                  onChange={(e) => onAddressChange(e.target.value)}
                />
                {hasAnchor && <span className="absolute top-2 right-3 text-xs font-medium text-emerald-600">Located</span>}
                {hits.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
                    {hits.map((h) => (
                      <li key={`${h.lat},${h.lng}`}>
                        <button type="button" onClick={() => chooseAnchor(h)} className="w-full px-3 py-2 text-left text-sm hover:bg-indigo-50">
                          {h.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {CAMPUSES.map((c) => (
                <button
                  type="button"
                  key={c.label}
                  onClick={() => chooseAnchor({ label: `${c.label}, ${c.city}`, lat: c.lat, lng: c.lng })}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Move-in date">
                <input type="date" className={inputCls} value={intake.moveIn} onChange={(e) => set("moveIn", e.target.value)} />
              </Field>
              <Field label="Lease length">
                <select className={inputCls} value={intake.leaseMonths} onChange={(e) => set("leaseMonths", Number(e.target.value))}>
                  {[6, 9, 10, 12, 18, 24].map((m) => (
                    <option key={m} value={m}>
                      {m} months
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Field label={`Your monthly budget: $${intake.budget.toLocaleString()}`} hint="your share of rent">
              <input type="range" min={500} max={4000} step={50} value={intake.budget} onChange={(e) => set("budget", Number(e.target.value))} className="w-full" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="People (you + roommates)">
                <select className={inputCls} value={intake.people} onChange={(e) => set("people", Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "Just me" : `${n} people`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Minimum bedrooms">
                <select className={inputCls} value={intake.bedrooms} onChange={(e) => set("bedrooms", Number(e.target.value))}>
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "Studio OK" : `${n}+ bed`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              Total rent up to about <b>${(intake.budget * intake.people).toLocaleString()}/mo</b>. Listings up to 10% over your share are shown as a stretch.
            </p>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="How do you get there?">
              <div className="grid grid-cols-4 gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set("commuteMode", m.id)}
                    className={cx(
                      "rounded-lg py-2 text-sm font-medium ring-1 transition",
                      intake.commuteMode === m.id ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`Max door-to-door commute: ${intake.maxCommuteMin} min`}>
              <input type="range" min={10} max={75} step={5} value={intake.maxCommuteMin} onChange={(e) => set("maxCommuteMin", Number(e.target.value))} className="w-full" />
            </Field>
            <Field label="Need to arrive by" hint="we route at rush hour, not 3am">
              <input type="time" className={inputCls} value={intake.arriveBy} onChange={(e) => set("arriveBy", e.target.value)} />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <p className="text-sm font-medium text-slate-700">Amenities</p>
              <p className="text-xs text-slate-400">Click once for nice-to-have, use the toggle for dealbreakers.</p>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {AMENITIES.map((a) => {
                  const must = intake.mustHaves.includes(a);
                  const nice = intake.niceToHaves.includes(a);
                  return (
                    <div key={a} className={cx("flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ring-1", must ? "bg-indigo-600 text-white ring-indigo-600" : nice ? "bg-indigo-50 text-indigo-800 ring-indigo-200" : "bg-white text-slate-600 ring-slate-200")}>
                      <button type="button" className="flex-1 text-left capitalize" onClick={() => toggleAmenity("niceToHaves", a)}>
                        {a}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAmenity("mustHaves", a)}
                        className={cx("rounded px-1.5 text-[10px] font-semibold uppercase", must ? "bg-white/20" : "bg-slate-100 text-slate-500")}
                      >
                        {must ? "Must" : "Need?"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">What matters most?</p>
              <div className="mt-2 space-y-2">
                {(Object.keys(WEIGHT_LABELS) as (keyof Weights)[]).map((k) => (
                  <div key={k} className="flex items-center gap-3 text-sm">
                    <span className="w-40 text-slate-600">{WEIGHT_LABELS[k]}</span>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={intake.weights[k]}
                      onChange={(e) => set("weights", { ...intake.weights, [k]: Number(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="w-6 text-right tabular-nums text-slate-500">{intake.weights[k]}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Name">
                <input className={inputCls} value={intake.name} onChange={(e) => set("name", e.target.value)} placeholder="Jordan Lee" />
              </Field>
              <Field label="Email">
                <input className={inputCls} type="email" value={intake.email} onChange={(e) => set("email", e.target.value)} placeholder="you@school.edu" />
              </Field>
              <Field label="Phone">
                <input className={inputCls} value={intake.phone} onChange={(e) => set("phone", e.target.value)} placeholder="optional" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={intake.isStudent} onChange={(e) => set("isStudent", e.target.checked)} /> I&apos;m a student
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={intake.hasGuarantor} onChange={(e) => set("hasGuarantor", e.target.checked)} /> I have a guarantor
              </label>
            </div>
            <Field label="A line about you" hint="the agent uses this when messaging landlords">
              <input className={inputCls} value={intake.aboutMe} onChange={(e) => set("aboutMe", e.target.value)} placeholder="Grad student, quiet, non-smoker, no pets." />
            </Field>
            <Field label="When can you tour?">
              <div className="flex flex-wrap items-center gap-1.5">
                {DAYS.map((d, i) => {
                  const on = intake.availability.days.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        set("availability", {
                          ...intake.availability,
                          days: on ? intake.availability.days.filter((x) => x !== i) : [...intake.availability.days, i],
                        })
                      }
                      className={cx("w-11 rounded-lg py-1.5 text-xs font-medium ring-1", on ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-500 ring-slate-200")}
                    >
                      {d}
                    </button>
                  );
                })}
                <select
                  className={cx(inputCls, "ml-2 w-24")}
                  value={intake.availability.startHour}
                  onChange={(e) => set("availability", { ...intake.availability, startHour: Number(e.target.value) })}
                >
                  {Array.from({ length: 13 }, (_, i) => i + 8).map((h) => (
                    <option key={h} value={h}>
                      {h}:00
                    </option>
                  ))}
                </select>
                <span className="text-slate-400">to</span>
                <select
                  className={cx(inputCls, "w-24")}
                  value={intake.availability.endHour}
                  onChange={(e) => set("availability", { ...intake.availability, endHour: Number(e.target.value) })}
                >
                  {Array.from({ length: 13 }, (_, i) => i + 9).map((h) => (
                    <option key={h} value={h}>
                      {h}:00
                    </option>
                  ))}
                </select>
              </div>
            </Field>
          </>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-6 py-4">
        <Button variant="ghost" onClick={() => submit(demoIntake())} disabled={searching}>
          Try the Boston demo
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {last ? (
            <Button onClick={() => submit(intake)} disabled={!hasAnchor || searching || intake.availability.days.length === 0}>
              {searching ? "Searching 4 platforms..." : "Find my apartment"}
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
