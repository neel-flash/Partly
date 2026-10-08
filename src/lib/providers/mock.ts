import { marketRentPerBed, offsetLatLng } from "../geo";
import { createRng, type Rng } from "../rng";
import type { Amenity, Intake, Landlord, LeaseTerms, RawListing, Review, Source } from "../types";

/**
 * Demo provider. Generates a deterministic neighborhood of rentals around the
 * anchor and publishes each unit to one or more "platforms" with the same
 * formatting inconsistencies real cross-posts have, so the aggregator has real
 * de-duplication work to do.
 */

const STREETS = [
  "Maple", "Oak", "Cedar", "Elm", "Linden", "Chestnut", "Walnut", "Highland", "Prospect", "Union",
  "Franklin", "Washington", "Lincoln", "Harvard", "College", "University", "Park", "Grove", "Spring",
  "Summit", "Pleasant", "River", "Mill", "Church", "Center", "Bishop", "Jefferson", "Madison", "Hawthorne",
];
const SUFFIXES: [string, string][] = [
  ["Street", "St"],
  ["Avenue", "Ave"],
  ["Road", "Rd"],
  ["Place", "Pl"],
  ["Boulevard", "Blvd"],
  ["Terrace", "Ter"],
];
const NEIGHBORHOODS = ["Northside", "Old Town", "University Heights", "Riverside", "Midtown", "Eastgate", "West End", "Parkview"];
const BUILDING_NAMES = ["The Commons", "Lofts on", "Residences at", "The Standard", "Hub on", "Collegiate", "Union Flats"];
const PM_NAMES = ["Cornerstone Property Mgmt", "Keystone Living", "Brightside Residential", "Campus Edge Realty", "Greystar", "Ivy Residential"];
const FIRST = ["Dave", "Linda", "Raj", "Maria", "Tom", "Susan", "Kevin", "Grace", "Omar", "Helen", "Jorge", "Mei"];
const LAST = ["Kowalski", "Nguyen", "Patel", "Romero", "Fischer", "Okafor", "Chen", "Baker", "Haddad", "Silva"];
const STUDENTS = ["Priya S.", "Jake M.", "Ana R.", "Chris L.", "Fatima K.", "Ben T.", "Sophie W.", "Diego P.", "Hannah J.", "Marcus D."];

const POSITIVE_REVIEWS: [string, string[]][] = [
  ["Maintenance fixed our heater within a day. Super responsive management.", ["maintenance", "management"]],
  ["Quiet building, easy walk to campus. Would renew.", ["quiet", "location"]],
  ["Got my full deposit back with an itemized list. Fair landlord.", ["deposit", "management"]],
  ["Lots of other grad students here, felt safe walking home late.", ["safety", "community"]],
  ["Laundry always works and the unit was spotless at move-in.", ["condition"]],
  ["Landlord gave plenty of notice before entering. Very respectful.", ["management"]],
];
const NEGATIVE_REVIEWS: [string, string[]][] = [
  ["Took three weeks to fix a leaking ceiling. Emails ignored.", ["maintenance", "management"]],
  ["We had mice all winter. Pest control came once.", ["pests", "condition"]],
  ["Kept $600 of our deposit for 'cleaning' with no receipts.", ["deposit", "management"]],
  ["Thin walls, bars nearby are loud until 2am on weekends.", ["noise"]],
  ["Heat barely works in January. Bring a space heater.", ["condition"]],
  ["Lease auto-renewed and they charged a fee to break it. Read carefully.", ["lease"]],
  ["Landlord let himself in without notice twice.", ["management", "privacy"]],
];

const STANDARD_CLAUSES = [
  "Security deposit returned within 30 days of move-out with an itemized list of deductions.",
  "Landlord will provide 24 hours written notice before entering, except in emergencies.",
  "Tenant may sublet with written approval, which will not be unreasonably withheld.",
  "Landlord is responsible for repairs not caused by tenant negligence.",
  "Rent is due on the 1st; a late fee of $50 applies after a 5-day grace period.",
];
const PREDATORY_CLAUSES = [
  "Security deposit is non-refundable and covers professional cleaning.",
  "Lease automatically renews for 12 months unless tenant gives 90 days written notice.",
  "Landlord may enter the premises at any time without notice.",
  "Tenant is responsible for all repairs regardless of cause.",
  "Late fee of $25 per day after the 1st of the month.",
  "All tenants are jointly and severally liable for the full rent.",
  "Early termination fee equal to 3 months of rent.",
  "No subletting under any circumstances.",
];

function streetFor(rng: Rng) {
  const [full, abbr] = rng.pick(SUFFIXES);
  return { name: rng.pick(STREETS), full, abbr, number: rng.int(12, 1890) };
}

function makeReviews(rng: Rng, quality: number): Review[] {
  const count = rng.chance(0.15) ? 0 : rng.int(1, 6);
  const reviews: Review[] = [];
  for (let i = 0; i < count; i++) {
    const positive = rng.chance(quality);
    const [text, tags] = positive ? rng.pick(POSITIVE_REVIEWS) : rng.pick(NEGATIVE_REVIEWS);
    reviews.push({
      author: rng.pick(STUDENTS),
      rating: positive ? rng.int(4, 5) : rng.int(1, 3),
      text,
      tags,
      year: new Date().getFullYear() - rng.int(0, 3),
    });
  }
  return reviews;
}

function makeLease(rng: Rng, rent: number, shady: boolean, leaseMonths: number): LeaseTerms {
  const clauses = rng.sample(STANDARD_CLAUSES, rng.int(2, 4));
  if (shady) clauses.push(...rng.sample(PREDATORY_CLAUSES, rng.int(1, 3)));
  else if (rng.chance(0.25)) clauses.push(rng.pick(PREDATORY_CLAUSES));
  return {
    lengthMonths: rng.chance(0.7) ? leaseMonths : rng.pick([6, 9, 12]),
    deposit: Math.round(rent * (shady && rng.chance(0.5) ? rng.pick([2, 2.5, 3]) : rng.pick([0.5, 1, 1, 1.5]))),
    applicationFee: rng.pick([0, 25, 35, 50, shady ? 150 : 40]),
    brokerFee: rng.chance(0.2) ? Math.round(rent * rng.pick([0.5, 1, shady ? 1.5 : 1])) : 0,
    lateFee: shady ? "$25/day" : "$50 after 5 days",
    clauses,
  };
}

function amenitiesFor(rng: Rng): Amenity[] {
  const out: Amenity[] = [];
  if (rng.chance(0.4)) out.push("in-unit laundry");
  else if (rng.chance(0.6)) out.push("laundry on site");
  if (rng.chance(0.45)) out.push("parking");
  if (rng.chance(0.5)) out.push("pets allowed");
  if (rng.chance(0.2)) out.push("furnished");
  if (rng.chance(0.55)) out.push("air conditioning");
  if (rng.chance(0.5)) out.push("dishwasher");
  if (rng.chance(0.2)) out.push("gym");
  if (rng.chance(0.25)) out.push("utilities included");
  if (rng.chance(0.35)) out.push("bike storage");
  return out;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type BaseUnit = Omit<RawListing, "source" | "externalId" | "url" | "postedDaysAgo" | "title" | "address" | "unit"> & {
  street: ReturnType<typeof streetFor>;
  unitCode?: string;
  buildingName?: string;
  sources: Source[];
};

function generateUnits(intake: Intake): BaseUnit[] {
  const seed = `${intake.anchor.lat.toFixed(3)},${intake.anchor.lng.toFixed(3)}`;
  const rng = createRng(seed);
  const perBed = marketRentPerBed(intake.anchor);
  const units: BaseUnit[] = [];
  const total = 80;

  for (let i = 0; i < total; i++) {
    const distanceKm = Math.pow(rng.next(), 1.7) * 6 + 0.25;
    const point = offsetLatLng(intake.anchor, distanceKm, rng.range(0, Math.PI * 2));
    const beds = rng.pick([0, 1, 1, 2, 2, 2, 2, 3, 3, 4]);
    const isBuilding = rng.chance(0.45);
    const shady = rng.chance(0.18);
    const isScam = i >= total - 4;
    const proximityPremium = 1.18 - Math.min(distanceKm, 7) * 0.05;
    const bedFactor = beds === 0 ? 0.85 : beds;
    let rent = Math.round((perBed * rng.range(0.7, 1.3) * proximityPremium * bedFactor) / 5) * 5;
    if (isScam) rent = Math.round(rent * 0.5);

    const street = streetFor(rng);
    const name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    const landlord: Landlord = isBuilding
      ? {
          name: rng.pick(PM_NAMES),
          kind: "property manager",
          email: `leasing${i}@example-pm.com`,
          phone: `(555) 01${rng.int(10, 99)}-${rng.int(1000, 9999)}`,
          responseRate: rng.range(0.6, 0.95),
          avgResponseHours: rng.range(3, 30),
        }
      : isScam
        ? { name: rng.pick(FIRST), kind: "unknown", email: `${rng.pick(FIRST).toLowerCase()}${rng.int(10, 99)}@example-mail.com`, responseRate: 0.9, avgResponseHours: 1 }
        : {
            name,
            kind: "individual",
            email: `${name.split(" ")[0].toLowerCase()}.${i}@example.com`,
            phone: rng.chance(0.7) ? `(555) 01${rng.int(10, 99)}-${rng.int(1000, 9999)}` : undefined,
            responseRate: rng.range(0.25, 0.85),
            avgResponseHours: rng.range(6, 60),
          };

    const amenities = amenitiesFor(rng);
    const neighborhood = rng.pick(NEIGHBORHOODS);
    const descBits = [
      beds === 0 ? "Bright studio" : `Spacious ${beds}BR`,
      `in ${neighborhood}`,
      distanceKm < 1.5 ? "steps from campus." : "close to transit.",
      amenities.includes("in-unit laundry") ? "Washer/dryer in unit." : "",
      amenities.includes("utilities included") ? "Heat and hot water included." : "",
      rng.chance(0.3) ? "Students welcome!" : "",
      shady && rng.chance(0.5) ? "Cash preferred. Must sign same day to hold." : "",
      isScam
        ? rng.pick([
            "I am currently out of the country for work so I cannot show the apartment, but I can mail you the keys once you send the deposit via wire transfer.",
            "Deposit by Zelle only to hold the unit, keys will be mailed. Serious inquiries only.",
            "Pay with gift cards for first month and we will ship keys overnight.",
          ])
        : "",
    ].filter(Boolean);

    const sources: Source[] = isScam
      ? [rng.pick(["craigslist", "facebook"] as const)]
      : isBuilding
        ? rng.sample(["zillow", "apartments", "zillow", "apartments", "facebook"] as const, rng.int(1, 3))
        : rng.sample(["craigslist", "facebook", "zillow"] as const, rng.int(1, 2));

    units.push({
      street,
      unitCode: isBuilding || rng.chance(0.4) ? `${rng.int(1, 6)}${rng.pick(["A", "B", "C", "D"])}` : undefined,
      buildingName: isBuilding ? `${rng.pick(BUILDING_NAMES)} ${street.name}` : undefined,
      sources: Array.from(new Set(sources)),
      lat: point.lat,
      lng: point.lng,
      rent,
      beds,
      baths: beds <= 1 ? 1 : rng.pick([1, 1.5, 2]),
      sqft: Math.round((beds === 0 ? rng.range(380, 520) : beds * rng.range(380, 520)) / 10) * 10,
      availableFrom: addDays(intake.moveIn, rng.int(-30, 24)),
      amenities,
      description: descBits.join(" "),
      landlord,
      lease: isScam ? undefined : makeLease(rng, rent, shady, intake.leaseMonths),
      reviews: isScam ? [] : makeReviews(rng, shady ? 0.35 : 0.75),
      waitlistOnly: isBuilding && rng.chance(0.18),
      neighborhood,
      demo: true,
    });
  }
  return units;
}

function formatAddress(unit: BaseUnit, source: Source, rng: Rng): { address: string; unit?: string } {
  const s = unit.street;
  switch (source) {
    case "zillow":
      return { address: `${s.number} ${s.name} ${s.abbr}`, unit: unit.unitCode ? `Apt ${unit.unitCode}` : undefined };
    case "apartments":
      return { address: `${s.number} ${s.name} ${s.full}`, unit: unit.unitCode ? `Unit ${unit.unitCode}` : undefined };
    case "craigslist":
      return {
        address: rng.chance(0.5) ? `${s.number} ${s.name} ${s.abbr}.` : `${s.number} ${s.name.toLowerCase()} ${s.full.toLowerCase()}`,
        unit: unit.unitCode ? `#${unit.unitCode}` : undefined,
      };
    default:
      return { address: `${s.number} ${s.name} ${s.full}`, unit: unit.unitCode ? `#${unit.unitCode}` : undefined };
  }
}

function titleFor(unit: BaseUnit, source: Source): string {
  const bed = unit.beds === 0 ? "Studio" : `${unit.beds} Bed`;
  switch (source) {
    case "craigslist":
      return `$${unit.rent} / ${unit.beds === 0 ? "studio" : `${unit.beds}br`} - ${unit.neighborhood?.toLowerCase()} ${unit.amenities.includes("pets allowed") ? "(pets ok)" : ""}`.trim();
    case "facebook":
      return `${bed} apartment for rent in ${unit.neighborhood}`;
    default:
      return unit.buildingName ? `${unit.buildingName} · ${bed}` : `${bed}, ${unit.baths} Bath in ${unit.neighborhood}`;
  }
}

const SOURCE_URLS: Record<Source, string> = {
  zillow: "https://www.zillow.com/homedetails/",
  apartments: "https://www.apartments.com/",
  craigslist: "https://craigslist.org/apa/",
  facebook: "https://www.facebook.com/marketplace/item/",
  rentcast: "https://www.rentcast.io/",
};

export async function fetchMockSource(source: Source, intake: Intake): Promise<RawListing[]> {
  const units = generateUnits(intake);
  const rng = createRng(`${source}:${intake.anchor.lat.toFixed(3)}`);
  return units
    .filter((u) => u.sources.includes(source))
    .map((u, idx) => {
      const { address, unit } = formatAddress(u, source, rng);
      const priceJitter = source === "craigslist" ? -rng.int(0, 3) * 25 : source === "apartments" ? rng.int(0, 2) * 25 : 0;
      const rent = u.rent + priceJitter;
      const externalId = `${source}-${idx}-${u.street.number}`;
      return {
        source,
        externalId,
        url: `${SOURCE_URLS[source]}${externalId}`,
        title: titleFor({ ...u, rent }, source),
        address,
        unit,
        lat: u.lat + rng.range(-0.0002, 0.0002),
        lng: u.lng + rng.range(-0.0002, 0.0002),
        rent,
        beds: u.beds,
        baths: u.baths,
        sqft: source === "craigslist" && rng.chance(0.5) ? undefined : u.sqft,
        availableFrom: u.availableFrom,
        postedDaysAgo: rng.int(0, 21),
        amenities: u.amenities,
        description: u.description,
        landlord: u.landlord,
        lease: u.lease,
        reviews: u.reviews,
        waitlistOnly: u.waitlistOnly,
        neighborhood: u.neighborhood,
        demo: true,
      } satisfies RawListing;
    });
}
