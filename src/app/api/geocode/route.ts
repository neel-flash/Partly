import { CAMPUSES } from "@/lib/geo";

type Hit = { label: string; lat: number; lng: number };

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ results: [] });

  const lower = q.toLowerCase();
  const presets: Hit[] = CAMPUSES.filter((c) => `${c.label} ${c.city}`.toLowerCase().includes(lower)).map((c) => ({
    label: `${c.label}, ${c.city}`,
    lat: c.lat,
    lng: c.lng,
  }));

  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    let results: Hit[];
    if (key) {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`);
      const data = (await res.json()) as { results: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[] };
      results = data.results.slice(0, 5).map((r) => ({ label: r.formatted_address, ...r.geometry.location }));
    } else {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&q=${encodeURIComponent(q)}`,
        { headers: { "User-Agent": "Partly/0.1 (apartment search demo)" } },
      );
      const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
      results = data.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
    }
    return Response.json({ results: [...presets, ...results].slice(0, 6) });
  } catch (err) {
    console.error("[geocode] lookup failed:", err);
    return Response.json({ results: presets });
  }
}
