import { connection } from "next/server";

export async function GET() {
  await connection();
  return Response.json({
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    maps: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    rentcast: Boolean(process.env.RENTCAST_API_KEY),
    demoListings: process.env.PARTLY_DEMO_LISTINGS !== "off",
  });
}
