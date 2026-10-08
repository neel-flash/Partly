import { haversineKm } from "./geo";
import { hashString } from "./rng";
import type { Listing, RawListing, Source } from "./types";

const SUFFIX_MAP: Record<string, string> = {
  street: "st",
  avenue: "ave",
  road: "rd",
  place: "pl",
  boulevard: "blvd",
  terrace: "ter",
  drive: "dr",
  lane: "ln",
  court: "ct",
};

export function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SUFFIX_MAP[w] ?? w)
    .join(" ");
}

export function normalizeUnit(unit?: string): string {
  return (unit ?? "").toLowerCase().replace(/^(apt|unit|suite|ste|#)\s*/i, "").replace(/[^a-z0-9]/g, "");
}

function displayAddress(address: string): string {
  const cleaned = address.replace(/\.$/, "").trim();
  return cleaned === cleaned.toLowerCase() ? cleaned.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : cleaned;
}

const SOURCE_PRIORITY: Source[] = ["rentcast", "apartments", "zillow", "facebook", "craigslist"];

/**
 * Merges cross-posted units. Two postings are the same unit when the normalized
 * street address, unit and bedroom count match and they sit within ~100m.
 */
export function dedupe(raw: RawListing[]): Listing[] {
  const groups = new Map<string, RawListing[]>();
  for (const r of raw) {
    const key = `${normalizeAddress(r.address)}|${normalizeUnit(r.unit)}|${r.beds}`;
    const bucket = groups.get(key);
    if (bucket && haversineKm(bucket[0], r) < 0.1) bucket.push(r);
    else groups.set(bucket ? `${key}|${r.externalId}` : key, [r]);
  }

  return Array.from(groups.entries()).map(([key, postings]) => {
    const sorted = [...postings].sort((a, b) => SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source));
    const primary = sorted[0];
    const richest = [...postings].sort((a, b) => (b.lease ? 1 : 0) - (a.lease ? 1 : 0) || b.reviews.length - a.reviews.length)[0];
    const lowestPrice = Math.min(...postings.map((p) => p.rent));
    const id = `l${hashString(key).toString(36)}`;
    return {
      id,
      title: primary.title,
      address: displayAddress(primary.address),
      unit: primary.unit,
      lat: primary.lat,
      lng: primary.lng,
      rent: lowestPrice,
      beds: primary.beds,
      baths: primary.baths,
      sqft: postings.find((p) => p.sqft)?.sqft,
      availableFrom: primary.availableFrom,
      amenities: Array.from(new Set(postings.flatMap((p) => p.amenities))),
      description: richest.description,
      landlord: richest.landlord,
      lease: richest.lease,
      reviews: richest.reviews,
      waitlistOnly: postings.every((p) => p.waitlistOnly),
      neighborhood: primary.neighborhood,
      demo: primary.demo,
      lowestPrice,
      hue: hashString(id) % 360,
      postings: sorted.map((p) => ({
        source: p.source,
        externalId: p.externalId,
        url: p.url,
        price: p.rent,
        postedDaysAgo: p.postedDaysAgo,
        title: p.title,
      })),
    } satisfies Listing;
  });
}
