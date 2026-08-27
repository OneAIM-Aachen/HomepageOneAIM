// src/data/eventsData.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Veranstaltungs-Datenbank für AIM Educate (offene Events: Summits,
// Vortragsreihen, Expert Talks).
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  NEUES EVENT ERGÄNZEN – ein Eintrag im Array unten, Position egal.       ║
// ║  Ob es unter "Upcoming events" oder "Past events" erscheint, entscheidet ║
// ║  das Datum automatisch (Stichtag = Build-Datum, s. Hinweis unten).       ║
// ║                                                                          ║
// ║    • date (+ optional endDate) → Anzeige z. B. "21 to 24 Nov 2024"      ║
// ║    • dateLabel überschreibt die Anzeige, z. B. "Oct 2023 to Feb 2024"    ║
// ║    • city → Stadt-Chip; registerUrl → "Register"-Button (kommend);       ║
// ║      recapUrl → "Recap →"-Link (vergangen); image → Foto der Karte       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// HINWEIS: Die Seite ist statisch. Der Wechsel von "upcoming" zu "past"
// passiert beim nächsten Build/Deploy nach dem Event-Datum.
// ─────────────────────────────────────────────────────────────────────────────

import type { CitySlug } from "./cityData";

export interface EducateEvent {
  /** Eindeutiger Bezeichner (URL-sicher) */
  id: string;
  title: string;
  /** ISO YYYY-MM-DD – Beginn */
  date: string;
  /** ISO YYYY-MM-DD – Ende bei mehrtägigen Events */
  endDate?: string;
  /** Freie Datumsanzeige, z. B. "Oct 2023 to Feb 2024" (überschreibt date/endDate) */
  dateLabel?: string;
  city?: CitySlug;
  /** Ort, z. B. "LMU Klinikum, Großhadern" */
  location?: string;
  /** 1–2 Sätze: worum es geht, wer spricht */
  text?: string;
  image?: string;
  imageAlt?: string;
  registerUrl?: string;
  recapUrl?: string;
}

export const events: EducateEvent[] = [
  // ── Vergangene Events (von der alten Website übernommen) ──────────────
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
// Abgeleitetes
// ─────────────────────────────────────────────────────────────────────────────

function day(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime();
}

const dayMonthYear = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const dayOnly      = new Intl.DateTimeFormat("en-GB", { day: "2-digit" });

/** Anzeige des Datums: "28 Feb 2025", "21 to 24 Nov 2024" oder dateLabel. */
export function getEventDateLabel(e: EducateEvent): string {
  if (e.dateLabel) return e.dateLabel;
  if (!e.endDate) return dayMonthYear.format(new Date(e.date));
  const a = new Date(e.date), b = new Date(e.endDate);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  return sameMonth
    ? `${dayOnly.format(a)} to ${dayMonthYear.format(b)}`
    : `${dayMonthYear.format(a)} to ${dayMonthYear.format(b)}`;
}

/** Kommende Events (Ende ≥ heute), früheste zuerst. */
export function getUpcomingEvents(today: Date = new Date()): EducateEvent[] {
  const now = day(today.toISOString().slice(0, 10));
  return events
    .filter(e => day(e.endDate ?? e.date) >= now)
    .sort((a, b) => day(a.date) - day(b.date));
}

/** Vergangene Events, neueste zuerst. */
export function getPastEvents(today: Date = new Date()): EducateEvent[] {
  const now = day(today.toISOString().slice(0, 10));
  return events
    .filter(e => day(e.endDate ?? e.date) < now)
    .sort((a, b) => day(b.date) - day(a.date));
}
