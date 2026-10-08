import type { Intake, Listing } from "./types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatSlot(ms: number): string {
  return new Date(ms).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatHour(h: number) {
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}

export function availabilitySummary(intake: Intake): string {
  const days = [...intake.availability.days].sort().map((d) => DAY_NAMES[d]).join(", ");
  return `${days}, ${formatHour(intake.availability.startHour)}-${formatHour(intake.availability.endHour)}`;
}

function firstName(listing: Listing) {
  return listing.landlord.kind === "individual" ? listing.landlord.name.split(" ")[0] : "there";
}

function unitLabel(listing: Listing) {
  return `${listing.address}${listing.unit ? ` ${listing.unit}` : ""}`;
}

function signature(intake: Intake) {
  return [`Thanks,`, intake.name || "Partly user", [intake.email, intake.phone].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
}

export function inquiryTemplate(listing: Listing, intake: Intake): string {
  const moveIn = new Date(intake.moveIn + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const who = intake.isStudent ? "a student" : "a recent grad relocating for work";
  const roommates = intake.people > 1 ? ` with ${intake.people - 1} roommate${intake.people > 2 ? "s" : ""}` : "";
  const questions = [
    `Is it still available for a ${moveIn} move-in?`,
    "What's the total monthly cost including utilities and any fees?",
    `Do you offer a ${intake.leaseMonths}-month lease, and could you send a copy of the lease to review?`,
  ];
  if (intake.mustHaves.includes("pets allowed")) questions.push("Can you confirm pets are allowed, and any pet fees?");

  return [
    `Hi ${firstName(listing)},`,
    "",
    `I'm ${intake.name || "reaching out"}, ${who}${roommates}, and I'm very interested in ${unitLabel(listing)}. ${intake.aboutMe}`.trim(),
    "",
    ...questions.map((q) => `- ${q}`),
    "",
    `I'd love to schedule a viewing. I'm free ${availabilitySummary(intake)}. ${intake.hasGuarantor ? "I have a guarantor and can provide references." : "I can provide references and proof of income."}`,
    "",
    signature(intake),
  ].join("\n");
}

export function waitlistTemplate(listing: Listing, intake: Intake): string {
  return [
    `Hi ${firstName(listing)},`,
    "",
    `I see ${listing.address} is currently full. I'd like to be added to the waitlist for a ${listing.beds === 0 ? "studio" : `${listing.beds}-bedroom`} starting around ${intake.moveIn}. Please let me know my position and notify me as soon as a unit opens. I can tour on short notice.`,
    "",
    signature(intake),
  ].join("\n");
}

export function followUpTemplate(listing: Listing, intake: Intake, attempt: number): string {
  if (attempt === 1) {
    return `Hi ${firstName(listing)}, just following up on my message about ${unitLabel(listing)}. Still very interested and free ${availabilitySummary(intake)} for a viewing. - ${intake.name || "Partly user"}`;
  }
  return `Hi, this is ${intake.name || "a prospective tenant"} calling about ${unitLabel(listing)}. I sent an email earlier this week. I'd like to schedule a viewing. You can reach me at ${intake.phone || intake.email}.`;
}

export function answerTemplate(intake: Intake): string {
  return [
    "Happy to share:",
    `- ${intake.isStudent ? "Full-time student" : "Working professional"}${intake.people > 1 ? `, moving in with ${intake.people - 1} roommate(s)` : ""}`,
    `- ${intake.hasGuarantor ? "Guarantor available (parent), credit check welcome" : "Can show proof of income / savings and pass a credit check"}`,
    `- Budget about $${intake.budget * intake.people}/mo total, ${intake.leaseMonths}-month lease`,
    "Could we set up a time to see the unit?",
  ].join("\n");
}

export function confirmTemplate(slot: number): string {
  return `${formatSlot(slot)} works great, see you then! Please send the exact unit number and whether I should buzz or meet you outside.`;
}

export function moreSlotsTemplate(intake: Intake): string {
  return `Thanks! Unfortunately none of those work with my class schedule. Would any time ${availabilitySummary(intake)} work instead?`;
}

export const landlordReplies = {
  question: (listing: Listing) =>
    `Hi, thanks for reaching out about ${listing.address}. Before we schedule, are you a student, and do you have a guarantor or proof of income? Rent is $${listing.rent}${listing.amenities.includes("utilities included") ? " with heat and hot water included" : " plus utilities (~$90/mo)"}.`,
  slots: (listing: Listing, slots: number[]) =>
    [
      `Yes, ${listing.address} is still available. I can show it:`,
      ...slots.map((s) => `- ${formatSlot(s)}`),
      `Lease is ${listing.lease?.lengthMonths ?? 12} months${listing.lease ? `, $${listing.lease.deposit} deposit` : ""}. Let me know which works.`,
    ].join("\n"),
  moreSlots: (slots: number[]) => [`No problem. How about:`, ...slots.map((s) => `- ${formatSlot(s)}`)].join("\n"),
  waitlist: (position: number) =>
    `Thanks for your interest! You're #${position} on our waitlist. We'll reach out as soon as a matching unit opens.`,
  waitlistOpen: (slots: number[]) =>
    [`Good news: a unit just opened up and you're next on the list. Can you tour at one of these times?`, ...slots.map((s) => `- ${formatSlot(s)}`)].join("\n"),
};
