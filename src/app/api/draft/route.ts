import { scoreListings } from "@/lib/scoring";
import { inquiryTemplate, waitlistTemplate } from "@/lib/templates";
import type { Intake, ListingWithCommute } from "@/lib/types";

type DraftRequest = { intake: Intake; listing: ListingWithCommute; medianRentPerBed: number };

/** Writes a personalised first message. Uses Claude when ANTHROPIC_API_KEY is set, otherwise a template. */
export async function POST(request: Request) {
  const { intake, listing, medianRentPerBed } = (await request.json()) as DraftRequest;
  const fallback = listing.waitlistOnly ? waitlistTemplate(listing, intake) : inquiryTemplate(listing, intake);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ body: fallback, source: "template" });

  const [scored] = scoreListings([listing], intake, medianRentPerBed);
  const prompt = `You are an apartment-hunting assistant writing on behalf of a renter. Write a short, warm, specific first message to a landlord. Plain text only, no subject line, under 170 words.

Renter: ${intake.name || "the renter"}, ${intake.isStudent ? "student" : "recent grad"}, ${intake.people} occupant(s), move-in ${intake.moveIn}, ${intake.leaseMonths}-month lease, ${intake.hasGuarantor ? "has a guarantor" : "no guarantor, can show income"}. About: ${intake.aboutMe || "n/a"}.
Contact: ${[intake.email, intake.phone].filter(Boolean).join(", ")}.
Tour availability: days ${intake.availability.days.join(",")} (0=Sun), ${intake.availability.startHour}:00-${intake.availability.endHour}:00.

Listing: ${listing.title} at ${listing.address} ${listing.unit ?? ""}, $${listing.rent}/mo, ${listing.beds} bed, landlord ${listing.landlord.name}. ${listing.waitlistOnly ? "Building is full: ask to join the waitlist." : ""}
Description: ${listing.description}
Concerns to politely ask about (don't accuse): ${scored.flags.map((f) => f.label).join("; ") || "none"}.

Ask: availability for the move-in date, total monthly cost incl. utilities, a copy of the lease, and propose viewing times. Sign with the renter's name and contact.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    const text = data.content.find((c) => c.type === "text")?.text?.trim();
    return Response.json(text ? { body: text, source: "ai" } : { body: fallback, source: "template" });
  } catch (err) {
    console.error("[draft] AI draft failed, using template:", err);
    return Response.json({ body: fallback, source: "template" });
  }
}
