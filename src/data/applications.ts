// src/data/applications.ts
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  NEUE BEWERBUNGSRUNDE ERGÄNZEN – ein Schritt:                            ║
// ║  Einen Eintrag in das Array unten schreiben. Position egal.              ║
// ║                                                                          ║
// ║  Der Status (upcoming / open / closed) wird NICHT gepflegt, sondern aus   ║
// ║  den Datumsfeldern berechnet:                                            ║
// ║      heute <  opensAt   → "upcoming"                                     ║
// ║      heute <= deadline  → "open"                                         ║
// ║      sonst              → "closed"                                       ║
// ║  Es gibt also kein Flag, das man vergessen kann umzustellen.             ║
// ║                                                                          ║
// ║  WICHTIG: Die Seite wird statisch gebaut. "Heute" ist der Zeitpunkt des   ║
// ║  Builds – ein Ablauf wird also erst mit dem nächsten Deploy sichtbar.     ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// EIN EINTRAG = EINE RUNDE, nicht ein Programm. Sommer- und Wintersemester
// stehen damit nebeneinander, und abgelaufene Runden bleiben als Historie
// liegen – sie werden von den Hilfsfunktionen einfach herausgefiltert und
// dienen als Vorlage für die nächste Runde.
//
// SLUGS: `city` nutzt dieselben Slugs wie Navigation und News,
// `program` dieselben wie src/data/programs.ts. Anzeigenamen kommen von dort,
// stehen hier also bewusst nicht noch einmal.

import type { CitySlug } from "./cityData";
import { getProgram } from "./programs";
import { locationItems } from "../components/navigation/navData";

export type ApplicationStatus = "upcoming" | "open" | "closed";

/** WS = Wintersemester, SS = Sommersemester. */
export type Semester = "WS" | "SS";

export interface Application {
  /** Stabiler Schlüssel, eine Runde: "munich-aim-connect-ws26" */
  id: string;
  /** "munich" | "aachen" | "frankfurt" */
  city: CitySlug;
  /** Slug aus programs.ts, z. B. "aim-connect" */
  program: string;
  /** Semester der Runde */
  semester: Semester;
  /**
   * Startjahr des Semesters, vierstellig.
   * WS 2026 → "WS 26/27", SS 2026 → "SS 26".
   * Die Beschriftung entsteht daraus – sie wird nicht gepflegt.
   */
  year: number;

  /** ISO YYYY-MM-DD – ab wann bewerbbar */
  opensAt: string;
  /** ISO YYYY-MM-DD – letzter Tag */
  /**
   * ISO YYYY-MM-DD – Bewerbungsschluss. Darf fehlen, solange er noch nicht
   * feststeht: die Runde gilt dann ab opensAt als offen, die Seiten zeigen
   * "to be announced". Sobald das Datum steht, hier eintragen.
   */
  deadline?: string;
  /** ISO YYYY-MM-DD – Interviews von/bis */
  interviewsFrom?: string;
  interviewsTo?: string;
  /** Freie Anzeige statt von/bis, z. B. "Oct", solange nur der Monat feststeht */
  interviewsLabel?: string;
  /** ISO YYYY-MM-DD – Zusagen spätestens am */
  decisionBy?: string;
  /** ISO YYYY-MM-DD – Programmstart */
  startsAt?: string;
  /** Anzahl Plätze */
  spots?: number;

  /** Bewerbungslink – spätestens nötig, sobald die Runde offen ist */
  applyUrl?: string;
  /** Optionale Zusatzzeile für die Karte */
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bewerbungsrunden
// ─────────────────────────────────────────────────────────────────────────────

// Aktuell leer – die Demo-Runden sind entfernt. Neue Runde nach diesem
// Muster ergänzen, alles Weitere (Karten, Status, Fristen) passiert von
// selbst auf Standort- und Programmseiten:
//
//   {
//     id:       "munich-aim-connect-ws26",   // "<stadt>-<programm>-<semester><jahr>"
//     city:     "munich",                    // "munich" | "aachen" | "frankfurt"
//     program:  "aim-connect",               // Slug aus programs.ts
//     semester: "WS",                        // "WS" | "SS"
//     year:     2026,
//     opensAt:  "2026-08-01",                // Bewerbung öffnet
//     deadline: "2026-09-15",                // Bewerbungsschluss
//     startsAt: "2026-10-15",                // optional: Programmstart
//     spots:    20,                          // optional
//     applyUrl: "https://…",                 // Bewerbungsformular
//   },
export const applications: Application[] = [
  {
    id:       "munich-aim-connect-ws26",
    city:     "munich",
    program:  "aim-connect",
    semester: "WS",
    year:     2026,
    opensAt:  "2026-09-01",
    deadline: "2026-09-13",
    interviewsFrom: "2026-09-18",
    interviewsTo:   "2026-09-22",
    decisionBy:     "2026-09-27",
    startsAt: "2026-10-16",
    // applyUrl: Bewerbungslink ergänzen
  },
  {
    id:       "frankfurt-aim-connect-ws26",
    city:     "frankfurt",
    program:  "aim-connect",
    semester: "WS",
    year:     2026,
    opensAt:  "2026-09-01",
    deadline: "2026-09-25",
    interviewsLabel: "Oct",
    decisionBy: "2026-10-11",
    startsAt: "2026-10-24",
    applyUrl: "https://tally.so/r/WOVevk",
  },
  {
    id:       "aachen-aim-connect-ws26",
    city:     "aachen",
    program:  "aim-connect",
    semester: "WS",
    year:     2026,
    opensAt:  "2026-08-29",
    deadline: "2026-09-21",
    interviewsFrom: "2026-09-25",
    interviewsTo:   "2026-09-27",
    decisionBy:     "2026-09-27",
    startsAt: "2026-10-23",
    applyUrl: "https://tally.so/r/7RgbEL",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Abgeleitetes
// ─────────────────────────────────────────────────────────────────────────────

/** Tagesgenauer Vergleich – Uhrzeiten spielen hier keine Rolle. */
function day(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime();
}

export function getStatus(app: Application, today: Date = new Date()): ApplicationStatus {
  const now = day(today.toISOString().slice(0, 10));
  if (now < day(app.opensAt))  return "upcoming";
  if (!app.deadline || now <= day(app.deadline)) return "open";
  return "closed";
}

/** Zweistelliges Jahr, z. B. 2026 → "26". */
function yy(year: number): string {
  return String(year % 100).padStart(2, "0");
}

/**
 * Semesterkürzel in fester Schreibweise:
 *   WS 2026 → "WS 26/27"   (läuft über den Jahreswechsel)
 *   SS 2026 → "SS 26"
 */
export function getTermLabel(app: Application): string {
  return app.semester === "WS"
    ? `WS ${yy(app.year)}/${yy(app.year + 1)}`
    : `SS ${yy(app.year)}`;
}

/** Anzeigename des Standorts – aus navData, damit er nur dort steht. */
export function getCityName(city: CitySlug): string {
  return locationItems.find(l => l.href === `/${city}`)?.label ?? city;
}

/** Anzeigename des Programms – aus programs.ts, damit er nur dort steht. */
export function getProgramName(app: Application): string {
  return getProgram(app.program)?.name ?? app.program;
}

/**
 * Vollständiger Titel einer Runde, überall gleich aufgebaut:
 *   "<Programm> <Stadt> – <Semester>"
 *   z. B. "AIM Connect Aachen – WS 26/27" oder "AIM Code Munich – SS 26"
 * Programmname, Stadtname und Semester kommen jeweils aus ihrer eigenen
 * Quelle – hier wird nur zusammengesetzt.
 */
export function getApplicationTitle(app: Application): string {
  return `${getProgramName(app)} ${getCityName(app.city)} – ${getTermLabel(app)}`;
}

/** Verbleibende Tage bis zur Frist (negativ, wenn vorbei). */
export function getDaysLeft(app: Application, today: Date = new Date()): number {
  if (!app.deadline) return Number.POSITIVE_INFINITY;
  const ms = day(app.deadline) - day(today.toISOString().slice(0, 10));
  return Math.round(ms / 86_400_000);
}

function matches(city?: CitySlug, program?: string) {
  return (a: Application) =>
    (city ? a.city === city : true) && (program ? a.program === program : true);
}

/** Offene Runden, nächste Frist zuerst. Ohne Argumente: alle Standorte. */
export function getOpenApplications(
  city?: CitySlug, program?: string, today?: Date,
): Application[] {
  return applications
    .filter(matches(city, program))
    .filter(a => getStatus(a, today) === "open")
    .sort((a, b) => (a.deadline ? day(a.deadline) : Infinity) - (b.deadline ? day(b.deadline) : Infinity));
}

/** Kommende Runden, früheste Öffnung zuerst. */
export function getUpcomingApplications(
  city?: CitySlug, program?: string, today?: Date,
): Application[] {
  return applications
    .filter(matches(city, program))
    .filter(a => getStatus(a, today) === "upcoming")
    .sort((a, b) => day(a.opensAt) - day(b.opensAt));
}

/**
 * Die relevante Runde für Stadt + Programm – erst die offene mit der
 * nächsten Frist, sonst die nächste kommende. Speist die Programmseiten
 * je Standort (/munich/aim-connect …).
 */
export function getApplicationFor(
  city: CitySlug, program: string, today?: Date,
): Application | undefined {
  return getOpenApplications(city, program, today)[0]
      ?? getUpcomingApplications(city, program, today)[0];
}

/**
 * Die Runde, die im Hero einer Standortseite hervorgehoben wird:
 * die offene mit der nächsten Frist – gibt es keine, die nächste kommende.
 */
export function getFeaturedApplication(city: CitySlug, today?: Date): Application | undefined {
  return getOpenApplications(city, undefined, today)[0]
      ?? getUpcomingApplications(city, undefined, today)[0];
}

/** Die Runde für die "Coming up"-Zeile – die nächste, die noch nicht läuft. */
export function getNextUpcoming(city: CitySlug, today?: Date): Application | undefined {
  return getUpcomingApplications(city, undefined, today)[0];
}
