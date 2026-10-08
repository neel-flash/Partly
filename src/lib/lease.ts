import type { Flag, Listing } from "./types";

type Rule = {
  id: string;
  kind: Flag["kind"];
  severity: Flag["severity"];
  label: string;
  pattern: RegExp;
  detail: string;
};

const TEXT_RULES: Rule[] = [
  {
    id: "nonrefundable-deposit",
    kind: "lease",
    severity: "high",
    label: "Non-refundable deposit",
    pattern: /deposit[^.]*non-?refundable|non-?refundable[^.]*deposit/i,
    detail: "Security deposits are refundable by law in most states. A 'non-refundable deposit' is usually a disguised fee.",
  },
  {
    id: "entry-without-notice",
    kind: "lease",
    severity: "high",
    label: "Entry without notice",
    pattern: /enter[^.]*(any time|without notice)/i,
    detail: "Most states require 24 hours notice before a landlord enters, except emergencies.",
  },
  {
    id: "all-repairs",
    kind: "lease",
    severity: "high",
    label: "Tenant pays all repairs",
    pattern: /responsible for all repairs/i,
    detail: "Landlords are generally obligated to keep the unit habitable. Shifting every repair to you is a major red flag.",
  },
  {
    id: "auto-renew",
    kind: "lease",
    severity: "medium",
    label: "Auto-renewal",
    pattern: /automatically renew/i,
    detail: "Lease rolls over unless you give notice far in advance. Set a reminder or negotiate it out.",
  },
  {
    id: "daily-late-fee",
    kind: "lease",
    severity: "medium",
    label: "Daily late fees",
    pattern: /per day|\/day/i,
    detail: "Uncapped daily late fees can snowball. Many states require late fees to be 'reasonable'.",
  },
  {
    id: "joint-several",
    kind: "lease",
    severity: "low",
    label: "Joint & several liability",
    pattern: /jointly and severally/i,
    detail: "You're on the hook for your roommates' rent if they don't pay. Common, but know what you're signing.",
  },
  {
    id: "early-termination",
    kind: "lease",
    severity: "medium",
    label: "Steep early-termination fee",
    pattern: /early termination fee[^.]*(2|3|two|three) months/i,
    detail: "Breaking the lease costs multiple months of rent. Ask for a sublet or lease-assignment option instead.",
  },
  {
    id: "no-sublet",
    kind: "lease",
    severity: "low",
    label: "No subletting",
    pattern: /no subletting/i,
    detail: "You can't sublet for summer or study abroad.",
  },
  {
    id: "wire-payment",
    kind: "scam",
    severity: "high",
    label: "Untraceable payment requested",
    pattern: /wire transfer|western union|gift card|zelle only|crypto/i,
    detail: "Legit landlords don't require wire, Zelle-only, crypto or gift-card deposits before a showing. Classic rental scam.",
  },
  {
    id: "cant-show",
    kind: "scam",
    severity: "high",
    label: "Landlord can't show the unit",
    pattern: /out of the country|cannot show|mail you the keys|keys will be mailed|ship keys/i,
    detail: "'I'm abroad, I'll mail the keys' is the most common rental scam script. Never pay without touring.",
  },
  {
    id: "pressure",
    kind: "listing",
    severity: "medium",
    label: "Pressure tactics",
    pattern: /sign same day|cash (only|preferred)/i,
    detail: "Same-day signing and cash-only requests limit your ability to review the lease or dispute charges.",
  },
];

export function detectFlags(listing: Listing, medianRentPerBed: number): Flag[] {
  const flags: Flag[] = [];
  const text = [listing.description, ...(listing.lease?.clauses ?? []), listing.lease?.lateFee ?? ""].join(" \n ");

  for (const rule of TEXT_RULES) {
    if (rule.pattern.test(text)) {
      flags.push({ id: rule.id, kind: rule.kind, severity: rule.severity, label: rule.label, detail: rule.detail });
    }
  }

  const perBed = listing.rent / Math.max(1, listing.beds);
  if (medianRentPerBed > 0 && perBed < medianRentPerBed * 0.6) {
    flags.push({
      id: "too-cheap",
      kind: "scam",
      severity: "high",
      label: "Price far below market",
      detail: `$${Math.round(perBed)}/bed is ${Math.round((1 - perBed / medianRentPerBed) * 100)}% under the area median ($${Math.round(medianRentPerBed)}/bed). Too good to be true usually is.`,
    });
  }

  const lease = listing.lease;
  if (lease) {
    if (lease.deposit > listing.rent * 2) {
      flags.push({
        id: "big-deposit",
        kind: "lease",
        severity: "medium",
        label: "Deposit over 2 months' rent",
        detail: `$${lease.deposit} deposit. Many states cap deposits at 1-2 months; check your local limit.`,
      });
    }
    if (lease.brokerFee > listing.rent) {
      flags.push({
        id: "broker-fee",
        kind: "lease",
        severity: "medium",
        label: "Broker fee over 1 month",
        detail: `$${lease.brokerFee} broker fee on top of rent and deposit.`,
      });
    }
    if (lease.applicationFee > 75) {
      flags.push({
        id: "app-fee",
        kind: "lease",
        severity: "low",
        label: "High application fee",
        detail: `$${lease.applicationFee} just to apply. Some states cap this at the actual cost of a background check.`,
      });
    }
  } else if (listing.demo || listing.landlord.kind === "unknown") {
    flags.push({
      id: "no-lease",
      kind: "listing",
      severity: "low",
      label: "No lease terms posted",
      detail: "Ask for a sample lease before paying anything. The agent will request one in its first message.",
    });
  }

  if (listing.landlord.kind === "unknown") {
    flags.push({
      id: "anonymous",
      kind: "scam",
      severity: "medium",
      label: "Anonymous poster",
      detail: "No property manager or full name attached. Verify ownership via county property records.",
    });
  }

  const negative = listing.reviews.filter((r) => r.tags.includes("pests"));
  if (negative.length) {
    flags.push({
      id: "pests",
      kind: "listing",
      severity: "medium",
      label: "Pest complaints in reviews",
      detail: `${negative.length} student review(s) mention pests.`,
    });
  }

  return flags;
}
