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
  /**
   * Optional time of day of the deadline, "HH:MM" (German time), e.g. "12:00".
   * If set, the cards show the deadline written out with the time
   * ("6 November 12:00") instead of the short form ("6 Nov").
   * Note: the round still counts as open for the whole deadline day –
   * the static site only switches at the next nightly build.
   */
  deadlineTime?: string;
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
    opensAt:  "2026-09-01",
    deadline: "2026-09-13",
    interviewsFrom: "2026-09-18",
    interviewsTo:   "2026-09-22",
    decisionBy:     "2026-09-27",
    startsAt: "2026-10-16",
    applyUrl: "https://tally.so/r/5BAxZM",
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
    deadline: "2026-09-22",
    interviewsFrom: "2026-09-25",
    interviewsTo:   "2026-09-27",
    decisionBy:     "2026-09-27",
    startsAt: "2026-10-23",
    applyUrl: "https://tally.so/r/7RgbEL",
  },
  {
    // AIM Innovate Impact Hub (AIMcubate), Munich. The program page shows
    // the Munich card with a direct button to this form (directApply).
    id:       "munich-aim-innovate-ws26",
    city:     "munich",
    program:  "aim-innovate",
    semester: "WS",
    year:     2026,
    opensAt:  "2026-10-20",
    deadline: "2026-11-01",
    applyUrl: "https://tally.so/r/laDy65",
  },
  {
    id:           "aachen-aim-code-ws26",
    city:         "aachen",
    program:      "aim-code",
    semester:     "WS",
    year:         2026,
    opensAt:      "2026-10-21",
    deadline:     "2026-11-06",
    deadlineTime: "12:00",
    applyUrl:     "https://tally.so/r/5XKBp6",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Day-precise comparison – times of day do not matter here. */
function day(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime();
}

/**
 * "Today" as a GERMAN calendar date. The build may run on a UTC server
 * (Netlify), where a plain new Date() is still yesterday between
 * midnight and 2 am German time – a date flip published at midnight
 * would silently not happen there.
 */
function todayBerlin(): number {
  return day(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date()));
}

export function getStatus(app: Application, today?: Date): ApplicationStatus {
  const now = today
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    : todayBerlin();
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

/**
 * Deadline for display on the cards:
 *   with deadlineTime → "6 November 12:00"
 *   without           → short form "6 Nov" (as before)
 */
export function getDeadlineLabel(app: Application): string {
  if (!app.deadline) return "To be announced";
  const d = new Date(`${app.deadline}T00:00:00`);
  if (app.deadlineTime) {
    return `${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(d)} ${app.deadlineTime}`;
  }
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d).replace("Sept", "Sep");
}

/** Days left until the deadline (negative once it has passed). */
export function getDaysLeft(app: Application, today?: Date): number {
  if (!app.deadline) return Number.POSITIVE_INFINITY;
  const now = today
    ? new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    : todayBerlin();
  const ms = day(app.deadline) - now;
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
 * Like getApplicationFor, but falls back to the most recently closed round
 * once the application phase is over. Feeds the semester timeline on the
 * location pages, which should keep showing the current batch's dates.
 */
export function getCurrentRoundFor(
  city: CitySlug, program: string, today?: Date,
): Application | undefined {
  return getApplicationFor(city, program, today)
      ?? applications
           .filter(matches(city, program))
           .filter(a => getStatus(a, today) === "closed")
           .sort((a, b) => day(b.opensAt) - day(a.opensAt))[0];
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

// ─────────────────────────────────────────────────────────────────────────────
// Rounds published in the team area (Supabase)
// ─────────────────────────────────────────────────────────────────────────────
//
// With the new application pages (PUBLIC_APPLY_URL, see docs/deployment.md)
// "Apply" leads there instead of the stored form link, and the rounds
// published in the team area are shown too. They are loaded when a page is
// opened (pages with `prerender = false` call liveRounds()), so publishing,
// editing or a round opening/closing shows up without a new build.
// A round in the team area replaces an entry above for the same city,
// program and semester.

// Read at build time, or (pages created on request) from the server's environment
const env = (name: string): string | undefined =>
  (import.meta.env[name] as string | undefined)
  || (typeof process !== "undefined" ? process.env?.[name] : undefined)
  || undefined;
const APPLY_URL = env("PUBLIC_APPLY_URL")?.trim().replace(/\/$/, "");
const SUPABASE_URL = env("PUBLIC_SUPABASE_URL")?.trim().replace(/\/$/, "");
const SUPABASE_KEY = env("PUBLIC_SUPABASE_ANON_KEY")?.trim();

/** The entries written above, with "Apply" pointing to the new pages where set up. */
const builtIn: Application[] = applications.map(a => ({
  ...a,
  applyUrl: APPLY_URL
    ? `${APPLY_URL}/?location=${encodeURIComponent(getCityName(a.city))}&program=${encodeURIComponent(getProgramName(a))}`
    : a.applyUrl,
}));
applications.splice(0, applications.length, ...builtIn);

const KNOWN_CITIES = new Set(locationItems.map(l => l.href.replace(/^\//, "")));
const sameRound = (a: Application, b: Application) =>
  a.city === b.city && a.program === b.program && a.semester === b.semester && a.year === b.year;

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromDatabase(r: any): Application | undefined {
  const term = /^(WS|SS)\s*(\d{2})/.exec(r.semester_label ?? "");
  if (!term || !KNOWN_CITIES.has(r.location_id) || !getProgram(r.program_id)) return undefined;
  return {
    id: `db-${r.slug}`,
    city: r.location_id as CitySlug,
    program: r.program_id,
    semester: term[1] as Semester,
    year: 2000 + Number(term[2]),
    opensAt: r.opens_at,
    deadline: r.deadline ?? undefined,
    deadlineTime: r.deadline_time ? String(r.deadline_time).slice(0, 5) : undefined,
    interviewsFrom: r.interviews_from ?? undefined,
    interviewsTo: r.interviews_to ?? undefined,
    interviewsLabel: r.interviews_label ?? undefined,
    decisionBy: r.decision_by ?? undefined,
    startsAt: r.starts_at ?? undefined,
    spots: r.spots ?? undefined,
    applyUrl: `${APPLY_URL}/form?a=${encodeURIComponent(r.slug)}`,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let cache: { at: number; rounds: Application[] } | undefined;

/**
 * Loads the published rounds and puts them into `applications`, so all helpers
 * above (and every component using them) see them. Call it at the top of a page
 * with `export const prerender = false`, passing Astro: the page is then kept
 * by Netlify's CDN for 5 minutes and refreshed in the background.
 * Without PUBLIC_APPLY_URL / Supabase settings only the entries above are shown.
 */
export async function liveRounds(astro?: { response: { headers: Headers } }): Promise<void> {
  if (astro) {
    astro.response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    astro.response.headers.set("Netlify-CDN-Cache-Control", "public, durable, s-maxage=300, stale-while-revalidate=86400");
  }
  // Diagnostic header (no secrets): which settings are present and how many rounds came back
  const note = (v: string) => astro?.response.headers.set("X-OneAIM-Rounds", v);
  if (!APPLY_URL || !SUPABASE_URL || !SUPABASE_KEY) {
    note(`off; missing ${[!APPLY_URL && "PUBLIC_APPLY_URL", !SUPABASE_URL && "PUBLIC_SUPABASE_URL", !SUPABASE_KEY && "PUBLIC_SUPABASE_ANON_KEY"].filter(Boolean).join(",")}`);
    return;
  }
  if (!cache || Date.now() - cache.at > 60_000) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/published_applications`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      const rows = (await res.json()) as unknown[];
      cache = { at: Date.now(), rounds: rows.map(fromDatabase).filter((a): a is Application => !!a) };
    } catch (e) {
      // Database not reachable: keep the last known rounds (or only the entries above)
      console.error("Could not load application rounds:", e);
      note(`error; ${String((e as Error)?.message ?? e).slice(0, 80)}`);
      if (!cache) return;
    }
  }
  const live = cache.rounds;
  if (!astro?.response.headers.has("X-OneAIM-Rounds")) note(`ok; ${live.length} published`);
  applications.splice(0, applications.length, ...builtIn.filter(a => !live.some(l => sameRound(a, l))), ...live);
}
