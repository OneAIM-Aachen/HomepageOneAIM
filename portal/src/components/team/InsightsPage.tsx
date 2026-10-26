// Insights: statistics on the network and the selection process.
// Everything is computed in the browser from the data the team area already
// loads (people, submissions, applications); no extra database queries.
//
// Colors (validated with the dataviz palette checker):
//   single series   → brand blue
//   cities          → fixed per city (blue, orange, aqua, violet), never by rank
//   funnel stages   → three steps of the blue ramp (ordinal)
//   cross table     → one-hue sequential blue
import { useEffect, useMemo, useState } from "preact/hooks";
import type { Application, Person, State, Submission } from "../../lib/types";
import { useStore } from "../../lib/store";
import { appTitle, DEGREE_OPTIONS, fmtDate, SEMESTER_OPTIONS } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { IconDownload } from "../ui/Icons";

const BLUE = "#0052E9";
const CITY_COLORS = ["#0052E9", "#eb6834", "#1baf7a", "#8D2DF1"];
const STAGE_COLORS = ["#86b6ef", "#3987e5", "#0052E9"];

type Status = "" | "accepted" | "pending" | "rejected";
type Entry = { sub: Submission; app: Application; person: Person };

const isAccepted = (x: Submission) => x.status === "accepted" || x.status === "confirmed";
const reachedInterview = (x: Submission) => x.status === "invited" || x.history.some(h => h.status === "invited");
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const fmtPct = (n: number, d: number) => (d ? `${pct(n, d)}%` : "–");

export default function InsightsPage() {
  return <TeamShell active="insights">{() => <Insights />}</TeamShell>;
}

function Insights() {
  const s = useStore(x => x);
  const [city, setCity] = useState("");
  const [program, setProgram] = useState("");
  const [round, setRound] = useState("");
  const [status, setStatus] = useState<Status>("");
  const [appId, setAppId] = useState("");

  const categoryOf = (name: string) => s.studyPrograms.find(p => p.name === name)?.category ?? "Other";
  const cityColor = (c: string) => CITY_COLORS[Math.max(0, s.tagLists.locations.indexOf(c)) % CITY_COLORS.length]!;

  // All submissions with their application and person, then the filtered set
  const all: Entry[] = useMemo(() => s.submissions.flatMap(sub => {
    const app = s.applications.find(a => a.id === sub.applicationId);
    const person = s.people.find(p => p.id === sub.personId);
    return app && person ? [{ sub, app, person }] : [];
  }), [s]);

  const entries = all.filter(e =>
    (!appId || e.app.id === appId) &&
    (!city || e.app.tags.location === city) && (!program || e.app.tags.program === program) && (!round || e.app.tags.semester === round) &&
    (!status || (status === "accepted" ? isAccepted(e.sub) : status === "rejected" ? e.sub.status === "rejected" : e.sub.status === "new" || e.sub.status === "invited")));
  // Applications to choose from: those matching city / program / round, newest first.
  // Two rounds with the same title (e.g. two AIM Connect Munich rounds in one semester)
  // are told apart by their opening date.
  const appOptions = s.applications
    .filter(a => (!city || a.tags.location === city) && (!program || a.tags.program === program) && (!round || a.tags.semester === round))
    .filter(a => all.some(e => e.app.id === a.id))
    .sort((a, b) => b.dates.opensAt.localeCompare(a.dates.opensAt));
  const appTitleCount = new Map<string, number>();
  for (const a of appOptions) appTitleCount.set(appTitle(a), (appTitleCount.get(appTitle(a)) ?? 0) + 1);
  // A chosen application that no longer fits the other filters is dropped
  const appStillFits = !appId || appOptions.some(a => a.id === appId);
  useEffect(() => { if (!appStillFits) setAppId(""); }, [appStillFits]);

  const people = [...new Map(entries.map(e => [e.person.id, e.person])).values()];

  // Link to the network list with the current filters + one dimension
  const netLink = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ ...(city && { city }), ...(program && { program }), ...(round && { round }), ...(status && { status }), ...(appId && { app: appId }), ...extra });
    return `/team/network?${q}`;
  };

  // Distribution over people (multi-value dimensions count once per value)
  const dist = (values: (p: Person) => string[], order?: string[]) => {
    const m = new Map<string, number>();
    for (const p of people) for (const v of new Set(values(p))) m.set(v, (m.get(v) ?? 0) + 1);
    const rows = [...m].map(([label, value]) => ({ label, value }));
    return order ? order.filter(o => m.has(o)).map(o => ({ label: o, value: m.get(o)! })) : rows.sort((a, b) => b.value - a.value);
  };

  const byUni = dist(p => p.universities);
  const byField = dist(p => p.studyPrograms.map(categoryOf));
  const byProgram = dist(p => p.studyPrograms);
  const byDegree = dist(p => (p.degree ? [p.degree] : []), DEGREE_OPTIONS);
  const bySemester = dist(p => (p.semester ? [p.semester] : []), SEMESTER_OPTIONS);

  // Key figures
  const decided = entries.filter(e => e.app.pipeline !== "instant" && (isAccepted(e.sub) || e.sub.status === "rejected"));
  const accepted = entries.filter(e => isAccepted(e.sub));
  const perPerson = new Map<string, Entry[]>();
  for (const e of all) perPerson.set(e.person.id, [...(perPerson.get(e.person.id) ?? []), e]);
  const filteredIds = new Set(people.map(p => p.id));
  const repeat = [...perPerson].filter(([id, list]) => filteredIds.has(id) && list.length > 1);

  const exportCsv = () => {
    const blocks: [string, { label: string; value: number }[]][] = [
      ["University affiliations", byUni], ["Field", byField], ["Study program", byProgram], ["Degree level", byDegree], ["Semester", bySemester],
    ];
    const lines = [["Dimension", "Value", "People", "Share of people"]];
    for (const [dim, rows] of blocks) for (const r of rows) lines.push([dim, r.label, String(r.value), `${pct(r.value, people.length)}%`]);
    const csv = lines.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `oneaim-insights${city ? `-${city}` : ""}${program ? `-${program}` : ""}${round ? `-${round.replace(/\W+/g, "")}` : ""}.csv`;
    a.click();
  };

  const chosenApp = s.applications.find(a => a.id === appId);
  const filterLabel = [...(chosenApp ? [appTitle(chosenApp)] : []), city || "All cities", program || "all programs", round || "all rounds",
    status === "accepted" ? "accepted/confirmed" : status === "rejected" ? "rejected" : status === "pending" ? "in progress" : "all statuses"].join(" · ");

  const sel = (label: string, value: string, set: (v: string) => void, opts: [string, string][]) => (
    <select class="input input--sm" style="width:auto" value={value} onChange={e => set(e.currentTarget.value)} aria-label={label}>
      {opts.map(([v, l]) => <option value={v}>{l}</option>)}
    </select>
  );

  return (
    <div class="stack insights" style="gap:22px">
      <PageHead overline="Insights" title="Insights"
        sub="Who applies, who gets in, and how it develops. Counts are people, unless a chart says applications."
        actions={<>
          <button class="btn btn--secondary" onClick={exportCsv}><IconDownload width={16} />Export CSV</button>
          <button class="btn btn--secondary" onClick={() => window.print()}>Print / PDF</button>
        </>} />

      <div class="row no-print">
        {sel("City", city, setCity, [["", "All cities"], ...s.tagLists.locations.map(l => [l, l] as [string, string])])}
        {sel("Program", program, setProgram, [["", "All programs"], ...s.tagLists.programs.map(l => [l, l] as [string, string])])}
        {sel("Round", round, setRound, [["", "All rounds"], ...s.tagLists.semesters.map(l => [l, l] as [string, string])])}
        {sel("Application", appId, setAppId, [["", appOptions.length ? `All applications (${appOptions.length})` : "No applications"],
          ...appOptions.map(a => [a.id, `${appTitle(a)}${appTitleCount.get(appTitle(a))! > 1 ? ` · opens ${fmtDate(a.dates.opensAt)}` : ""}`] as [string, string])])}
        {sel("Status", status, v => setStatus(v as Status), [["", "All applicants"], ["accepted", "Accepted / confirmed"], ["pending", "In progress"], ["rejected", "Rejected"]])}
        {(city || program || round || status || appId) && <button class="btn btn--ghost btn--sm" onClick={() => { setCity(""); setProgram(""); setRound(""); setStatus(""); setAppId(""); }}>Reset filters</button>}
      </div>
      <p class="print-only muted">{filterLabel}</p>

      {entries.length === 0 ? <div class="empty">No applications match these filters.</div> : (
        <>
          <div class="stats">
            <div class="card stat"><span class="stat__num">{entries.length}</span><span class="stat__label">Applications</span><span class="muted small">{people.length} people</span></div>
            <div class="card stat"><span class="stat__num">{fmtPct(accepted.filter(e => e.app.pipeline !== "instant").length, decided.length)}</span><span class="stat__label">Acceptance rate</span><span class="muted small">of {decided.length} decided applications</span></div>
            <div class="card stat"><span class="stat__num">{byUni.length}</span><span class="stat__label">Universities</span><span class="muted small">{byField.length} fields of study</span></div>
            <div class="card stat"><span class="stat__num">{fmtPct(repeat.length, people.length)}</span><span class="stat__label">Applied more than once</span><span class="muted small">{repeat.length} of {people.length} people</span></div>
          </div>

          <section class="card stack">
            <ChartHead title="Selection funnel" sub="Applications that reached each stage. Events with direct registration have no interview stage; a confirmed registration counts as accepted." />
            <Funnel entries={entries} />
          </section>

          <div class="grid-2" style="align-items:start">
            <section class="card stack">
              <ChartHead title="University affiliations" sub={`Share of ${people.length} people. Several per person, so shares add up to more than 100%.`} />
              <BarList rows={byUni} total={people.length} limit={12} href={v => netLink({ uni: v })} />
            </section>
            <section class="card stack">
              <ChartHead title="Fields of study" sub={`Share of ${people.length} people, grouped by field. Double degrees count in each field.`} />
              <BarList rows={byField} total={people.length} href={v => netLink({ field: v })} />
              <ChartHead title="Study programs" />
              <BarList rows={byProgram} total={people.length} limit={10} href={v => netLink({ study: v })} />
            </section>
            <section class="card stack">
              <ChartHead title="Degree level" sub={`Share of ${people.length} people.`} />
              <BarList rows={byDegree} total={people.length} href={v => netLink({ degree: v })} />
            </section>
            <section class="card stack">
              <ChartHead title="Current semester" sub={`Share of ${people.length} people.`} />
              <BarList rows={bySemester.map(r => ({ ...r, display: /^\d/.test(r.label) ? `${r.label}. semester` : r.label }))} total={people.length} href={v => netLink({ sem: v })} />
            </section>
          </div>

          <section class="card stack">
            <ChartHead title="Acceptance by university" sub="Decided applications per university affiliation (at least 3). Shows which universities make it through." />
            <AcceptanceBy entries={decided} key_={e => e.person.universities} />
          </section>

          <section class="card stack">
            <ChartHead title="Applications per round" sub="Number of applications per semester and city (ignores the round and city filters)." />
            <Trends s={s} entries={all.filter(e => (!program || e.app.tags.program === program) &&
              (!status || (status === "accepted" ? isAccepted(e.sub) : status === "rejected" ? e.sub.status === "rejected" : e.sub.status === "new" || e.sub.status === "invited")))}
              cityColor={cityColor} />
          </section>

          <CrossTable entries={entries} categoryOf={categoryOf} />

          <section class="card stack">
            <ChartHead title="Repeat applicants" sub="People in the current selection who applied more than once (across all rounds)." />
            <Repeat perPerson={perPerson} ids={filteredIds} />
          </section>
        </>
      )}
    </div>
  );
}

function ChartHead({ title, sub }: { title: string; sub?: string }) {
  return <div class="stack-s" style="gap:2px"><h3>{title}</h3>{sub && <p class="muted small">{sub}</p>}</div>;
}

/** Horizontal bars, single series (brand blue), value + share at the tip. */
function BarList({ rows, total, limit, href }: {
  rows: { label: string; value: number; display?: string }[]; total: number; limit?: number; href?: (v: string) => string;
}) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p class="muted small">No data.</p>;
  const shown = limit && !all ? rows.slice(0, limit) : rows;
  const max = Math.max(...rows.map(r => r.value));
  return (
    <div class="barlist">
      {shown.map(r => {
        const inner = (
          <>
            <span class="barlist__label">{r.display ?? r.label}</span>
            <span class="barlist__track" aria-hidden="true">
              <span class="barlist__bar" style={`width:${Math.max(2, (r.value / max) * 100)}%;background:${BLUE}`} />
            </span>
            <span class="barlist__value">{r.value} <span class="muted">· {pct(r.value, total)}%</span></span>
          </>
        );
        return href
          ? <a class="barlist__row" href={href(r.label)} title={`${r.display ?? r.label}: ${r.value} people (${pct(r.value, total)}%). Click to see them.`}>{inner}</a>
          : <div class="barlist__row">{inner}</div>;
      })}
      {limit && rows.length > limit && (
        <button class="btn btn--ghost btn--sm no-print" style="align-self:flex-start" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

function Funnel({ entries }: { entries: Entry[] }) {
  const [by, setBy] = useState<"program" | "location" | "application">("program");
  if (!entries.length) return <p class="muted small">No applications in this filter.</p>;
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = by === "program" ? e.app.tags.program : by === "location" ? e.app.tags.location : appTitle(e.app);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const rows = [["All", entries] as [string, Entry[]], ...[...groups].sort((a, b) => b[1].length - a[1].length)];
  return (
    <div class="stack-s">
      <div class="row no-print" role="group" aria-label="Group funnel by">
        {([["program", "By program"], ["location", "By city"], ["application", "By application"]] as const).map(([k, l]) => (
          <button class={`chip-btn ${by === k ? "is-active" : ""}`} aria-pressed={by === k} onClick={() => setBy(k)}>{l}</button>
        ))}
      </div>
      <div class="legend" aria-hidden="true">
        {["Applied", "Reached interview", "Accepted"].map((l, i) => <span><i style={`background:${STAGE_COLORS[i]}`} />{l}</span>)}
      </div>
      <div class="table-wrap">
        <table class="table funnel-table">
          <thead><tr><th>{by === "program" ? "Program" : by === "location" ? "City" : "Application"}</th><th>Stages</th><th class="num">Applied</th><th class="num">Interview</th><th class="num">Accepted</th><th class="num">Rate</th></tr></thead>
          <tbody>
            {rows.map(([name, list]) => {
              const applied = list.length;
              // Interviews only exist in rounds with the interview pipeline
              const withInterview = list.filter(e => e.app.pipeline === "interview");
              const interview = withInterview.filter(e => reachedInterview(e.sub)).length;
              const allInterview = withInterview.length === applied;
              const hasInterview = withInterview.length > 0;
              const acc = list.filter(e => isAccepted(e.sub)).length;
              // Decided = accepted, confirmed (events) or rejected
              const decidedN = list.filter(e => isAccepted(e.sub) || e.sub.status === "rejected").length;
              return (
                <tr style={name === "All" ? "font-weight:800" : ""}>
                  <td>{name}</td>
                  <td style="min-width:200px">
                    <div class="stages" title={`Applied ${applied} · interview ${hasInterview ? interview : "–"} · accepted ${acc}`}>
                      {[applied, hasInterview ? interview : null, acc].map((v, i) => v === null ? null :
                        <span style={`width:${pct(v, applied)}%;background:${STAGE_COLORS[i]}`} />)}
                    </div>
                  </td>
                  <td class="num">{applied}</td>
                  <td class="num">
                    {!withInterview.length ? <span class="muted">–</span>
                      : allInterview ? <>{interview} <span class="muted small">{fmtPct(interview, applied)}</span></>
                      : <>{interview} <span class="muted small">of {withInterview.length}</span></>}
                  </td>
                  <td class="num">{acc}</td>
                  <td class="num"><strong>{fmtPct(acc, decidedN)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p class="muted small">Bars are shares of all applications in the row. Rate = accepted (or confirmed) of all decided applications. Interview = invited at some point; “x of y” means x of the y applications in rounds that have interviews (screening rounds like AIM Code and events have none).</p>
    </div>
  );
}

function AcceptanceBy({ entries, key_ }: { entries: Entry[]; key_: (e: Entry) => string[] }) {
  const m = new Map<string, { n: number; acc: number }>();
  for (const e of entries) for (const k of key_(e)) {
    const v = m.get(k) ?? { n: 0, acc: 0 };
    v.n++; if (isAccepted(e.sub)) v.acc++;
    m.set(k, v);
  }
  const rows = [...m].filter(([, v]) => v.n >= 3).sort((a, b) => b[1].n - a[1].n);
  if (!rows.length) return <p class="muted small">Not enough decided applications yet (at least 3 per university).</p>;
  return (
    <div class="barlist">
      {rows.map(([k, v]) => (
        <div class="barlist__row">
          <span class="barlist__label">{k}</span>
          <span class="barlist__track" aria-hidden="true"><span class="barlist__bar" style={`width:${Math.max(2, pct(v.acc, v.n))}%;background:${BLUE}`} /></span>
          <span class="barlist__value">{pct(v.acc, v.n)}% <span class="muted">· {v.acc} of {v.n}</span></span>
        </div>
      ))}
    </div>
  );
}

/** Grouped columns: rounds on the x axis, one column per city (fixed city colors). */
function Trends({ s, entries, cityColor }: { s: State; entries: Entry[]; cityColor: (c: string) => string }) {
  const rounds = s.tagLists.semesters.filter(r => entries.some(e => e.app.tags.semester === r));
  const cities = s.tagLists.locations.filter(c => entries.some(e => e.app.tags.location === c));
  if (!rounds.length) return <p class="muted small">No data.</p>;
  const val = (r: string, c: string) => entries.filter(e => e.app.tags.semester === r && e.app.tags.location === c).length;
  const max = Math.max(1, ...rounds.flatMap(r => cities.map(c => val(r, c))));
  const tick = niceMax(max);
  const H = 180, colW = 18, gap = 2, groupGap = 28;
  const groupW = cities.length * colW + (cities.length - 1) * gap;
  const W = 40 + rounds.length * (groupW + groupGap);
  const TOP = 12;
  const y = (v: number) => TOP + H - (v / tick) * H;
  return (
    <div class="stack-s">
      <div class="legend">{cities.map(c => <span><i style={`background:${cityColor(c)}`} />{c}</span>)}</div>
      <div style="overflow-x:auto">
        <svg width={W} height={TOP + H + 36} role="img" aria-label="Applications per round and city">
          {[0, 0.5, 1].map(f => (
            <g>
              <line x1={34} x2={W} y1={y(tick * f)} y2={y(tick * f)} stroke="#E4E7EE" stroke-width={1} />
              <text x={28} y={y(tick * f) + 4} text-anchor="end" font-size="11" fill="#6B7599">{Math.round(tick * f)}</text>
            </g>
          ))}
          {rounds.map((r, i) => {
            const x0 = 44 + i * (groupW + groupGap);
            return (
              <g>
                {cities.map((c, j) => {
                  const v = val(r, c);
                  const h = TOP + H - y(v);
                  const x = x0 + j * (colW + gap);
                  return (
                    <g>
                      <title>{`${c}, ${r}: ${v} application${v === 1 ? "" : "s"}`}</title>
                      {v > 0 && <path d={roundedTop(x, y(v), colW, h, 4)} fill={cityColor(c)} />}
                      <rect x={x} y={TOP} width={colW + gap} height={H} fill="transparent" />
                    </g>
                  );
                })}
                <text x={x0 + groupW / 2} y={TOP + H + 18} text-anchor="middle" font-size="12" fill="#3D4660">{r}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <details class="no-print"><summary class="small muted" style="cursor:pointer">Show as table</summary>
        <table class="table" style="margin-top:8px">
          <thead><tr><th>Round</th>{cities.map(c => <th class="num">{c}</th>)}<th class="num">Total</th></tr></thead>
          <tbody>{rounds.map(r => <tr><td>{r}</td>{cities.map(c => <td class="num">{val(r, c)}</td>)}<td class="num"><strong>{cities.reduce((t, c) => t + val(r, c), 0)}</strong></td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

function niceMax(v: number) {
  // Even steps only, so the middle gridline is a whole number
  const steps = [2, 4, 6, 8, 10, 20, 30, 40, 50, 60, 80, 100, 200, 300, 400, 500, 1000];
  return steps.find(s => s >= v) ?? Math.ceil(v / 1000) * 1000;
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

type Dim = "location" | "program" | "round" | "university" | "field" | "degree" | "semester" | "status";
const DIMS: [Dim, string][] = [
  ["location", "City"], ["program", "Program"], ["round", "Round"], ["university", "University"],
  ["field", "Field of study"], ["degree", "Degree level"], ["semester", "Semester"], ["status", "Status"],
];

function CrossTable({ entries, categoryOf }: { entries: Entry[]; categoryOf: (n: string) => string }) {
  const [rowDim, setRowDim] = useState<Dim>("field");
  const [colDim, setColDim] = useState<Dim>("location");
  const vals = (e: Entry, d: Dim): string[] => {
    switch (d) {
      case "location": return [e.app.tags.location];
      case "program": return [e.app.tags.program];
      case "round": return [e.app.tags.semester];
      case "university": return e.person.universities;
      case "field": return [...new Set(e.person.studyPrograms.map(categoryOf))];
      case "degree": return e.person.degree ? [e.person.degree] : [];
      case "semester": return e.person.semester ? [e.person.semester] : [];
      case "status": return [isAccepted(e.sub) ? "Accepted" : e.sub.status === "rejected" ? "Rejected" : "In progress"];
    }
  };
  // Count applications per cell (an application counts in every value of a multi-value dimension)
  const cells = new Map<string, number>();
  const rowsSet = new Map<string, number>(), colsSet = new Map<string, number>();
  for (const e of entries) for (const r of vals(e, rowDim)) for (const c of vals(e, colDim)) {
    cells.set(`${r}\u0000${c}`, (cells.get(`${r}\u0000${c}`) ?? 0) + 1);
    rowsSet.set(r, (rowsSet.get(r) ?? 0) + 1);
    colsSet.set(c, (colsSet.get(c) ?? 0) + 1);
  }
  const order = (m: Map<string, number>, d: Dim) => d === "degree" ? DEGREE_OPTIONS.filter(o => m.has(o))
    : d === "semester" ? SEMESTER_OPTIONS.filter(o => m.has(o)) : [...m].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const rows = order(rowsSet, rowDim).slice(0, 15), cols = order(colsSet, colDim).slice(0, 8);
  const max = Math.max(1, ...cells.values());
  // One-hue sequential blue: light (few) → dark (many)
  const shade = (v: number) => (v ? `rgba(0, 82, 233, ${0.1 + 0.75 * (v / max)})` : "transparent");
  const ink = (v: number) => (v / max > 0.55 ? "#fff" : "var(--color-text-heading)");
  const dimSel = (value: Dim, set: (d: Dim) => void, label: string) => (
    <select class="input input--sm" style="width:auto" value={value} onChange={e => set(e.currentTarget.value as Dim)} aria-label={label}>
      {DIMS.map(([k, l]) => <option value={k}>{l}</option>)}
    </select>
  );
  return (
    <section class="card stack">
      <div class="row row--between">
        <ChartHead title="Cross table" sub="Applications by two dimensions. Darker = more." />
        <div class="row no-print">{dimSel(rowDim, setRowDim, "Rows")}<span class="muted small">×</span>{dimSel(colDim, setColDim, "Columns")}</div>
      </div>
      {rows.length === 0 || cols.length === 0 ? <p class="muted small">No data.</p> : (
        <div class="table-wrap">
          <table class="table heat">
            <thead><tr><th>{DIMS.find(d => d[0] === rowDim)![1]}</th>{cols.map(c => <th class="num">{c}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr>
                  <td>{r}</td>
                  {cols.map(c => {
                    const v = cells.get(`${r}\u0000${c}`) ?? 0;
                    return <td class="num" style={`background:${shade(v)};color:${ink(v)}`} title={`${r} × ${c}: ${v}`}>{v || ""}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(rowsSet.size > 15 || colsSet.size > 8) && <p class="muted small">Showing the largest {Math.min(15, rowsSet.size)} rows and {Math.min(8, colsSet.size)} columns.</p>}
    </section>
  );
}

function Repeat({ perPerson, ids }: { perPerson: Map<string, Entry[]>; ids: Set<string> }) {
  const lists = [...perPerson].filter(([id]) => ids.has(id)).map(([, l]) => l);
  const multi = lists.filter(l => l.length > 1);
  const programs = lists.filter(l => new Set(l.map(e => e.app.tags.program)).size > 1);
  const cities = lists.filter(l => new Set(l.map(e => e.app.tags.location)).size > 1);
  // Accepted once, then applied again later
  const returning = lists.filter(l => {
    const sorted = [...l].sort((a, b) => a.sub.submittedAt.localeCompare(b.sub.submittedAt));
    const firstAcc = sorted.findIndex(e => isAccepted(e.sub));
    return firstAcc >= 0 && firstAcc < sorted.length - 1;
  });
  const reapplyAfterReject = lists.filter(l => {
    const sorted = [...l].sort((a, b) => a.sub.submittedAt.localeCompare(b.sub.submittedAt));
    const firstRej = sorted.findIndex(e => e.sub.status === "rejected");
    return firstRej >= 0 && firstRej < sorted.length - 1;
  });
  const tiles: [number, string, string][] = [
    [multi.length, "Applied more than once", `of ${lists.length} people`],
    [programs.length, "Several programs", "applied to 2+ programs"],
    [cities.length, "Several cities", "applied in 2+ cities"],
    [returning.length, "Returning participants", "accepted, then applied again"],
    [reapplyAfterReject.length, "Tried again", "rejected, then applied again"],
  ];
  return (
    <div class="stats" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">
      {tiles.map(([n, label, sub]) => (
        <div class="stat" style="padding:4px 0">
          <span class="stat__num" style="font-size:1.6rem">{n}</span>
          <span class="stat__label">{label}</span>
          <span class="muted small">{sub}</span>
        </div>
      ))}
    </div>
  );
}
