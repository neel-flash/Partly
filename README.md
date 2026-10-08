# Partly
An AI-driven real estate agent that automates the apartment hunt for students and graduates by transforming hours of cross-platform searching, transit mapping, and landlord outreach into a simple two-minute intake and an organized calendar of viewings.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and either fill in the intake or click **Try the Boston demo**.

## What it does

| Pain point | What Partly does |
| --- | --- |
| 10+ tabs across Zillow, Apartments.com, Craigslist, Marketplace | Pulls every source in parallel and merges cross-posts into one unit (normalises `St`/`Street`, `Apt 3B`/`#3B`, ~100m proximity), keeping the lowest price. |
| Manually checking Google Maps | Door-to-door commute for every listing, routed for your actual arrival time on the next weekday. |
| Predatory leases & scams | Flags non-refundable deposits, entry without notice, auto-renewal, daily late fees, oversized deposits/broker fees, "I'm abroad, I'll mail the keys" scripts, wire/Zelle/gift-card payment requests, and prices far below the area median. Likely scams are filtered out. |
| Ghosting landlords | The agent sends the first message (after you approve it), answers screening questions from your profile, follows up by text and then voicemail, marks the lead ghosted after two follow-ups and swaps in the next-best match. |
| Spreadsheets & Apple Notes | Kanban lead tracker with notes, plus CSV export. |
| Knocking on doors for waitlists | Full buildings get a waitlist request on day one. When a unit opens, the agent books the tour. |
| Scheduling | Picks offered slots that fit your tour availability and don't overlap other tours (45 min travel buffer). Export to `.ics` or Google Calendar. |

Grading is a weighted score (price, commute, student reviews, lease fairness, amenities) that you can retune live from the Matches page. Reviews use a Bayesian average so one 5-star review doesn't beat twenty 4.5s.

## Live data vs. demo

Copy `.env.example` to `.env.local`. Each key switches on one integration independently:

- `ANTHROPIC_API_KEY`: Claude writes each landlord inquiry. Without it, a template is used.
- `GOOGLE_MAPS_API_KEY`: Distance Matrix commutes and Google geocoding. Without it, commutes are estimated from a rush-hour model and geocoding uses OpenStreetMap.
- `RENTCAST_API_KEY`: real MLS rental listings near your anchor.

Zillow, Facebook Marketplace and Craigslist have no public listings API, and scraping them violates their terms. The demo providers in `src/lib/providers/mock.ts` produce realistic, deterministic cross-posted data so the de-duplication, scoring and agent flows can be exercised end to end. Licensed feeds can be added as another provider that returns `RawListing[]` (see `rentcast.ts`).

Landlord replies are simulated (`planFor` in `src/lib/agent.ts`) and the agent clock runs fast. To go live, send messages through an email/SMS provider and set `pendingReplyAt` from inbound webhooks. The rest of the state machine stays the same.

## Layout

```
src/lib/providers/   listing sources (demo + RentCast)
src/lib/aggregate.ts cross-platform de-duplication
src/lib/commute.ts   door-to-door commute (Google or estimate)
src/lib/lease.ts     lease red flags & scam detection
src/lib/scoring.ts   weighted grading & hard filters
src/lib/agent.ts     outreach state machine
src/lib/templates.ts message templates
src/app/api/         search, geocode, draft, status
src/app/             intake, matches, agent, tracker, tours pages
```

State is kept in `localStorage`; nothing leaves the browser except search and draft requests to the app's own API routes.
