import type { LatLng } from "./types";

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function offsetLatLng(origin: LatLng, km: number, bearingRad: number): LatLng {
  const dLat = (km * Math.cos(bearingRad)) / 111.32;
  const dLng = (km * Math.sin(bearingRad)) / (111.32 * Math.cos((origin.lat * Math.PI) / 180));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

export type Campus = { label: string; city: string; lat: number; lng: number; rentPerBed: number };

/** rentPerBed is a rough market rate used only to price demo listings. */
export const CAMPUSES: Campus[] = [
  { label: "New York University", city: "New York, NY", lat: 40.7295, lng: -73.9965, rentPerBed: 2000 },
  { label: "Boston University", city: "Boston, MA", lat: 42.3505, lng: -71.1054, rentPerBed: 1450 },
  { label: "Northeastern University", city: "Boston, MA", lat: 42.3398, lng: -71.0892, rentPerBed: 1450 },
  { label: "UC Berkeley", city: "Berkeley, CA", lat: 37.8719, lng: -122.2585, rentPerBed: 1600 },
  { label: "UCLA", city: "Los Angeles, CA", lat: 34.0689, lng: -118.4452, rentPerBed: 1600 },
  { label: "UT Austin", city: "Austin, TX", lat: 30.2849, lng: -97.7341, rentPerBed: 1000 },
  { label: "University of Washington", city: "Seattle, WA", lat: 47.6553, lng: -122.3035, rentPerBed: 1300 },
  { label: "Georgia Tech", city: "Atlanta, GA", lat: 33.7756, lng: -84.3963, rentPerBed: 1100 },
  { label: "University of Michigan", city: "Ann Arbor, MI", lat: 42.278, lng: -83.7382, rentPerBed: 1050 },
  { label: "UIUC", city: "Champaign, IL", lat: 40.102, lng: -88.2272, rentPerBed: 700 },
];

export function marketRentPerBed(point: LatLng): number {
  const near = CAMPUSES.map((c) => ({ c, d: haversineKm(point, c) })).sort((a, b) => a.d - b.d)[0];
  return near && near.d < 40 ? near.c.rentPerBed : 1200;
}
