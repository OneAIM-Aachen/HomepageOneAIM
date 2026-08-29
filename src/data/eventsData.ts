// src/data/eventsData.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Event database for AIM Educate (open events: summits,
// lecture series, expert talks).
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ADDING A NEW EVENT – one entry in the array below, position irrelevant. ║
// ║  Whether it appears under "Upcoming events" or "Past events" is decided  ║
// ║  by the date automatically (cutoff = build date, see note below).        ║
// ║                                                                          ║
// ║    • date (+ optional endDate) → display e.g. "21 to 24 Nov 2024"        ║
// ║    • dateLabel overrides the display, e.g. "Oct 2023 to Feb 2024"        ║
// ║    • city → city chip; registerUrl → "Register" button (upcoming);       ║
// ║      recapUrl → "Recap →" link (past); image → photo on the card         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// NOTE: The site is static. The switch from "upcoming" to "past"
// happens with the next build/deploy after the event date.
// ─────────────────────────────────────────────────────────────────────────────

import type { CitySlug } from "./cityData";

export interface EducateEvent {
  /** Unique identifier (URL-safe) */
  id: string;
  title: string;
  /** ISO YYYY-MM-DD – start */
  date: string;
  /** ISO YYYY-MM-DD – end for multi-day events */
  endDate?: string;
  /** Free-form date display, e.g. "Oct 2023 to Feb 2024" (overrides date/endDate) */
  dateLabel?: string;
  city?: CitySlug;
  /** Venue, e.g. "LMU Klinikum, Großhadern" */
  location?: string;
  /** 1–2 sentences: what it is about, who speaks */
  text?: string;
  image?: string;
  imageAlt?: string;
  registerUrl?: string;
  recapUrl?: string;
}

export const events: EducateEvent[] = [
  // ── Past events (carried over from the old website) ───────────────────
  { id: "winter-summit-2025", title: "OneAIM Winter Summit 2025",
    date: "2025-02-28", city: "munich" ,
    image: "/images/events/winter-summit-2025.jpg" },
  { id: "ai-for-health-conference-2024", title: "AI for Health Conference",
    date: "2024-11-21", endDate: "2024-11-24", city: "munich" ,
    image: "/images/events/ai-for-health-conference-2024.jpg" },
  { id: "game-tli-summit-2024", title: "GAME Translational Learning Initiative Summit",
    date: "2024-11-11", endDate: "2024-11-13", city: "munich" ,
    image: "/images/events/game-tli-summit-2024.jpg" },
  { id: "summer-summit-2024", title: "OneAIM Summer Summit 2024",
    date: "2024-06-02", city: "munich" ,
    image: "/images/events/summer-summit-2024.jpg" },
  { id: "ai-data-science-medical-faculty-2024", title: "AI and Data Science at the Medical Faculty",
    date: "2024-01-20", city: "munich" ,
    image: "/images/events/ai-data-science-medical-faculty-2024.jpg" },
  { id: "lecture-series-ki-in-der-medizin-2023", title: "Lecture series \"KI in der Medizin\"",
    date: "2023-10-01", endDate: "2024-02-28", dateLabel: "Oct 2023 to Feb 2024", city: "munich" ,
    image: "/images/events/lecture-series-ki-in-der-medizin-2023.jpg" },
  { id: "data-analytics-healthcare-bcg-2023", title: "Data & Analytics in Healthcare, OneAIM x BCG",
    date: "2023-06-02", city: "munich" ,
    image: "/images/events/data-analytics-healthcare-bcg-2023.jpg" },
  { id: "insaight-entrepreneurial-minds-2022", title: "InsAIght Entrepreneurial Minds",
    date: "2022-10-01", endDate: "2023-02-28", dateLabel: "Oct 2022 to Feb 2023", city: "munich" ,
    image: "/images/events/insaight-entrepreneurial-minds-2022.jpg" },
  { id: "symposium-ai-in-healthcare-2021", title: "Symposium on AI in Healthcare",
    date: "2021-11-12", endDate: "2021-11-13", dateLabel: "12 & 13 Nov 2021", city: "munich" ,
    image: "/images/events/symposium-ai-in-healthcare-2021.jpg" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers
// ─────────────────────────────────────────────────────────────────────────────

function day(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime();
}

const dayMonthYear = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const dayOnly      = new Intl.DateTimeFormat("en-GB", { day: "2-digit" });

/** Date display: "28 Feb 2025", "21 to 24 Nov 2024" or dateLabel. */
export function getEventDateLabel(e: EducateEvent): string {
  if (e.dateLabel) return e.dateLabel;
  if (!e.endDate) return dayMonthYear.format(new Date(e.date));
  const a = new Date(e.date), b = new Date(e.endDate);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return sameMonth
    ? `${dayOnly.format(a)} to ${dayMonthYear.format(b)}`
    : `${dayMonthYear.format(a)} to ${dayMonthYear.format(b)}`;
}

/** Upcoming events (end ≥ today), earliest first. */
export function getUpcomingEvents(today: Date = new Date()): EducateEvent[] {
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return events
    .filter(e => day(e.endDate ?? e.date) >= now)
    .sort((a, b) => day(a.date) - day(b.date));
}

/** Past events, most recent first. */
export function getPastEvents(today: Date = new Date()): EducateEvent[] {
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return events
    .filter(e => day(e.endDate ?? e.date) < now)
    .sort((a, b) => day(b.date) - day(a.date));
}
