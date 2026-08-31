// src/data/applications.ts
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ADDING A NEW APPLICATION ROUND – one step:                              ║
// ║  Write an entry into the array below. Position does not matter.          ║
// ║                                                                          ║
// ║  The status (upcoming / open / closed) is NOT maintained by hand, it is  ║
// ║  computed from the date fields:                                          ║
// ║      today <  opensAt   → "upcoming"                                     ║
// ║      today <= deadline  → "open"                                         ║
// ║      otherwise          → "closed"                                       ║
// ║  So there is no flag anyone could forget to flip.                        ║
// ║                                                                          ║
// ║  IMPORTANT: The site is built statically. "Today" is the time of the     ║
// ║  build – an expiry only becomes visible with the next deploy.            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// ONE ENTRY = ONE ROUND, not one program. Summer and winter semester can
// therefore sit side by side, and expired rounds simply remain as history –
// the helper functions filter them out, and they serve as a template for
// the next round.
//
// SLUGS: `city` uses the same slugs as navigation and news,
// `program` the same as src/data/programs.ts. Display names come from there,
// so they are deliberately not repeated here.

import type { CitySlug } from "./cityData";
import { getProgram } from "./programs";
import { locationItems } from "../components/navigation/navData";

export type ApplicationStatus = "upcoming" | "open" | "closed";

/** WS = winter semester, SS = summer semester. */
export type Semester = "WS" | "SS";

export interface Application {
  /** Stable key, one round: "munich-aim-connect-ws26" */
  id: string;
  /** "munich" | "aachen" | "frankfurt" */
  city: CitySlug;
  /** Slug from programs.ts, e.g. "aim-connect" */
  program: string;
  /** Semester of the round */
  semester: Semester;
  /**
   * Starting year of the semester, four digits.
   * WS 2026 → "WS 26/27", SS 2026 → "SS 26".
   * The label is derived from this – it is not maintained by hand.
   */
  year: number;

  /** ISO YYYY-MM-DD – applications open from this date */
  opensAt: string;
  /** ISO YYYY-MM-DD – last day */
  /**
   * ISO YYYY-MM-DD – application deadline. May be missing as long as it is
   * not fixed yet: the round then counts as open from opensAt, the pages show
   * "to be announced". Once the date is fixed, enter it here.
   */
  deadline?: string;
  /** ISO YYYY-MM-DD – interviews from/to */
  interviewsFrom?: string;
  interviewsTo?: string;
  /** Free-form display instead of from/to, e.g. "Oct", while only the month is fixed */
  interviewsLabel?: string;
  /** ISO YYYY-MM-DD – offers sent by this date at the latest */
  decisionBy?: string;
  /** ISO YYYY-MM-DD – program start */
  startsAt?: string;
  /** Number of spots */
  spots?: number;

  /** Application link – required at the latest once the round is open */
  applyUrl?: string;
  /** Optional extra line for the card */
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Application rounds
// ─────────────────────────────────────────────────────────────────────────────

// Currently empty – the demo rounds are removed. Add a new round following
// this pattern; everything else (cards, status, deadlines) happens
// automatically on the location and program pages:
//
//   {
//     id:       "munich-aim-connect-ws26",   // "<city>-<program>-<semester><year>"
//     city:     "munich",                    // "munich" | "aachen" | "frankfurt"
//     program:  "aim-connect",               // slug from programs.ts
//     semester: "WS",                        // "WS" | "SS"
//     year:     2026,
//     opensAt:  "2026-08-01",                // applications open
//     deadline: "2026-09-15",                // application deadline
//     startsAt: "2026-10-15",                // optional: program start
//     spots:    20,                          // optional
//     applyUrl: "https://…",                 // application form
//   },
export const applications: Application[] = [
  {
    id:       "munich-aim-connect-ws26",
    city:     "munich",
    program:  "aim-connect",
    semester: "WS",
    year:     2026,
    opensAt:  "2026-09-04",
    deadline: "2026-09-13",
    interviewsFrom: "2026-09-18",
    interviewsTo:   "2026-09-22",
    decisionBy:     "2026-09-27",
    startsAt: "2026-10-16",
    // applyUrl: add application link
  },
  {
    id:       "frankfurt-aim-connect-ws26",
    city:     "frankfurt",
    program:  "aim-connect",
    semester: "WS",
    year:     2026,
    opensAt:  "2026-08-30",
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
    opensAt:  "2026-08-30",
    deadline: "2026-09-21",
    interviewsFrom: "2026-09-25",
    interviewsTo:   "2026-09-27",
    decisionBy:     "2026-09-27",
    startsAt: "2026-10-23",
    applyUrl: "https://tally.so/r/7RgbEL",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Day-precise comparison – times of day do not matter here. */
function day(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime();
}

export function getStatus(app: Application, today: Date = new Date()): ApplicationStatus {
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (now < day(app.opensAt))  return "upcoming";
  if (!app.deadline || now <= day(app.deadline)) return "open";
  return "closed";
}

/** Two-digit year, e.g. 2026 → "26". */
function yy(year: number): string {
  return String(year % 100).padStart(2, "0");
}

/**
 * Semester label in a fixed notation:
 *   WS 2026 → "WS 26/27"   (spans the turn of the year)
 *   SS 2026 → "SS 26"
 */
export function getTermLabel(app: Application): string {
  return app.semester === "WS"
    ? `WS ${yy(app.year)}/${yy(app.year + 1)}`
    : `SS ${yy(app.year)}`;
}

/** Display name of the location – from navData, so it lives only there. */
export function getCityName(city: CitySlug): string {
  return locationItems.find(l => l.href === `/${city}`)?.label ?? city;
}

/** Display name of the program – from programs.ts, so it lives only there. */
export function getProgramName(app: Application): string {
  return getProgram(app.program)?.name ?? app.program;
}

/**
 * Full title of a round, built the same way everywhere:
 *   "<Program> <City> – <Semester>"
 *   e.g. "AIM Connect Aachen – WS 26/27" or "AIM Code Munich – SS 26"
 * Program name, city name and semester each come from their own
 * source – this only assembles them.
 */
export function getApplicationTitle(app: Application): string {
  return `${getProgramName(app)} ${getCityName(app.city)} – ${getTermLabel(app)}`;
}

/** Days left until the deadline (negative once it has passed). */
export function getDaysLeft(app: Application, today: Date = new Date()): number {
  if (!app.deadline) return Number.POSITIVE_INFINITY;
  const ms = day(app.deadline) - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round(ms / 86_400_000);
}

function matches(city?: CitySlug, program?: string) {
  return (a: Application) =>
    (city ? a.city === city : true) && (program ? a.program === program : true);
}

/** Open rounds, nearest deadline first. Without arguments: all locations. */
export function getOpenApplications(
  city?: CitySlug, program?: string, today?: Date,
): Application[] {
  return applications
    .filter(matches(city, program))
    .filter(a => getStatus(a, today) === "open")
    .sort((a, b) => (a.deadline ? day(a.deadline) : Infinity) - (b.deadline ? day(b.deadline) : Infinity));
}

/** Upcoming rounds, earliest opening first. */
export function getUpcomingApplications(
  city?: CitySlug, program?: string, today?: Date,
): Application[] {
  return applications
    .filter(matches(city, program))
    .filter(a => getStatus(a, today) === "upcoming")
    .sort((a, b) => day(a.opensAt) - day(b.opensAt));
}

/**
 * The relevant round for city + program – first the open one with the
 * nearest deadline, otherwise the next upcoming one. Feeds the program
 * pages per location (/munich/aim-connect …).
 */
export function getApplicationFor(
  city: CitySlug, program: string, today?: Date,
): Application | undefined {
  return getOpenApplications(city, program, today)[0]
      ?? getUpcomingApplications(city, program, today)[0];
}

/**
 * The round highlighted in the hero of a location page:
 * the open one with the nearest deadline – if there is none, the next upcoming one.
 */
export function getFeaturedApplication(city: CitySlug, today?: Date): Application | undefined {
  return getOpenApplications(city, undefined, today)[0]
      ?? getUpcomingApplications(city, undefined, today)[0];
}

/** The round for the "Coming up" line – the next one that is not yet running. */
export function getNextUpcoming(city: CitySlug, today?: Date): Application | undefined {
  return getUpcomingApplications(city, undefined, today)[0];
}
