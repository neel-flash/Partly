import type { Tour } from "./types";

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function toursToIcs(tours: (Tour & { id: string; title: string; notes?: string })[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Partly//Apartment Tours//EN", "CALSCALE:GREGORIAN"];
  for (const t of tours) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${t.id}@partly.app`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(t.start)}`,
      `DTEND:${stamp(t.end)}`,
      `SUMMARY:${escape(`Apartment tour: ${t.title}`)}`,
      `LOCATION:${escape(t.address)}`,
      `DESCRIPTION:${escape([`Contact: ${t.contact}`, t.notes ?? ""].filter(Boolean).join("\n"))}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      "DESCRIPTION:Apartment tour in 1 hour",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function googleCalendarUrl(t: Tour, title: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Apartment tour: ${title}`,
    dates: `${stamp(t.start)}/${stamp(t.end)}`,
    location: t.address,
    details: `Contact: ${t.contact}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
