import { dedupe } from "@/lib/aggregate";
import { estimateCommute, googleCommutes } from "@/lib/commute";
import { fetchMockSource } from "@/lib/providers/mock";
import { fetchRentcast } from "@/lib/providers/rentcast";
import type { Commute, Intake, ListingWithCommute, RawListing, SearchResponse, Source } from "@/lib/types";

export async function POST(request: Request) {
  const intake = (await request.json()) as Intake;
  if (!intake?.anchor || !Number.isFinite(intake.anchor.lat) || !Number.isFinite(intake.budget)) {
    return Response.json({ error: "Invalid intake" }, { status: 400 });
  }

  const demoEnabled = process.env.PARTLY_DEMO_LISTINGS !== "off";
  const jobs: { source: Source; live: boolean; run: () => Promise<RawListing[]> }[] = [];
  if (demoEnabled) {
    for (const source of ["zillow", "apartments", "craigslist", "facebook"] as const) {
      jobs.push({ source, live: false, run: () => fetchMockSource(source, intake) });
    }
  }
  const rentcastKey = process.env.RENTCAST_API_KEY;
  if (rentcastKey) jobs.push({ source: "rentcast", live: true, run: () => fetchRentcast(intake, rentcastKey) });

  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const raw: RawListing[] = [];
  const sources = jobs.map((job, i) => {
    const result = settled[i];
    if (result.status === "fulfilled") raw.push(...result.value);
    else console.error(`[search] ${job.source} failed:`, result.reason);
    return { source: job.source, count: result.status === "fulfilled" ? result.value.length : 0, live: job.live };
  });

  const listings = dedupe(raw);

  let commutes: (Commute | null)[] = [];
  let commuteProvider: "google" | "estimate" = "estimate";
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (mapsKey) {
    try {
      commutes = await googleCommutes(listings, intake.anchor, intake.commuteMode, intake.arriveBy, mapsKey);
      commuteProvider = "google";
    } catch (err) {
      console.error("[search] Google commute lookup failed, falling back to estimates:", err);
    }
  }

  const withCommute: ListingWithCommute[] = listings.map((l, i) => ({
    ...l,
    commute: commutes[i] ?? estimateCommute(l, intake.anchor, intake.commuteMode),
  }));

  const perBed = withCommute.map((l) => l.rent / Math.max(1, l.beds)).sort((a, b) => a - b);
  const medianRentPerBed = perBed.length ? perBed[Math.floor(perBed.length / 2)] : 0;

  const body: SearchResponse = {
    listings: withCommute,
    meta: { rawCount: raw.length, dedupedCount: listings.length, sources, commuteProvider, medianRentPerBed },
  };
  return Response.json(body);
}
