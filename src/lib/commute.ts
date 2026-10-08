import { haversineKm } from "./geo";
import { hashString } from "./rng";
import type { Commute, CommuteMode, LatLng } from "./types";

/** Street networks are never straight lines; this approximates door-to-door path length. */
const DETOUR = 1.3;

/**
 * Offline door-to-door estimate tuned for weekday rush hour. Transit includes
 * the walk to the stop, average wait, in-vehicle time, a transfer for longer
 * trips and the walk from the final stop.
 */
export function estimateCommute(from: LatLng, to: LatLng, mode: CommuteMode): Commute {
  const km = haversineKm(from, to) * DETOUR;
  const round = (n: number) => Math.max(1, Math.round(n));
  const walkMin = (km / 4.8) * 60;

  if (mode === "walk") {
    return { mode, minutes: round(walkMin), distanceKm: km, legs: [{ label: "Walk", minutes: round(walkMin) }], provider: "estimate" };
  }
  if (mode === "bike") {
    const ride = (km / 14) * 60;
    const legs = [
      { label: "Unlock & lock bike", minutes: 3 },
      { label: "Ride", minutes: round(ride) },
    ];
    return { mode, minutes: legs.reduce((s, l) => s + l.minutes, 0), distanceKm: km, legs, provider: "estimate" };
  }
  if (mode === "drive") {
    const legs = [
      { label: "Drive (rush hour)", minutes: round((km / 22) * 60) },
      { label: "Park & walk in", minutes: 7 },
    ];
    return { mode, minutes: legs.reduce((s, l) => s + l.minutes, 0), distanceKm: km, legs, provider: "estimate" };
  }

  const h = hashString(`${from.lat.toFixed(4)},${from.lng.toFixed(4)}`);
  const toStop = 3 + (h % 9);
  const wait = 4 + ((h >> 4) % 5);
  const ride = (km / 20) * 60;
  const transfer = km > 4 ? 7 : 0;
  const fromStop = 3 + ((h >> 8) % 5);
  const legs = [
    { label: "Walk to stop", minutes: toStop },
    { label: "Wait (peak headway)", minutes: wait },
    { label: "Ride", minutes: round(ride) },
    ...(transfer ? [{ label: "Transfer", minutes: transfer }] : []),
    { label: "Walk from stop", minutes: fromStop },
  ];
  const transitTotal = legs.reduce((s, l) => s + l.minutes, 0);
  if (walkMin <= transitTotal) {
    return { mode, minutes: round(walkMin), distanceKm: km, legs: [{ label: "Walk (faster than transit)", minutes: round(walkMin) }], provider: "estimate" };
  }
  return { mode, minutes: transitTotal, distanceKm: km, legs, provider: "estimate" };
}

/** Next weekday at the given HH:mm local to the server, as unix seconds. */
export function nextWeekdayArrival(hhmm: string, now = new Date()): number {
  const [hh, mm] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(hh, mm, 0, 0);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return Math.floor(d.getTime() / 1000);
}

const GOOGLE_MODE: Record<CommuteMode, string> = { transit: "transit", walk: "walking", bike: "bicycling", drive: "driving" };

type MatrixResponse = {
  status: string;
  rows: { elements: { status: string; duration?: { value: number }; duration_in_traffic?: { value: number }; distance?: { value: number } }[] }[];
};

/** Batch door-to-door times from Google's Distance Matrix, arriving at peak hour. */
export async function googleCommutes(
  origins: LatLng[],
  destination: LatLng,
  mode: CommuteMode,
  arriveBy: string,
  apiKey: string,
): Promise<(Commute | null)[]> {
  const out: (Commute | null)[] = [];
  const arrival = nextWeekdayArrival(arriveBy);
  for (let i = 0; i < origins.length; i += 25) {
    const batch = origins.slice(i, i + 25);
    const params = new URLSearchParams({
      origins: batch.map((o) => `${o.lat},${o.lng}`).join("|"),
      destinations: `${destination.lat},${destination.lng}`,
      mode: GOOGLE_MODE[mode],
      key: apiKey,
    });
    if (mode === "transit") params.set("arrival_time", String(arrival));
    if (mode === "drive") params.set("departure_time", String(arrival - 45 * 60));
    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`, { cache: "no-store" });
    const data = (await res.json()) as MatrixResponse;
    if (data.status !== "OK") throw new Error(`Distance Matrix ${data.status}`);
    for (const row of data.rows) {
      const el = row.elements[0];
      if (el.status !== "OK" || !el.duration) {
        out.push(null);
        continue;
      }
      const minutes = Math.round((el.duration_in_traffic ?? el.duration).value / 60);
      out.push({
        mode,
        minutes,
        distanceKm: (el.distance?.value ?? 0) / 1000,
        legs: [{ label: `Google Maps ${GOOGLE_MODE[mode]} (arrive ${arriveBy})`, minutes }],
        provider: "google",
      });
    }
  }
  return out;
}
