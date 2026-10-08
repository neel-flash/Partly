import { createRng } from "./rng";
import {
  answerTemplate,
  confirmTemplate,
  followUpTemplate,
  formatSlot,
  inquiryTemplate,
  landlordReplies,
  moreSlotsTemplate,
  waitlistTemplate,
} from "./templates";
import type { AgentEvent, Channel, Intake, LandlordPlan, Lead, ScoredListing } from "./types";

const HOUR = 3_600_000;
const FOLLOW_UP_AFTER_H = 48;
const MAX_FOLLOW_UPS = 2;
const TOUR_MINUTES = 30;
const TOUR_BUFFER_MIN = 45;
const FOLLOW_UP_CHANNELS: Channel[] = ["sms", "call"];

export type AgentState = {
  clock: number;
  leads: Record<string, Lead>;
  log: AgentEvent[];
};

/** Leads the agent is still actively working. */
export function isActive(lead: Lead): boolean {
  return (
    lead.stage === "queued" ||
    lead.stage === "awaiting" ||
    lead.stage === "replied" ||
    (lead.stage === "waitlisted" && lead.plan?.waitlistOpensAfterHours != null && !lead.tour)
  );
}

/**
 * Simulated landlord behaviour for demo listings, seeded per listing so a
 * replay produces the same conversation. Real deployments replace this with
 * inbound email/SMS webhooks that set `pendingReplyAt`.
 */
function planFor(listing: ScoredListing, intake: Intake): LandlordPlan {
  const rng = createRng(`${listing.id}:${intake.email}`);
  const { responseRate, avgResponseHours } = listing.landlord;
  return {
    willRespond: rng.chance(responseRate),
    delayHours: Math.max(1, Math.round(avgResponseHours * rng.range(0.4, 1.6))),
    asksQuestion: rng.chance(0.4),
    slots: [],
    waitlistPosition: rng.int(2, 9),
    waitlistOpensAfterHours: rng.chance(0.45) ? rng.int(36, 140) : null,
  };
}

function generateSlots(seed: string, from: number, intake: Intake, mustFit: boolean): number[] {
  const rng = createRng(seed);
  const slots: number[] = [];
  let guard = 0;
  while (slots.length < 3 && guard++ < 200) {
    const d = new Date(from);
    d.setDate(d.getDate() + rng.int(1, 6));
    const hour = mustFit ? rng.int(intake.availability.startHour, Math.max(intake.availability.startHour, intake.availability.endHour - 1)) : rng.int(10, 18);
    d.setHours(hour, rng.pick([0, 30]), 0, 0);
    const t = d.getTime();
    if (mustFit && !fitsAvailability(t, intake)) continue;
    if (!slots.some((s) => Math.abs(s - t) < 2 * HOUR)) slots.push(t);
  }
  return slots.sort((a, b) => a - b);
}

export function fitsAvailability(slot: number, intake: Intake): boolean {
  const d = new Date(slot);
  const startH = d.getHours() + d.getMinutes() / 60;
  return (
    intake.availability.days.includes(d.getDay()) &&
    startH >= intake.availability.startHour &&
    startH + TOUR_MINUTES / 60 <= intake.availability.endHour
  );
}

function conflicts(slot: number, leads: Record<string, Lead>): boolean {
  const pad = (TOUR_MINUTES + TOUR_BUFFER_MIN) * 60_000;
  return Object.values(leads).some((l) => l.tour && Math.abs(l.tour.start - slot) < pad);
}

export function startOutreach(state: AgentState, listingIds: string[], now: number): AgentState {
  const leads = { ...state.leads };
  for (const id of listingIds) {
    const lead = leads[id];
    if (lead && (lead.stage === "shortlisted" || lead.stage === "dismissed")) leads[id] = { ...lead, stage: "queued" };
  }
  const clock = state.clock && state.clock > now ? state.clock : Math.ceil(now / HOUR) * HOUR;
  return { ...state, clock, leads };
}

/** Advance the simulated clock hour by hour, letting the agent act on every lead. */
export function stepAgent(
  state: AgentState,
  hours: number,
  listings: ScoredListing[],
  intake: Intake,
  autoBackfill: boolean,
): AgentState {
  const byId = new Map(listings.map((l) => [l.id, l]));
  const leads: Record<string, Lead> = structuredClone(state.leads);
  const log = [...state.log];
  let clock = state.clock;
  let seq = 0;

  const event = (e: Omit<AgentEvent, "id" | "at">) => log.unshift({ ...e, id: `${clock}-${seq++}`, at: clock });
  const say = (lead: Lead, from: "agent" | "landlord", channel: Channel, body: string, at = clock) => {
    lead.messages.push({ id: `${lead.listingId}-${lead.messages.length}`, from, channel, body, at });
    if (from === "agent") lead.lastAgentAt = at;
  };

  const tryBook = (lead: Lead, listing: ScoredListing, slots: number[]) => {
    lead.offeredSlots = slots;
    const pick = slots.find((s) => s > clock && fitsAvailability(s, intake) && !conflicts(s, leads));
    if (pick) {
      say(lead, "agent", "email", confirmTemplate(pick), clock + 0.2 * HOUR);
      lead.tour = {
        start: pick,
        end: pick + TOUR_MINUTES * 60_000,
        address: `${listing.address}${listing.unit ? ` ${listing.unit}` : ""}`,
        contact: [listing.landlord.name, listing.landlord.phone ?? listing.landlord.email].filter(Boolean).join(" · "),
      };
      lead.stage = "tour_booked";
      lead.pendingReplyAt = undefined;
      event({ kind: "booked", listingId: lead.listingId, text: `Booked tour at ${listing.address} for ${formatSlot(pick)}` });
    } else {
      say(lead, "agent", "email", moreSlotsTemplate(intake), clock + 0.2 * HOUR);
      lead.stage = "awaiting";
      lead.pendingReplyKind = "more-slots";
      lead.pendingReplyAt = clock + Math.max(2, (lead.plan?.delayHours ?? 6) / 2) * HOUR;
      event({ kind: "info", listingId: lead.listingId, text: `No offered times fit your schedule at ${listing.address}; asked for alternatives` });
    }
  };

  const backfill = () => {
    if (!autoBackfill) return;
    const next = listings.find((l) => !l.excluded.length && !leads[l.id]);
    if (!next) return;
    leads[next.id] = { listingId: next.id, stage: "queued", addedAt: clock, messages: [], followUps: 0, notes: "" };
    event({ kind: "backfill", listingId: next.id, text: `Added next-best match ${next.address} (score ${next.scores.total}) to replace a ghosted lead` });
  };

  for (let h = 0; h < hours; h++) {
    clock += HOUR;
    for (const lead of Object.values(leads)) {
      const listing = byId.get(lead.listingId);
      if (!listing) continue;

      if (lead.stage === "queued") {
        lead.plan = planFor(listing, intake);
        if (listing.waitlistOnly) {
          say(lead, "agent", "email", waitlistTemplate(listing, intake));
          lead.stage = "awaiting";
          lead.pendingReplyKind = "waitlist";
          lead.pendingReplyAt = clock + Math.min(lead.plan.delayHours, 24) * HOUR;
          event({ kind: "waitlist", listingId: lead.listingId, text: `Requested a waitlist spot at ${listing.address}` });
        } else {
          const channel: Channel = listing.postings.some((p) => p.source === "facebook" || p.source === "craigslist") && !listing.landlord.email ? "platform" : "email";
          say(lead, "agent", channel, lead.draft ?? inquiryTemplate(listing, intake));
          lead.stage = "awaiting";
          lead.pendingReplyKind = lead.plan.asksQuestion ? "question" : "slots";
          lead.pendingReplyAt = lead.plan.willRespond ? clock + lead.plan.delayHours * HOUR : undefined;
          event({ kind: "sent", listingId: lead.listingId, text: `Messaged ${listing.landlord.name} about ${listing.address}` });
        }
        continue;
      }

      if (lead.stage === "awaiting" && lead.pendingReplyAt && clock >= lead.pendingReplyAt) {
        const kind = lead.pendingReplyKind;
        lead.pendingReplyAt = undefined;
        if (kind === "question") {
          say(lead, "landlord", "email", landlordReplies.question(listing));
          say(lead, "agent", "email", answerTemplate(intake), clock + 0.1 * HOUR);
          lead.stage = "awaiting";
          lead.pendingReplyKind = "slots";
          lead.pendingReplyAt = clock + Math.max(1, Math.round((lead.plan?.delayHours ?? 6) / 3)) * HOUR;
          event({ kind: "reply", listingId: lead.listingId, text: `${listing.landlord.name} asked about income/guarantor; agent answered from your profile` });
        } else if (kind === "slots" || kind === "more-slots") {
          const slots = generateSlots(`${lead.listingId}:${kind}:${clock}`, clock, intake, kind === "more-slots");
          say(lead, "landlord", "email", kind === "slots" ? landlordReplies.slots(listing, slots) : landlordReplies.moreSlots(slots));
          lead.stage = "replied";
          event({ kind: "reply", listingId: lead.listingId, text: `${listing.landlord.name} replied with ${slots.length} viewing times` });
          tryBook(lead, listing, slots);
        } else if (kind === "waitlist") {
          say(lead, "landlord", "email", landlordReplies.waitlist(lead.plan?.waitlistPosition ?? 4));
          lead.stage = "waitlisted";
          event({ kind: "waitlist", listingId: lead.listingId, text: `You're #${lead.plan?.waitlistPosition} on the waitlist at ${listing.address}` });
        }
        continue;
      }

      if (lead.stage === "awaiting" && !lead.pendingReplyAt && lead.lastAgentAt && clock - lead.lastAgentAt >= FOLLOW_UP_AFTER_H * HOUR) {
        if (lead.followUps < MAX_FOLLOW_UPS) {
          const channel = FOLLOW_UP_CHANNELS[lead.followUps];
          lead.followUps += 1;
          say(lead, "agent", channel, followUpTemplate(listing, intake, lead.followUps));
          const rng = createRng(`${lead.listingId}:fu:${lead.followUps}`);
          if (rng.chance(0.35)) {
            lead.pendingReplyKind = "slots";
            lead.pendingReplyAt = clock + rng.int(2, 20) * HOUR;
          }
          event({
            kind: "followup",
            listingId: lead.listingId,
            text: `No reply in ${FOLLOW_UP_AFTER_H}h from ${listing.address}; ${channel === "call" ? "left a voicemail" : "followed up by text"}`,
          });
        } else {
          lead.stage = "ghosted";
          event({ kind: "ghosted", listingId: lead.listingId, text: `${listing.landlord.name} never responded about ${listing.address}. Marked as ghosted` });
          backfill();
        }
        continue;
      }

      if (lead.stage === "waitlisted" && !lead.tour && lead.plan?.waitlistOpensAfterHours != null && lead.lastAgentAt) {
        if (clock - lead.lastAgentAt >= lead.plan.waitlistOpensAfterHours * HOUR) {
          const slots = generateSlots(`${lead.listingId}:wl:${clock}`, clock, intake, true);
          say(lead, "landlord", "email", landlordReplies.waitlistOpen(slots));
          event({ kind: "waitlist", listingId: lead.listingId, text: `A unit opened at ${listing.address}!` });
          lead.plan.waitlistOpensAfterHours = null;
          tryBook(lead, listing, slots);
        }
      }
    }
  }

  return { clock, leads, log: log.slice(0, 300) };
}
