export type Source = "zillow" | "apartments" | "craigslist" | "facebook" | "rentcast";

export const SOURCE_LABELS: Record<Source, string> = {
  zillow: "Zillow",
  apartments: "Apartments.com",
  craigslist: "Craigslist",
  facebook: "FB Marketplace",
  rentcast: "RentCast (MLS)",
};

export type CommuteMode = "transit" | "walk" | "bike" | "drive";

export type Amenity =
  | "in-unit laundry"
  | "laundry on site"
  | "parking"
  | "pets allowed"
  | "furnished"
  | "air conditioning"
  | "dishwasher"
  | "gym"
  | "utilities included"
  | "bike storage";

export const AMENITIES: Amenity[] = [
  "in-unit laundry",
  "laundry on site",
  "parking",
  "pets allowed",
  "furnished",
  "air conditioning",
  "dishwasher",
  "gym",
  "utilities included",
  "bike storage",
];

export type LatLng = { lat: number; lng: number };

export type Weights = {
  price: number;
  commute: number;
  reviews: number;
  lease: number;
  amenities: number;
};

export type Availability = {
  days: number[]; // 0 = Sunday
  startHour: number;
  endHour: number;
};

export type Intake = {
  name: string;
  email: string;
  phone: string;
  budget: number; // the user's share per month
  people: number; // user + roommates
  bedrooms: number; // minimum, 0 = studio
  anchorLabel: string;
  anchor: LatLng;
  moveIn: string; // yyyy-mm-dd
  leaseMonths: number;
  commuteMode: CommuteMode;
  maxCommuteMin: number;
  arriveBy: string; // HH:mm, used for peak-hour routing
  mustHaves: Amenity[];
  niceToHaves: Amenity[];
  weights: Weights;
  availability: Availability;
  hasGuarantor: boolean;
  isStudent: boolean;
  aboutMe: string;
};

export type SourcePosting = {
  source: Source;
  externalId: string;
  url: string;
  price: number;
  postedDaysAgo: number;
  title: string;
};

export type Review = {
  author: string;
  rating: number;
  text: string;
  tags: string[];
  year: number;
};

export type Landlord = {
  name: string;
  kind: "property manager" | "individual" | "unknown";
  email?: string;
  phone?: string;
  responseRate: number; // 0..1, used by the simulated landlord
  avgResponseHours: number;
};

export type LeaseTerms = {
  lengthMonths: number;
  deposit: number;
  applicationFee: number;
  brokerFee: number;
  lateFee: string;
  clauses: string[];
};

/** One raw posting as returned by a single provider, before de-duplication. */
export type RawListing = {
  source: Source;
  externalId: string;
  url: string;
  title: string;
  address: string;
  unit?: string;
  lat: number;
  lng: number;
  rent: number;
  beds: number;
  baths: number;
  sqft?: number;
  availableFrom: string;
  postedDaysAgo: number;
  amenities: Amenity[];
  description: string;
  landlord: Landlord;
  lease?: LeaseTerms;
  reviews: Review[];
  waitlistOnly: boolean;
  neighborhood?: string;
  demo: boolean;
};

/** A unit after merging postings from every platform it appears on. */
export type Listing = Omit<RawListing, "source" | "externalId" | "url" | "postedDaysAgo" | "title"> & {
  id: string;
  title: string;
  postings: SourcePosting[];
  lowestPrice: number;
  hue: number;
};

export type CommuteLeg = { label: string; minutes: number };

export type Commute = {
  mode: CommuteMode;
  minutes: number;
  distanceKm: number;
  legs: CommuteLeg[];
  provider: "google" | "estimate";
};

export type ListingWithCommute = Listing & { commute: Commute };

export type FlagSeverity = "high" | "medium" | "low";

export type Flag = {
  id: string;
  severity: FlagSeverity;
  label: string;
  detail: string;
  kind: "lease" | "scam" | "listing";
};

export type Scores = {
  price: number;
  commute: number;
  reviews: number;
  lease: number;
  amenities: number;
  total: number;
};

export type ScoredListing = ListingWithCommute & {
  share: number;
  scores: Scores;
  flags: Flag[];
  excluded: string[];
  reviewAvg: number;
};

export type SearchResponse = {
  listings: ListingWithCommute[];
  meta: {
    rawCount: number;
    dedupedCount: number;
    sources: { source: Source; count: number; live: boolean }[];
    commuteProvider: "google" | "estimate";
    medianRentPerBed: number;
  };
};

export type LeadStage =
  | "shortlisted"
  | "queued"
  | "awaiting"
  | "replied"
  | "tour_booked"
  | "toured"
  | "applied"
  | "waitlisted"
  | "ghosted"
  | "dismissed";

export const STAGE_LABELS: Record<LeadStage, string> = {
  shortlisted: "Shortlisted",
  queued: "Queued for outreach",
  awaiting: "Awaiting reply",
  replied: "Replied",
  tour_booked: "Tour booked",
  toured: "Toured",
  applied: "Applied",
  waitlisted: "On waitlist",
  ghosted: "Ghosted",
  dismissed: "Dismissed",
};

export type Channel = "email" | "sms" | "platform" | "call";

export type Message = {
  id: string;
  from: "agent" | "landlord";
  channel: Channel;
  body: string;
  at: number;
};

export type Tour = { start: number; end: number; address: string; contact: string };

export type LandlordPlan = {
  willRespond: boolean;
  delayHours: number;
  asksQuestion: boolean;
  slots: number[];
  waitlistPosition: number;
  waitlistOpensAfterHours: number | null;
};

export type Lead = {
  listingId: string;
  stage: LeadStage;
  addedAt: number;
  messages: Message[];
  draft?: string;
  draftSource?: "ai" | "template";
  followUps: number;
  lastAgentAt?: number;
  plan?: LandlordPlan;
  pendingReplyAt?: number;
  pendingReplyKind?: "question" | "slots" | "more-slots" | "waitlist" | "waitlist-open";
  offeredSlots?: number[];
  tour?: Tour;
  notes: string;
};

export type AgentEvent = {
  id: string;
  at: number;
  listingId?: string;
  kind: "sent" | "reply" | "booked" | "followup" | "ghosted" | "backfill" | "waitlist" | "info";
  text: string;
};
