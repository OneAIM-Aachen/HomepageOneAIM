// Demo mode: adds ~700 made-up applications (all cities, programs, rounds) to what's shown in the
// team area, to try out Insights, network and lists. Nothing is written to
// Supabase; it only changes what this browser displays.
// Available locally and where PUBLIC_DEMO_MODE=true (the Netlify test site),
// switched with the toggle in the sidebar (or ?demo=1 / ?demo=0).
import type { Application, Person, State, Submission, SubmissionStatus } from "./types";
import { defaultTemplates } from "./fields";

const KEY = "oneaim-demo";

export const demoAvailable = (): boolean =>
  import.meta.env.DEV || import.meta.env.PUBLIC_DEMO_MODE === "true";

/** Shown by default (where available) until someone switches it off. */
const DEFAULT_ON = true;

export function isDemo(): boolean {
  if (!demoAvailable() || typeof window === "undefined") return false;
  const p = new URLSearchParams(location.search).get("demo");
  try {
    if (p === "1" || p === "0") localStorage.setItem(KEY, p);
    const stored = localStorage.getItem(KEY);
    return stored === null ? DEFAULT_ON : stored === "1";
  } catch {
    return p ? p === "1" : DEFAULT_ON;
  }
}

export function setDemo(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* ignore */ }
  const u = new URL(location.href);
  u.searchParams.delete("demo");
  location.href = u.toString();
}

/** Demo entries can't be changed (they don't exist in the database). */
export const isDemoId = (id: string) => id.startsWith("demo-");

// Small deterministic random generator, so the demo looks the same every time
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Lena", "Jonas", "Amira", "Paul", "Sofia", "Max", "Hannah", "Luca", "Elif", "Felix", "Clara", "David", "Mia", "Noah",
  "Emma", "Leon", "Aylin", "Tim", "Laura", "Ben", "Nora", "Julian", "Marie", "Samuel", "Anna", "Moritz", "Ida", "Ella", "Finn",
  "Sara", "Yusuf", "Lea", "Jakob", "Chiara", "Tom", "Maja", "Ole", "Zoe", "Henrik", "Priya", "Kenji", "Fatima", "Mateo", "Ines"];
const LAST = ["Hoffmann", "Becker", "Haddad", "Schneider", "Rossi", "Weber", "Fischer", "Moretti", "Yilmaz", "Wagner", "Neumann",
  "Kowalski", "Schulz", "Klein", "Richter", "Braun", "Demir", "Krüger", "Zimmermann", "Hartmann", "Lange", "Schmitt", "Koch",
  "Adeyemi", "Wolf", "Schäfer", "Lindqvist", "Bauer", "Vogel", "Novak", "Arslan", "Krause", "Huber", "Bianchi", "Jansen", "Tanaka"];

// [value, weight]
type W<T> = [T, number][];

// Home universities per city
const HOME: Record<string, W<string>> = {
  Munich: [["Technical University of Munich (TUM)", 48], ["LMU Munich", 34], ["Munich University of Applied Sciences (HM)", 12], ["University of the Bundeswehr Munich", 3], ["University of Augsburg", 3]],
  Aachen: [["RWTH Aachen University", 72], ["FH Aachen University of Applied Sciences", 14], ["Maastricht University", 6], ["University of Cologne", 4], ["Heinrich Heine University Düsseldorf", 4]],
  Frankfurt: [["Goethe University Frankfurt", 46], ["TU Darmstadt", 20], ["Frankfurt University of Applied Sciences", 12], ["Frankfurt School of Finance & Management", 10], ["Johannes Gutenberg University Mainz", 12]],
};
const EXTRA_UNI = ["ETH Zurich", "Maastricht University", "KU Leuven", "Delft University of Technology", "Karolinska Institute Stockholm",
  "University of Oxford", "Imperial College London", "Harvard University", "Stanford University", "National University of Singapore",
  "University of Toronto", "Johns Hopkins University", "Charité – Universitätsmedizin Berlin", "University of Twente",
  "University of Copenhagen", "University of Vienna", "University of Zurich", "Sorbonne Nouvelle University (Paris III)"];

// Study programs per AIM program (Code/Science lean technical, Connect/Educate are mixed)
const PROGRAMS: Record<string, W<string>> = {
  mixed: [["Medicine", 28], ["Mechanical Engineering", 11], ["Computer Science", 12], ["Biomedical Engineering / Medical Technology", 12],
    ["Electrical Engineering", 7], ["Data Science", 6], ["Molecular Medicine", 5], ["Physics", 4], ["Business Administration", 5],
    ["Industrial Engineering", 4], ["Psychology", 3], ["Pharmacy", 2], ["Chemistry", 2]],
  tech: [["Computer Science", 30], ["Data Science", 16], ["Medicine", 14], ["Electrical Engineering", 10], ["Artificial Intelligence", 8],
    ["Mathematics", 6], ["Biomedical Engineering / Medical Technology", 8], ["Physics", 5], ["Medical Informatics", 3]],
  founders: [["Business Administration", 18], ["Medicine", 20], ["Computer Science", 16], ["Management & Technology", 14],
    ["Biomedical Engineering / Medical Technology", 14], ["Mechanical Engineering", 8], ["Economics", 6], ["Law", 4]],
};
const DEGREES: W<string> = [["Bachelor", 34], ["Master", 30], ["State exam (Staatsexamen)", 26], ["PhD / Doctorate", 7], ["Graduated / working", 3]];

// Which programs run where, with pipeline, profile mix and size per round
const OFFER: { city: string; program: string; pipeline: Application["pipeline"]; mix: string; size: number; only?: string; day?: string }[] = [
  { city: "Munich", program: "AIM Connect", pipeline: "interview", mix: "mixed", size: 34 },
  // Second, later intake in the same semester (same program, same city)
  { city: "Munich", program: "AIM Connect", pipeline: "interview", mix: "mixed", size: 18, only: "SS 27", day: "15" },
  { city: "Munich", program: "AIM Code", pipeline: "screening", mix: "tech", size: 24 },
  { city: "Munich", program: "AIM Innovate", pipeline: "interview", mix: "founders", size: 12 },
  { city: "Munich", program: "AIM Science", pipeline: "interview", mix: "tech", size: 10 },
  { city: "Munich", program: "AIM Educate", pipeline: "instant", mix: "mixed", size: 30 },
  { city: "Aachen", program: "AIM Connect", pipeline: "interview", mix: "mixed", size: 28 },
  { city: "Aachen", program: "AIM Code", pipeline: "screening", mix: "tech", size: 18 },
  { city: "Aachen", program: "AIM Educate", pipeline: "instant", mix: "mixed", size: 22 },
  { city: "Frankfurt", program: "AIM Connect", pipeline: "interview", mix: "mixed", size: 20 },
  { city: "Frankfurt", program: "AIM Educate", pipeline: "instant", mix: "mixed", size: 16 },
];
const ROUNDS: [string, string][] = [["SS 26", "2026-03"], ["WS 26/27", "2026-09"], ["SS 27", "2027-03"]];
const CURRENT = "SS 27";

function pick<T>(r: () => number, list: W<T>): T {
  const total = list.reduce((t, [, w]) => t + w, 0);
  let x = r() * total;
  for (const [v, w] of list) { if ((x -= w) < 0) return v; }
  return list[list.length - 1]![0];
}

function statusFor(r: () => number, pipeline: Application["pipeline"], current: boolean): { status: SubmissionStatus; interviewed: boolean } {
  const x = r();
  if (pipeline === "instant") return { status: "confirmed", interviewed: false };
  if (pipeline === "screening") return { status: current && x < 0.5 ? "new" : x < 0.5 ? "rejected" : "accepted", interviewed: false };
  if (current && x < 0.4) return { status: "new", interviewed: false };
  if (x < 0.45) return { status: "rejected", interviewed: false };                 // after screening
  if (current && x < 0.72) return { status: "invited", interviewed: true };
  return { status: x < 0.68 ? "rejected" : "accepted", interviewed: true };         // after the interview
}

export function withDemo(s: State): State {
  const r = rng(42);
  const apps: Application[] = [];
  const people: Person[] = [];
  const subs: Submission[] = [];
  const pool: Record<string, Person[]> = {};   // per city, for repeat applicants
  let pid = 0;

  const newPerson = (city: string, mix: string): Person => {
    const universities = [pick(r, HOME[city]!)];
    if (r() < 0.3) universities.push(EXTRA_UNI[Math.floor(r() * EXTRA_UNI.length)]!);
    if (r() < 0.06) universities.push(EXTRA_UNI[Math.floor(r() * EXTRA_UNI.length)]!);
    const studyPrograms = [pick(r, PROGRAMS[mix]!)];
    if (r() < 0.09) studyPrograms.push(pick(r, PROGRAMS.mixed!));
    const degree = pick(r, DEGREES);
    const semester = degree === "PhD / Doctorate" || degree === "Graduated / working" ? "Not applicable"
      : String(1 + Math.floor(r() * (degree === "State exam (Staatsexamen)" ? 12 : 7)));
    const p: Person = {
      id: `demo-p${pid}`, email: `demo${pid}@example.com`,
      name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
      universities: [...new Set(universities)], studyPrograms: [...new Set(studyPrograms)], semester, degree, firstSeen: "2026-03-01",
    };
    pid++;
    people.push(p);
    (pool[city] ??= []).push(p);
    return p;
  };

  for (const [round, month] of ROUNDS) {
    for (const o of OFFER) {
      if (!s.tagLists.locations.includes(o.city) || !s.tagLists.programs.includes(o.program)) continue;
      if (o.only && o.only !== round) continue;
      const opens = `${month}-${o.day ?? "01"}`;
      const app: Application = {
        id: `demo-${o.city}-${o.program}-${round}-${o.day ?? "01"}`.replace(/\W+/g, "-").toLowerCase(), slug: `demo-${o.city}-${round}`.toLowerCase(),
        title: o.pipeline === "instant" ? `${o.program.replace("AIM ", "")} Summit ${o.city} – ${round}` : undefined,
        blueprintName: "Demo", fields: [], tags: { semester: round, program: o.program, location: o.city }, pipeline: o.pipeline,
        published: true, dates: { opensAt: opens, deadline: `${month}-28` }, intro: "", image: undefined,
        templates: defaultTemplates(o.pipeline), slots: [], createdAt: opens, createdBy: o.city,
      };
      apps.push(app);
      const size = Math.round(o.size * (0.8 + r() * 0.5) * (round === CURRENT ? 1.1 : 1));
      const taken = new Set<string>();
      for (let k = 0; k < size; k++) {
        // ~15% are people who applied before in the same city (other program or later round)
        const known = (pool[o.city] ?? []).filter(p => !taken.has(p.id));
        const person = known.length > 10 && r() < 0.15 ? known[Math.floor(r() * known.length)]! : newPerson(o.city, o.mix);
        taken.add(person.id);
        const { status, interviewed } = statusFor(r, o.pipeline, round === CURRENT);
        subs.push({
          id: `demo-s${subs.length}`, applicationId: app.id, personId: person.id, answers: {}, status,
          score: status === "new" || o.pipeline === "instant" ? undefined : 1 + Math.floor(r() * 5), bookingToken: "", comments: [],
          history: interviewed ? [{ status: "invited", at: app.dates.deadline, by: o.city }] : [],
          submittedAt: `${month}-${String(2 + Math.floor(r() * 17)).padStart(2, "0")}T12:00:00Z`,
        });
      }
    }
  }

  return { ...s, applications: [...s.applications, ...apps], people: [...s.people, ...people], submissions: [...s.submissions, ...subs] };
}
