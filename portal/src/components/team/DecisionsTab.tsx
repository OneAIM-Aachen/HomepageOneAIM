// Batch decisions: after reviewing, see everyone of a stage side by side
// (study programs, universities, companies, scores), plan invite / accept /
// reject per applicant, check the composition of who you'd take, and then
// apply all planned decisions at once – the emails go out together.
import { useMemo, useState } from "preact/hooks";
import type { Application, PlannedDecision, Submission } from "../../lib/types";
import { applicantScore, applyPlannedDecisions, inviteBlocker, planDecision, useStore } from "../../lib/store";
import { STATUS_LABEL } from "../../lib/fields";
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

export function DecisionsTab({ app, subs, onOpen }: { app: Application; subs: Submission[]; onOpen: (subId: string) => void }) {
  const people = useStore(s => s.people);
  const programs = useStore(s => s.studyPrograms);
  const [stage, setStage] = useState<Stage>(app.pipeline === "interview" && !subs.some(x => x.status === "new") ? "final" : "screening");
  const [sort, setSort] = useState<"score" | "name" | "plan">("score");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState("");
  const [confirm, setConfirm] = useState(false);

  const inStage = (x: Submission) => (app.pipeline === "interview" ? (stage === "screening" ? x.status === "new" : x.status === "invited") : x.status === "new");
  const options = stageOptions(app, stage);
  const positive = options[0]!;   // invite or accept
  const stageScore = (x: Submission) => {
    const sc = applicantScore(app, x);
    return stage === "final" && app.pipeline === "interview" ? sc.interview ?? sc.screening : sc.screening;
  };
  const person = (x: Submission) => people.find(p => p.id === x.personId)!;

  const rows = useMemo(() => subs.filter(inStage).sort((a, b) =>
    sort === "name" ? person(a).name.localeCompare(person(b).name)
    : sort === "plan" ? (a.plannedDecision ?? "z").localeCompare(b.plannedDecision ?? "z") || (stageScore(b) ?? -1) - (stageScore(a) ?? -1)
    : (stageScore(b) ?? -1) - (stageScore(a) ?? -1) || a.submittedAt.localeCompare(b.submittedAt)),
  [subs, people, stage, sort]);

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
          </button>
          <button class={`chip-btn ${stage === "final" ? "is-active" : ""}`} onClick={() => { setStage("final"); setSelected(new Set()); }}>
            After interviews: final decision <span class="chip-btn__count">{subs.filter(x => x.status === "invited").length}</span>
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
        ) : <div class="card stat"><span class="stat__num">{fmtScore(avg(takers.map(stageScore)))}</span><span class="stat__label">Avg. score of planned “{PLAN_LABEL[positive]}”</span></div>}
      </div>

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
                    <th>#</th><th>Applicant</th><th>Study</th><th>Companies</th><th>Score</th><th>Planned decision</th>
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
                        <td><button class="link-btn cell-person" onClick={() => onOpen(x.id)}><Avatar name={p.name} /><div><strong>{p.name}</strong><span class="muted small">{p.semester && /^\d/.test(p.semester) ? `${p.semester}. sem. · ` : ""}{p.degree ?? ""}</span></div></button></td>
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
