import type { Intake, RawListing } from "../types";

type RentcastContact = { name?: string; phone?: string; email?: string };
type RentcastListing = {
  id: string;
  formattedAddress?: string;
  addressLine1?: string;
  addressLine2?: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  price?: number;
  listedDate?: string;
  daysOnMarket?: number;
  propertyType?: string;
  listingAgent?: RentcastContact;
  listingOffice?: RentcastContact;
};

/** Live MLS-backed rental listings. Enabled when RENTCAST_API_KEY is set. */
export async function fetchRentcast(intake: Intake, apiKey: string): Promise<RawListing[]> {
  const params = new URLSearchParams({
    latitude: String(intake.anchor.lat),
    longitude: String(intake.anchor.lng),
    radius: "5",
    status: "Active",
    limit: "100",
  });
  const res = await fetch(`https://api.rentcast.io/v1/listings/rental/long-term?${params}`, {
    headers: { "X-Api-Key": apiKey, accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`RentCast ${res.status}`);
  const rows = (await res.json()) as RentcastListing[];

  return rows
    .filter((r) => r.latitude && r.longitude && r.price && r.addressLine1)
    .map((r) => {
      const contact = r.listingAgent ?? r.listingOffice ?? {};
      return {
        source: "rentcast",
        externalId: r.id,
        url: `https://www.google.com/search?q=${encodeURIComponent(r.formattedAddress ?? r.addressLine1 ?? "")}`,
        title: `${r.bedrooms ? `${r.bedrooms} Bed` : "Studio"} ${r.propertyType ?? "rental"}`,
        address: r.addressLine1!,
        unit: r.addressLine2,
        lat: r.latitude!,
        lng: r.longitude!,
        rent: r.price!,
        beds: r.bedrooms ?? 0,
        baths: r.bathrooms ?? 1,
        sqft: r.squareFootage,
        availableFrom: intake.moveIn,
        postedDaysAgo: r.daysOnMarket ?? 0,
        amenities: [],
        description: `${r.propertyType ?? "Rental"} listed ${r.listedDate?.slice(0, 10) ?? "recently"}.`,
        landlord: {
          name: contact.name ?? "Listing agent",
          kind: r.listingAgent ? "property manager" : "unknown",
          email: contact.email,
          phone: contact.phone,
          responseRate: 0.7,
          avgResponseHours: 12,
        },
        reviews: [],
        waitlistOnly: false,
        demo: false,
      } satisfies RawListing;
    });
}
