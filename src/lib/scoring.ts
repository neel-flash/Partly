import { detectFlags } from "./lease";
import type { Intake, ListingWithCommute, ScoredListing, Weights } from "./types";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export const DEFAULT_WEIGHTS: Weights = { price: 30, commute: 25, reviews: 20, lease: 15, amenities: 10 };

const SEVERITY_PENALTY = { high: 40, medium: 15, low: 5 } as const;

/** Bayesian average so one 5-star review doesn't beat twenty 4.5-star reviews. */
function reviewScore(ratings: number[]): { score: number; avg: number } {
  const prior = 3.4;
  const m = 3;
  const sum = ratings.reduce((s, r) => s + r, 0);
  const avg = ratings.length ? sum / ratings.length : 0;
  const bayes = (prior * m + sum) / (m + ratings.length);
  return { score: clamp(((bayes - 1) / 4) * 100), avg };
}

export function scoreListings(listings: ListingWithCommute[], intake: Intake, medianRentPerBed: number): ScoredListing[] {
  const w = intake.weights;
  const weightSum = w.price + w.commute + w.reviews + w.lease + w.amenities || 1;
  const wanted = intake.niceToHaves;

  return listings
    .map((l) => {
      const share = Math.round(l.rent / Math.max(1, intake.people));
      const flags = detectFlags(l, medianRentPerBed);
      const excluded: string[] = [];

      if (l.beds < intake.bedrooms) excluded.push(`Only ${l.beds === 0 ? "a studio" : `${l.beds} bed`}`);
      if (share > intake.budget * 1.1) excluded.push(`$${share}/person is over budget`);
      if (l.commute.minutes > intake.maxCommuteMin) excluded.push(`${l.commute.minutes} min commute`);
      const missing = intake.mustHaves.filter((a) => !l.amenities.includes(a));
      if (missing.length) excluded.push(`Missing ${missing.join(", ")}`);
      const moveInGap = (new Date(l.availableFrom).getTime() - new Date(intake.moveIn).getTime()) / 86_400_000;
      if (!l.waitlistOnly && moveInGap > 14) excluded.push(`Not available until ${l.availableFrom}`);
      if (flags.some((f) => f.kind === "scam" && f.severity === "high")) excluded.push("Likely scam");

      const ratio = share / intake.budget;
      const price = clamp(100 - (ratio - 0.6) * 125);
      const commute = clamp(100 - ((l.commute.minutes - 8) / Math.max(1, intake.maxCommuteMin - 8)) * 70);
      const { score: reviews, avg } = reviewScore(l.reviews.map((r) => r.rating));
      const lease = clamp(100 - flags.reduce((s, f) => s + SEVERITY_PENALTY[f.severity], 0));
      const amenities = wanted.length
        ? (wanted.filter((a) => l.amenities.includes(a)).length / wanted.length) * 100
        : clamp(40 + l.amenities.length * 10);

      const total =
        (price * w.price + commute * w.commute + reviews * w.reviews + lease * w.lease + amenities * w.amenities) / weightSum;

      return {
        ...l,
        share,
        flags,
        excluded,
        reviewAvg: avg,
        scores: {
          price: Math.round(price),
          commute: Math.round(commute),
          reviews: Math.round(reviews),
          lease: Math.round(lease),
          amenities: Math.round(amenities),
          total: Math.round(total),
        },
      } satisfies ScoredListing;
    })
    .sort((a, b) => a.excluded.length - b.excluded.length || b.scores.total - a.scores.total);
}

export function grade(total: number): string {
  if (total >= 85) return "A";
  if (total >= 75) return "B+";
  if (total >= 65) return "B";
  if (total >= 55) return "C";
  return "D";
}
