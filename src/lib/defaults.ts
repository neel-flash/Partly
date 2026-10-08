import { CAMPUSES } from "./geo";
import { DEFAULT_WEIGHTS } from "./scoring";
import type { Intake } from "./types";

function inDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function blankIntake(): Intake {
  return {
    name: "",
    email: "",
    phone: "",
    budget: 1400,
    people: 1,
    bedrooms: 0,
    anchorLabel: "",
    anchor: { lat: NaN, lng: NaN },
    moveIn: inDays(45),
    leaseMonths: 12,
    commuteMode: "transit",
    maxCommuteMin: 30,
    arriveBy: "09:00",
    mustHaves: [],
    niceToHaves: ["in-unit laundry", "dishwasher"],
    weights: { ...DEFAULT_WEIGHTS },
    availability: { days: [1, 2, 3, 4, 5, 6], startHour: 15, endHour: 19 },
    hasGuarantor: true,
    isStudent: true,
    aboutMe: "",
  };
}

export function demoIntake(): Intake {
  const bu = CAMPUSES.find((c) => c.label === "Boston University")!;
  return {
    ...blankIntake(),
    name: "Jordan Lee",
    email: "jordan.lee@example.edu",
    phone: "(555) 010-2244",
    budget: 1500,
    people: 2,
    bedrooms: 2,
    anchorLabel: `${bu.label}, ${bu.city}`,
    anchor: { lat: bu.lat, lng: bu.lng },
    maxCommuteMin: 35,
    mustHaves: [],
    niceToHaves: ["in-unit laundry", "dishwasher", "air conditioning"],
    aboutMe: "I'm a first-year MS student, quiet, non-smoker, no pets.",
  };
}
