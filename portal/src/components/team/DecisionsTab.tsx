// Batch decisions: after reviewing, see everyone of a stage side by side
// (study programs, universities, companies, scores), plan invite / accept /
// reject per applicant, check the composition of who you'd take, and then
// apply all planned decisions at once – the emails go out together.
import { useMemo, useState } from "preact/hooks";
import type { Application, PlannedDecision, Submission } from "../../lib/types";
import { applicantScore, applyPlannedDecisions, inviteBlocker, planDecision, useStore } from "../../lib/store";
import { fmtShort, STATUS_LABEL } from "../../lib/fields";
import { isDemoId } from "../../lib/demo";
import { act, Avatar, Modal, StatusChip } from "../ui/Ui";
import { fmtScore } from "./Review";

type Stage = "screening" | "final";

const PLAN_LABEL: Record<PlannedDecision, string> = { invite: "Invite", accept: "Accept", reject: "Reject" };
const PLAN_CHIP: Record<PlannedDecision, string> = { invite: "chip--purple", accept: "chip--green", reject: "chip--red" };

/** Which decisions are possible for applicants in this stage */
export function stageOptions(app: Application, stage: Stage): PlannedDecision[] {
  if (app.pipeline === "interview" && stage === "screening") return ["invite", "reject"];
  return ["accept", "reject"];
}

interface PastDecision { label: string; chip: string; at?: string; /** invited / accepted: part of the batch */ positive: boolean }

/** The decision already made for someone in this stage (null = still open or not in this stage) */
export function pastDecision(app: Application, stage: Stage, x: Submission): PastDecision | null {
  const at = (st: Submission["status"]) => [...x.history].reverse().find(h => h.status === st)?.at;
  const final = (): PastDecision | null =>
    x.status === "accepted" ? { label: "Accepted", chip: "chip--green", at: at("accepted"), positive: true }
    : x.status === "withdrawn" ? { label: STATUS_LABEL.withdrawn, chip: "chip--gray", at: at("withdrawn"), positive: false }
    : x.status === "rejected" ? { label: "Rejected", chip: "chip--red", at: at("rejected"), positive: false }
    : null;
  if (app.pipeline !== "interview") return final();
  const wasInvited = x.status === "invited" || !!x.slotId || x.history.some(h => h.status === "invited")
    || (x.status !== "rejected" && x.status !== "new");
  if (stage === "screening") {
    if (wasInvited) return { label: "Invited to interview", chip: "chip--purple", at: at("invited"), positive: true };
    return x.status === "rejected" ? { label: "Rejected", chip: "chip--red", at: at("rejected"), positive: false } : null;
  }
  return wasInvited ? final() : null;
}

export function DecisionsTab({ app, subs, onOpen }: {
  app: Application; subs: Submission[];
  /** Opens the profile next to the list; `order` = the list for previous / next */
  onOpen: (subId: string, order: string[]) => void;
}) {
  const people = useStore(s => s.people);
  const programs = useStore(s => s.studyPrograms);
  const [stage, setStage] = useState<Stage>(app.pipeline === "interview" && !subs.some(x => x.status === "new") ? "final" : "screening");
  const [sort, setSort] = useState<"score" | "name" | "plan">("score");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [view, setView] = useState<"planner" | "table">("planner");

  const inStage = (x: Submission) => (app.pipeline === "interview" ? (stage === "screening" ? x.status === "new" : x.status === "invited") : x.status === "new");
  const options = stageOptions(app, stage);
  const positive = options[0]!;   // invite or accept
  // Only the score of this stage: interview score after interviews, screening score after screening
  const scoreStage: "screening" | "interview" = stage === "final" && app.pipeline === "interview" ? "interview" : "screening";
  const scoreLabel = scoreStage === "interview" ? "Interview score" : "Screening score";
  const stageScore = (x: Submission) => applicantScore(app, x)[scoreStage];
  const person = (x: Submission) => people.find(p => p.id === x.personId)!;

  const rows = useMemo(() => subs.filter(inStage).sort((a, b) =>
    sort === "name" ? person(a).name.localeCompare(person(b).name)
    : sort === "plan" ? (a.plannedDecision ?? "z").localeCompare(b.plannedDecision ?? "z") || (stageScore(b) ?? -1) - (stageScore(a) ?? -1)
    : (stageScore(b) ?? -1) - (stageScore(a) ?? -1) || a.submittedAt.localeCompare(b.submittedAt)),
  [subs, people, stage, sort]);

  const decided = useMemo(() => subs.filter(x => !inStage(x) && pastDecision(app, stage, x))
    .sort((a, b) => person(a).name.localeCompare(person(b).name)), [subs, people, stage]);
  const decidedIn = (st: Stage) => subs.filter(x => !(app.pipeline === "interview" ? (st === "screening" ? x.status === "new" : x.status === "invited") : x.status === "new") && pastDecision(app, st, x)).length;

  const planned = rows.filter(x => x.plannedDecision && options.includes(x.plannedDecision));
  const count = (d: PlannedDecision) => rows.filter(x => x.plannedDecision === d).length;
  const open = rows.length - planned.length;
  const takers = rows.filter(x => x.plannedDecision === positive);
  const alreadyAccepted = subs.filter(x => x.status === "accepted").length;
  const fieldOf = (name: string) => programs.find(p => p.name === name)?.category ?? "Other";
  const blocker = positive === "invite" && count("invite") > 0 ? inviteBlocker(app) : null;

  const plan = (ids: string[], d: PlannedDecision | null) => act(() => planDecision(ids, d));
  const planTop = () => {
    const n = Math.max(0, Math.floor(Number(topN)));
    if (!n) return;
    // Ranking by score; applicants without a rating come last
    const ranked = [...rows].sort((a, b) => (stageScore(b) ?? -1) - (stageScore(a) ?? -1));
    const top = ranked.slice(0, n);
    const rest = ranked.slice(n).map(x => x.id);
    const unrated = top.filter(x => stageScore(x) === undefined).length;
    act(async () => { await planDecision(top.map(x => x.id), positive); await planDecision(rest, "reject"); },
      `Planned: top ${top.length} → ${PLAN_LABEL[positive]}, ${rest.length} → Reject${unrated ? ` (${unrated} of the top ${top.length} aren't rated yet)` : ""}`);
  };

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = rows.length > 0 && rows.every(r => selected.has(r.id));

  return (
    <div class="stack">
      {app.pipeline === "interview" && (
        <div class="row" style="gap:6px" role="group" aria-label="Stage">
          <button class={`chip-btn ${stage === "screening" ? "is-active" : ""}`} onClick={() => { setStage("screening"); setSelected(new Set()); }}>
            After screening: who to invite <span class="chip-btn__count">{subs.filter(x => x.status === "new").length}</span>
            {decidedIn("screening") > 0 && <span class="muted small"> · {decidedIn("screening")} decided</span>}
          </button>
          <button class={`chip-btn ${stage === "final" ? "is-active" : ""}`} onClick={() => { setStage("final"); setSelected(new Set()); }}>
            After interviews: final decision <span class="chip-btn__count">{subs.filter(x => x.status === "invited").length}</span>
            {decidedIn("final") > 0 && <span class="muted small"> · {decidedIn("final")} decided</span>}
          </button>
        </div>
      )}
      <p class="muted small">Plan a decision for everyone first: nothing changes for applicants until you press “Apply & send”. Then all decisions are applied and the emails go out together.</p>

      <div class="stats">
        {options.map(d => (
          <div class="card stat"><span class="stat__num">{count(d)}</span><span class="stat__label">Planned: {PLAN_LABEL[d]}</span></div>
        ))}
        <div class="card stat"><span class="stat__num">{open}</span><span class="stat__label">Not planned yet</span><span class="muted small">of {rows.length} in this stage</span></div>
        {app.spots ? (
          <div class="card stat">
            <span class="stat__num">{alreadyAccepted + (positive === "accept" ? count("accept") : 0)} / {app.spots}</span>
            <span class="stat__label">Spots</span>
            <span class="muted small">{alreadyAccepted} accepted so far{positive === "accept" ? ` + ${count("accept")} planned` : ""}</span>
          </div>
        ) : <div class="card stat"><span class="stat__num">{fmtScore(avg(takers.map(stageScore)))}</span><span class="stat__label">Avg. {scoreLabel.toLowerCase()} of planned “{PLAN_LABEL[positive]}”</span></div>}
      </div>

      <div class="row" style="gap:6px" role="group" aria-label="View">
        <button class={`chip-btn ${view === "planner" ? "is-active" : ""}`} onClick={() => setView("planner")}>Batch planner</button>
        <button class={`chip-btn ${view === "table" ? "is-active" : ""}`} onClick={() => setView("table")}>Table</button>
      </div>

      {view === "planner" ? (
        <BatchPlanner rows={rows} fixed={decided.filter(x => pastDecision(app, stage, x)!.positive)} decided={decided} positive={positive} person={person} score={stageScore} fieldOf={fieldOf} scoreLabel={scoreLabel} onOpen={id => onOpen(id, rows.map(r => r.id))}
          onPlan={(ids, d) => plan(ids, d)} spots={app.spots ? Math.max(0, app.spots - alreadyAccepted) : undefined} />
      ) : <>
      {takers.length > 0 && (
        <section class="card stack-s">
          <h3>Who you'd {positive === "invite" ? "invite" : "accept"} ({takers.length})</h3>
          <div class="grid-3" style="gap:20px">
            <Breakdown title="Field of study" values={takers.flatMap(x => [...new Set(person(x).studyPrograms.map(fieldOf))])} total={takers.length} />
            <Breakdown title="University" values={takers.flatMap(x => person(x).universities)} total={takers.length} />
            <Breakdown title="Degree level" values={takers.map(x => person(x).degree ?? "Not given")} total={takers.length} />
          </div>
        </section>
      )}

      <div class="row">
        <select class="input input--sm" style="width:auto" value={sort} onChange={e => setSort(e.currentTarget.value as typeof sort)} aria-label="Sort">
          <option value="score">Highest score first</option><option value="plan">By planned decision</option><option value="name">Name A–Z</option>
        </select>
        <span class="spacer" />
        <span class="row small" style="gap:6px">
          Top
          <input class="input input--sm" style="width:70px" type="number" min={1} value={topN} onInput={e => setTopN(e.currentTarget.value)} aria-label="Number of top applicants" />
          → {PLAN_LABEL[positive]}, rest → Reject
          <button class="btn btn--secondary btn--sm" disabled={!Number(topN) || !rows.length} onClick={planTop}>Plan</button>
        </span>
      </div>

      {rows.length === 0
        ? <div class="empty">Nobody in this stage{app.pipeline === "interview" && stage === "final" ? " yet. Invited applicants appear here after the screening decisions" : ""}.</div>
        : (
          <div class="card card--flush">
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th style="width:36px"><input type="checkbox" aria-label="Select all" checked={allSel} onChange={() => setSelected(allSel ? new Set() : new Set(rows.map(r => r.id)))} /></th>
                    <th>#</th><th>Applicant</th><th>Study</th><th>Companies</th><th>{scoreLabel}</th><th>Planned decision</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x, i) => {
                    const p = person(x);
                    const sc = stageScore(x);
                    const sheets = x.scoreSheets.filter(y => y.stage === (stage === "final" && app.pipeline === "interview" ? "interview" : "screening")).length;
                    return (
                      <tr class={selected.has(x.id) ? "is-selected" : ""}>
                        <td><input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(x.id)} onChange={() => toggle(x.id)} /></td>
                        <td class="muted small">{i + 1}</td>
                        <td><button class="link-btn cell-person" onClick={() => onOpen(x.id, rows.map(r => r.id))}><Avatar name={p.name} /><div><strong>{p.name}</strong><span class="muted small">{p.semester && /^\d/.test(p.semester) ? `${p.semester}. sem. · ` : ""}{p.degree ?? ""}</span></div></button></td>
                        <td><span style="color:var(--color-text-heading)">{p.studyPrograms.join(", ") || "–"}</span><br /><span class="muted small">{p.universities.join(", ")}</span></td>
                        <td class="small">{p.companies.length ? <>{p.companies[0]!.company}{p.companies.length > 1 && <span class="muted"> +{p.companies.length - 1}</span>}</> : <span class="muted">–</span>}</td>
                        <td>{sc !== undefined ? <span class="score-pill">{fmtScore(sc)}<small>({sheets})</small></span> : <span class="muted small">not rated</span>}</td>
                        <td>
                          <div class="seg" role="group" aria-label={`Decision for ${p.name}`}>
                            {options.map(d => (
                              <button type="button" class={`seg__btn seg__btn--${d} ${x.plannedDecision === d ? "is-on" : ""}`}
                                onClick={() => plan([x.id], x.plannedDecision === d ? null : d)}>{PLAN_LABEL[d]}</button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>}

      {decided.length > 0 && (
        <section class="card card--flush">
          <div class="card__head" style="padding:20px 24px 0">
            <h2>Already decided <span class="muted small">({decided.length})</span></h2>
            <span class="muted small">earlier decisions in this stage</span>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Applicant</th><th>Study</th><th>{scoreLabel}</th><th>Decision</th><th>Now</th></tr></thead>
              <tbody>
                {decided.map(x => {
                  const p = person(x);
                  const d = pastDecision(app, stage, x)!;
                  const sc = stageScore(x);
                  return (
                    <tr>
                      <td><button class="link-btn cell-person" onClick={() => onOpen(x.id, decided.map(r => r.id))}><Avatar name={p.name} /><strong>{p.name}</strong></button></td>
                      <td><span style="color:var(--color-text-heading)">{p.studyPrograms.join(", ") || "–"}</span><br /><span class="muted small">{p.universities.join(", ")}</span></td>
                      <td>{sc !== undefined ? <span class="score-pill">{fmtScore(sc)}</span> : <span class="muted small">not rated</span>}</td>
                      <td><span class={`chip ${d.chip}`}>{d.label}</span>{d.at && <span class="muted small"> {fmtShort(d.at)}</span>}</td>
                      <td><StatusChip status={x.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected.size > 0 && (
        <div class="bulkbar" role="toolbar" aria-label="Plan for selected">
          <strong>{selected.size} selected</strong>
          {options.map(d => <button class="btn btn--secondary btn--sm" onClick={() => plan([...selected], d).then(() => setSelected(new Set()))}>Plan: {PLAN_LABEL[d]}</button>)}
          <button class="btn btn--ghost btn--sm" onClick={() => plan([...selected], null).then(() => setSelected(new Set()))}>Clear plan</button>
          <button class="btn btn--ghost btn--sm" onClick={() => setSelected(new Set())}>Cancel</button>
        </div>
      )}

      {selected.size === 0 && planned.length > 0 && (
        <div class="bulkbar" role="toolbar" aria-label="Apply decisions">
          <strong>{planned.length} decision{planned.length > 1 ? "s" : ""} planned</strong>
          <span class="small" style="opacity:.85">{options.map(d => `${count(d)} ${PLAN_LABEL[d].toLowerCase()}`).join(" · ")}{open ? ` · ${open} still open` : ""}</span>
          <button class="btn btn--primary btn--sm" onClick={() => setConfirm(true)}>Apply & send…</button>
        </div>
      )}

      {confirm && <ApplyModal app={app} planned={planned} options={options} blocker={blocker} onClose={() => setConfirm(false)} />}
    </div>
  );
}

const avg = (v: (number | undefined)[]) => { const n = v.filter((x): x is number => x !== undefined); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : undefined; };

/** Share of the planned group per value, e.g. study fields */
function Breakdown({ title, values, total }: { title: string; values: string[]; total: number }) {
  const counts = [...values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const shown = counts.slice(0, 6);
  return (
    <div class="stack-s">
      <span class="overline">{title}</span>
      {shown.map(([k, n]) => (
        <div class="breakdown">
          <span class="breakdown__label" title={k}>{k}</span>
          <span class="breakdown__bar"><span style={`width:${Math.round((n / total) * 100)}%`} /></span>
          <span class="breakdown__num">{n}</span>
        </div>
      ))}
      {counts.length > shown.length && <span class="muted small">+{counts.length - shown.length} more</span>}
    </div>
  );
}

function ApplyModal({ app, planned, options, blocker, onClose }: {
  app: Application; planned: Submission[]; options: PlannedDecision[]; blocker: string | null; onClose: () => void;
}) {
  const [send, setSend] = useState(true);
  const [busy, setBusy] = useState(false);
  const demo = planned.filter(x => isDemoId(x.id)).length;
  const real = planned.length - demo;
  const n = (d: PlannedDecision) => planned.filter(x => x.plannedDecision === d && !isDemoId(x.id)).length;
  const mail: Record<PlannedDecision, string> = { invite: "interview invitation", accept: "acceptance email", reject: "rejection email" };

  return (
    <Modal title="Apply decisions and send emails" onClose={onClose}>
      <div class="stack">
        <ul class="stack-s" style="margin:0;padding-left:18px">
          {options.filter(d => n(d)).map(d => <li><strong>{n(d)}</strong> × {STATUS_LABEL[d === "invite" ? "invited" : d === "accept" ? "accepted" : "rejected"]}{send ? ` – ${mail[d]}` : ""}</li>)}
        </ul>
        {demo > 0 && <p class="muted small">{demo} demo applicant{demo > 1 ? "s are" : " is"} left out (made up, only in this browser).</p>}
        {blocker && <p class="small field__error">Invitations are blocked: {blocker}</p>}
        <label class="row small" style="gap:8px"><input type="checkbox" checked={send} onChange={e => setSend(e.currentTarget.checked)} />Send the emails (uses the texts under “Emails”)</label>
        {send && real > 0 && <p class="muted small">Emails are sent right away; above the daily limit the rest goes out the next day.</p>}
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button class="btn btn--primary" disabled={busy || !real || !!blocker} onClick={async () => {
            setBusy(true);
            const r = await act(() => applyPlannedDecisions(planned, send),
              x => `${x.applied} decision${x.applied === 1 ? "" : "s"} applied${send ? (x.skipped ? ` · emails not sent yet: ${x.skipped}` : ` · ${x.sent ?? 0} emails sent${x.failed ? `, ${x.failed} failed` : ""}`) : ""}`);
            setBusy(false);
            if (r) onClose();
          }}>{busy ? "Applying…" : `Apply ${real} decision${real === 1 ? "" : "s"}`}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── Batch planner ────────────────────────────────────────────────────────

/** Semester ranges for the composition */
const semGroup = (sem?: string) => !sem || !/^\d/.test(sem) ? "Not applicable / not given" : Number(sem) <= 3 ? "1st–3rd semester" : Number(sem) <= 6 ? "4th–6th semester" : Number(sem) <= 9 ? "7th–9th semester" : "10th semester or later";

/**
 * Put people into the batch (= planned invite / accept) or take them out, and
 * see live how the batch is composed compared with all applicants of the stage.
 */
function BatchPlanner({ rows, fixed, decided, positive, person, score, scoreLabel, fieldOf, onOpen, onPlan, spots }: {
  rows: Submission[];
  /** Already invited / accepted in this stage: part of the batch, can't be planned any more */
  fixed: Submission[];
  /** Everyone already decided in this stage (part of the pool) */
  decided: Submission[];
  positive: PlannedDecision;
  person: (x: Submission) => { name: string; studyPrograms: string[]; universities: string[]; degree?: string; semester?: string; companies: { company: string }[] };
  score: (x: Submission) => number | undefined; scoreLabel: string; fieldOf: (name: string) => string;
  onOpen: (id: string) => void; onPlan: (ids: string[], d: PlannedDecision | null) => Promise<unknown>; spots?: number;
}) {
  const [q, setQ] = useState("");
  const [topN, setTopN] = useState("");
  const inBatch = rows.filter(x => x.plannedDecision === positive);
  const out = rows.filter(x => x.plannedDecision !== positive);
  // Whole batch = already decided + planned now; pool = everyone of this stage, decided or not
  const batch = [...fixed, ...inBatch];
  const pool = [...rows, ...decided];
  const ql = q.trim().toLowerCase();
  const match = (x: Submission) => { const p = person(x); return !ql || `${p.name} ${p.studyPrograms.join(" ")} ${p.universities.join(" ")}`.toLowerCase().includes(ql); };
  const byScore = (a: Submission, b: Submission) => (score(b) ?? -1) - (score(a) ?? -1);
  const verb = positive === "invite" ? "invite" : "accept";
  // Rated candidates, best first (unrated ones are never added automatically)
  const ranked = out.filter(x => score(x) !== undefined).sort(byScore);
  const addTop = (n: number) => {
    const pick = ranked.slice(0, Math.max(0, n));
    if (pick.length) onPlan(pick.map(x => x.id), positive);
  };

  // Values per person for each dimension (a person can count in several, e.g. two study programs)
  const dims: { title: string; of: (x: Submission) => string[] }[] = [
    { title: "Field of study", of: x => [...new Set(person(x).studyPrograms.map(fieldOf))] },
    { title: "Study program", of: x => person(x).studyPrograms },
    { title: "University", of: x => person(x).universities },
    { title: "Degree level", of: x => [person(x).degree ?? "Not given"] },
    { title: "Semester", of: x => [semGroup(person(x).semester)] },
    { title: "Work experience", of: x => [person(x).companies.length ? "Worked at a company" : "No company yet"] },
  ];

  const item = (x: Submission, add: boolean) => {
    const p = person(x);
    const sc = score(x);
    return (
      <div class="planner__item">
        <button class="link-btn planner__who" onClick={() => onOpen(x.id)} title="Open profile">
          <strong>{p.name}</strong>
          <span class="muted small">{[p.studyPrograms[0], p.universities[0], p.degree].filter(Boolean).join(" · ")}</span>
        </button>
        <span class="score-pill" title={scoreLabel}>{sc !== undefined ? fmtScore(sc) : <small>–</small>}</span>
        {!add && x.plannedDecision === "reject" && <span class="chip chip--red">Reject</span>}
        <button class={`icon-btn planner__move ${add ? "planner__move--add" : ""}`} aria-label={add ? `Add ${p.name} to the batch` : `Take ${p.name} out of the batch`}
          title={add ? "Add to the batch" : "Take out"} onClick={() => onPlan([x.id], add ? positive : null)}>{add ? "+" : "×"}</button>
      </div>
    );
  };

  return (
    <div class="stack">
      <section class="card stack">
        <div class="row row--between">
          <h3>Batch composition</h3>
          <span class="small">
            <strong>{batch.length}</strong> in the batch{fixed.length ? <span class="muted"> ({fixed.length} decided + {inBatch.length} planned)</span> : ""}
            {spots !== undefined && positive === "accept" ? ` · ${Math.max(0, spots - inBatch.length)} of ${spots} free spot${spots === 1 ? "" : "s"} left` : ""}
            {" · "}avg. {scoreLabel.toLowerCase()} <strong>{fmtScore(avg(batch.map(score)))}</strong> <span class="muted">(all: {fmtScore(avg(pool.map(score)))})</span>
          </span>
        </div>
        {spots !== undefined && inBatch.length > spots && positive === "accept" && <p class="small field__error">{inBatch.length - spots} more than the free spots.</p>}
        <div class="row" style="gap:8px">
          {positive === "accept" && spots !== undefined && spots - inBatch.length > 0 && (
            <button class="btn btn--primary btn--sm" disabled={inBatch.length >= spots || !ranked.length}
              title="Adds the highest-scored candidates until all free spots are taken (unrated ones are skipped)"
              onClick={() => addTop(spots - inBatch.length)}>
              Fill {Math.max(0, spots - inBatch.length)} free spot{spots - inBatch.length === 1 ? "" : "s"} with the top scores
            </button>
          )}
          <span class="row small" style="gap:6px">
            Add top
            <input class="input input--sm" style="width:64px" type="number" min={1} value={topN} onInput={e => setTopN(e.currentTarget.value)} aria-label="Number of top candidates to add" />
            by score
            <button class="btn btn--secondary btn--sm" disabled={!Number(topN) || !ranked.length} onClick={() => addTop(Math.floor(Number(topN)))}>Add</button>
          </span>
        </div>
        <p class="muted small composition__legend">
          Bars: share in the whole batch
          {fixed.length > 0 && <> · <span class="composition__key composition__key--fixed" /> already decided · <span class="composition__key composition__key--planned" /> planned now</>}
          . The line marks the share among all {pool.length} applicants of this stage.
        </p>
        <div class="grid-3" style="gap:22px">
          {dims.map(d => <Composition title={d.title} fixed={fixed.flatMap(d.of)} planned={inBatch.flatMap(d.of)} pool={pool.flatMap(d.of)} batchSize={batch.length} poolSize={pool.length} />)}
        </div>
      </section>

      <div class="planner">
        <section class="card stack-s planner__col">
          <div class="row row--between">
            <h3>In the batch ({inBatch.length})</h3>
            {inBatch.length > 0 && <button class="btn btn--ghost btn--sm" onClick={() => onPlan(inBatch.map(x => x.id), null)}>Empty</button>}
          </div>
          <p class="muted small">Planned to {verb}.</p>
          <div class="planner__list">
            {inBatch.sort(byScore).map(x => item(x, false))}
            {inBatch.length === 0 && <p class="muted small">Nobody planned yet. Add candidates with +.</p>}
            {fixed.length > 0 && <>
              <p class="overline" style="margin-top:10px">Already {positive === "invite" ? "invited" : "accepted"} ({fixed.length})</p>
              {[...fixed].sort(byScore).map(x => {
                const p = person(x), sc = score(x);
                return (
                  <div class="planner__item planner__item--fixed">
                    <button class="link-btn planner__who" onClick={() => onOpen(x.id)} title="Open profile">
                      <strong>{p.name}</strong>
                      <span class="muted small">{[p.studyPrograms[0], p.universities[0], p.degree].filter(Boolean).join(" · ")}</span>
                    </button>
                    <span class="score-pill" title={scoreLabel}>{sc !== undefined ? fmtScore(sc) : <small>–</small>}</span>
                    <span class="chip chip--outline" title="Decision already applied">Decided</span>
                  </div>
                );
              })}
            </>}
          </div>
        </section>
        <section class="card stack-s planner__col">
          <div class="row row--between">
            <h3>Candidates ({out.length})</h3>
            {out.some(x => x.plannedDecision !== "reject") && (
              <button class="btn btn--ghost btn--sm" title="Plans a rejection for everyone not in the batch"
                onClick={() => onPlan(out.filter(x => x.plannedDecision !== "reject").map(x => x.id), "reject")}>Rest → Reject</button>
            )}
          </div>
          <input class="input input--sm" placeholder="Search name, study program, university…" value={q} onInput={e => setQ(e.currentTarget.value)} aria-label="Search candidates" />
          <div class="planner__list">
            {out.filter(match).sort(byScore).map(x => item(x, true))}
            {out.length === 0 && <p class="muted small">Everyone of this stage is in the batch.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Share per value in the whole batch (decided + planned) vs. among all applicants of the stage */
function Composition({ title, fixed, planned, pool, batchSize, poolSize }: {
  title: string; fixed: string[]; planned: string[]; pool: string[]; batchSize: number; poolSize: number;
}) {
  const count = (list: string[]) => list.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>());
  const f = count(fixed), pl = count(planned), p = count(pool);
  const b = count([...fixed, ...planned]);
  const keys = [...p.keys()].sort((x, y) => (b.get(y) ?? 0) - (b.get(x) ?? 0) || (p.get(y) ?? 0) - (p.get(x) ?? 0));
  const shown = keys.slice(0, 6);
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);
  return (
    <div class="stack-s">
      <span class="overline">{title}</span>
      {shown.map(k => {
        const bn = b.get(k) ?? 0, pn = p.get(k) ?? 0, fn = f.get(k) ?? 0, ln = pl.get(k) ?? 0;
        return (
          <div class="composition" title={`${k}: ${bn} in the batch (${pct(bn, batchSize)}%${fn ? `; ${fn} decided, ${ln} planned` : ""}), ${pn} of all (${pct(pn, poolSize)}%)`}>
            <span class="breakdown__label">{k}</span>
            <span class="composition__bar">
              <span class="composition__fills">
                <span class="composition__fill" style={`width:${batchSize ? (fn / batchSize) * 100 : 0}%`} />
                <span class="composition__fill composition__fill--planned" style={`width:${batchSize ? (ln / batchSize) * 100 : 0}%`} />
              </span>
              <span class="composition__pool" style={`left:${pct(pn, poolSize)}%`} />
            </span>
            <span class="breakdown__num">{bn}<span class="muted">/{pn}</span></span>
          </div>
        );
      })}
      {keys.length > shown.length && <span class="muted small">+{keys.length - shown.length} more</span>}
    </div>
  );
}
