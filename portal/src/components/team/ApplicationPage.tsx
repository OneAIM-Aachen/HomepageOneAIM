import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Account, Application, PlannedDecision, ReviewStage, Scorecard, Slot, Submission, SubmissionStatus, TemplateKey } from "../../lib/types";
import {
  addComment, addSlots, decide, deleteApplication, inviteBlocker, removeSlot, renderTemplate, saveApplication,
  sendInterviewDetails, slotComplete, slotIsPast, slotTaken, updateSlot, uploadImage, useStore, type Decision,
  formOptionsFromState, getState, applicantScore, planDecision, assignReviewers, unassignReviewer, setInterviewers, saveScoreSheet,
  deleteScoreSheet, sheetScore,
} from "../../lib/store";
import { DecisionsTab } from "./DecisionsTab";
import { AddMember, fmtScore, MemberChips, ScorecardEditor, scorecardValid, ScoreSheetForm, STAGE_LABEL } from "./Review";
import {
  appPhase, appTitle, CURRENCIES, feeValue, fmtDate, parseFee, fmtShort, fmtSlot, KINDS, PIPELINES, PLACEHOLDER_ONLY, PLACEHOLDERS, STATUS_LABEL, TEMPLATE_LABEL,
  templatesFor,
} from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { FormBuilder } from "./FormBuilder";
import { Answers } from "./Answers";
import { act, Avatar, confirmDialog, Drawer, Field, Modal, PhaseChip, StatusChip, toast, useParam } from "../ui/Ui";
import { FormRenderer } from "../apply/FormRenderer";
import { isDemoId } from "../../lib/demo";
import { IconCalendar, IconExternal, IconPlus, IconSearch, IconTrash, IconX } from "../ui/Icons";

type Tab = "applicants" | "decisions" | "setup" | "form" | "scorecards" | "emails" | "slots";

export default function ApplicationPage() {
  const id = useParam("id");
  const tab = useParam("tab") as Tab | null;
  const openSub = useParam("s");
  const created = useParam("created") === "1";
  return (
    <TeamShell active="applications">
      {acc => <Detail acc={acc} id={id ?? ""} initialTab={tab ?? "applicants"} openSub={openSub} created={created} />}
    </TeamShell>
  );
}

function Detail({ acc, id, initialTab, openSub, created }: {
  acc: Account; id: string; initialTab: Tab; openSub: string | null; created: boolean;
}) {
  const app = useStore(s => s.applications.find(a => a.id === id));
  const subs = useStore(s => s.submissions.filter(x => x.applicationId === id));
  const [tab, setTab] = useState<Tab>(initialTab);
  const [preview, setPreview] = useState(false);
  const [openFromDecisions, setOpenFromDecisions] = useState<string | null>(null);

  if (!app) return <div class="empty">This application does not exist. <a href="/team/applications">Back to applications</a></div>;

  const phase = appPhase(app);
  const publicUrl = `/apply/form?a=${app.slug}`;
  const tabs: [Tab, string, number?][] = [
    ["applicants", "Applicants", subs.length],
    ...(app.pipeline !== "instant" ? [["decisions", "Decisions", subs.filter(x => x.plannedDecision).length || undefined] as [Tab, string, number?]] : []),
    ["setup", "Setup & dates"],
    ["form", "Form", app.fields.length],
    ...(app.pipeline !== "instant" ? [["scorecards", "Scorecards", Object.keys(app.scorecards).length] as [Tab, string, number]] : []),
    ["emails", "Emails"],
    ...(app.pipeline === "interview" ? [["slots", "Interview slots", app.slots.length] as [Tab, string, number]] : []),
  ];

  return (
    <div class="stack" style="gap:18px">
      <PageHead crumbs={[{ label: "Applications", href: "/team/applications" }, { label: appTitle(app) }]}
        title={appTitle(app)}
        actions={<>
          <button class="btn btn--secondary" onClick={() => setPreview(true)}>Preview form</button>
          <button class="btn btn--secondary" onClick={() => { navigator.clipboard?.writeText(`https://apply.one-aim.org/${app.slug}`); toast("Public link copied"); }}>Copy link</button>
          {app.published && phase !== "closed" &&
            <a class="btn btn--secondary" href={publicUrl} target="_blank" rel="noopener"><IconExternal width={16} />Open public form</a>}
        </>} />

      <div class="row" style="margin-top:-12px">
        <PhaseChip phase={phase} />
        <span class="chip chip--outline">{app.tags.program}</span>
        <span class="chip chip--outline">{app.tags.location}</span>
        <span class="chip chip--outline">{app.tags.semester}</span>
        <span class="steps" title={PIPELINES[app.pipeline].description}>
          {PIPELINES[app.pipeline].steps.map((st, i) => <>{i > 0 && <i>→</i>}<span>{st}</span></>)}
        </span>
        <span class="muted small">Created by {app.createdBy} · from blueprint “{app.blueprintName}”</span>
      </div>

      {created && (
        <div class="card card--tint row">
          <span style="flex:1"><strong>Application created as a draft.</strong> Check dates, form and emails, then publish it under Setup. It goes live on one-aim.org on the opening date.</span>
        </div>
      )}

      <nav class="tabs" role="tablist">
        {tabs.map(([k, label, n]) => (
          <button role="tab" aria-selected={tab === k} class={`tab ${tab === k ? "is-active" : ""}`} onClick={() => setTab(k)}>
            {label}{n !== undefined && <span class="count">{n}</span>}
          </button>
        ))}
      </nav>

      {tab === "applicants" && <Applicants acc={acc} app={app} subs={subs} openSub={openSub ?? openFromDecisions} />}
      {tab === "decisions" && <DecisionsTab app={app} subs={subs} onOpen={id => { setOpenFromDecisions(id); setTab("applicants"); }} />}
      {tab === "setup" && <Setup app={app} hasSubs={subs.length > 0} />}
      {tab === "form" && <FormTab app={app} hasSubs={subs.length > 0} />}
      {tab === "scorecards" && <ScorecardsTab app={app} />}
      {tab === "emails" && <Emails app={app} />}
      {tab === "slots" && <Slots app={app} subs={subs} />}

      {preview && (
        <Modal title="Form preview" onClose={() => setPreview(false)} wide>
          <FormRenderer fields={app.fields} preview options={formOptionsFromState(getState())} />
        </Modal>
      )}
    </div>
  );
}

// ── Applicants ───────────────────────────────────────────────────────────

const DECISION_TEXT: Record<Decision, { verb: string; mail?: TemplateKey; btn: string }> = {
  invite: { verb: "Invite to interview", mail: "invite", btn: "btn--secondary" },
  accept: { verb: "Accept", mail: "acceptance", btn: "btn--success" },
  reject: { verb: "Reject", mail: "rejection", btn: "btn--danger" },
  reset: { verb: "Move back to New", btn: "btn--ghost" },
};

function decisionsFor(app: Application, status: SubmissionStatus): Decision[] {
  if (app.pipeline === "instant") return [];
  if (app.pipeline === "screening") return status === "new" ? ["accept", "reject"] : ["reset"];
  if (status === "new") return ["invite", "reject"];
  if (status === "invited") return ["accept", "reject"];
  return ["reset"];
}

function Applicants({ acc, app, subs, openSub }: { acc: Account; app: Application; subs: Submission[]; openSub: string | null }) {
  const people = useStore(s => s.people);
  const [status, setStatus] = useState<SubmissionStatus | "all">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"date" | "score" | "name">("date");
  const [mine, setMine] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(openSub);
  const [confirm, setConfirm] = useState<{ ids: string[]; decision: Decision } | null>(null);

  const person = (x: Submission) => people.find(p => p.id === x.personId)!;
  const statuses: SubmissionStatus[] = app.pipeline === "instant" ? ["confirmed"]
    : app.pipeline === "screening" ? ["new", "accepted", "rejected"] : ["new", "invited", "accepted", "rejected"];

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    return subs
      .filter(x => status === "all" || x.status === status)
      .filter(x => !mine || (!!acc.memberId && (x.reviewerIds.includes(acc.memberId)
        || !!app.slots.find(s => s.id === x.slotId)?.interviewerIds.includes(acc.memberId))))
      .filter(x => { const p = person(x); return !ql || `${p.name} ${p.email} ${p.universities.join(" ")} ${p.studyPrograms.join(" ")}`.toLowerCase().includes(ql); })
      .sort((a, b) =>
        sort === "score" ? (applicantScore(app, b).overall ?? 0) - (applicantScore(app, a).overall ?? 0)
        : sort === "name" ? person(a).name.localeCompare(person(b).name)
        : b.submittedAt.localeCompare(a.submittedAt));
  }, [subs, people, status, q, sort, mine]);

  const toggle = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = rows.length > 0 && rows.every(r => selected.has(r.id));
  const selSubs = subs.filter(x => selected.has(x.id));
  // Bulk actions: only decisions valid for every selected applicant
  const bulk = (["invite", "accept", "reject", "reset"] as Decision[]).filter(d => selSubs.length && selSubs.every(x => decisionsFor(app, x.status).includes(d)));
  const accepted = subs.filter(x => x.status === "accepted" || x.status === "confirmed").length;
  const openSubObj = subs.find(x => x.id === open);

  return (
    <div class="stack">
      <div class="row">
        {(["all", ...statuses] as const).map(st => (
          <button class={`chip-btn ${status === st ? "is-active" : ""}`} onClick={() => setStatus(st)}>
            {st === "all" ? "All" : STATUS_LABEL[st]}
            <span style="opacity:.7;margin-left:6px">{st === "all" ? subs.length : subs.filter(x => x.status === st).length}</span>
          </button>
        ))}
        <span class="spacer" />
        {acc.memberId && (
          <button class={`chip-btn ${mine ? "is-active" : ""}`} onClick={() => setMine(!mine)} title="Applicants you review or interview">
            Assigned to me <span style="opacity:.7;margin-left:6px">{subs.filter(x => x.reviewerIds.includes(acc.memberId!) || !!app.slots.find(s => s.id === x.slotId)?.interviewerIds.includes(acc.memberId!)).length}</span>
          </button>
        )}
        {app.spots && <span class="chip chip--green">{accepted} / {app.spots} spots filled</span>}
      </div>

      <div class="row">
        <div style="position:relative;flex:1;min-width:220px">
          <IconSearch width={17} style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-text-muted)" />
          <input class="input input--sm" style="padding-left:36px" placeholder="Search name, email, university, study program…" value={q} onInput={e => setQ(e.currentTarget.value)} aria-label="Search applicants" />
        </div>
        <select class="input input--sm" style="width:auto" value={sort} onChange={e => setSort(e.currentTarget.value as typeof sort)} aria-label="Sort">
          <option value="date">Newest first</option><option value="score">Highest score</option><option value="name">Name A–Z</option>
        </select>
      </div>

      {subs.length === 0
        ? <div class="empty">No applicants yet. Share the <a href={`/apply/form?a=${app.id}`} target="_blank" rel="noopener">application form</a> to get started.</div>
        : (
          <div class="card card--flush">
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th style="width:36px"><input type="checkbox" aria-label="Select all" checked={allSel}
                      onChange={() => setSelected(allSel ? new Set() : new Set(rows.map(r => r.id)))} /></th>
                    <th>Applicant</th><th>Study</th><th>Status</th>{app.pipeline !== "instant" && <><th>Score</th><th>Reviewers</th></>}
                    {app.pipeline === "interview" && <th>Interview</th>}
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(x => {
                    const p = person(x);
                    const slot = app.slots.find(s => s.id === x.slotId);
                    return (
                      <tr class={`is-clickable ${selected.has(x.id) ? "is-selected" : ""}`} onClick={() => setOpen(x.id)}>
                        <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${p.name}`} disabled={isDemoId(x.id)} checked={selected.has(x.id)} onChange={() => toggle(x.id)} /></td>
                        <td><div class="cell-person"><Avatar name={p.name} /><div><strong>{p.name}</strong><span class="muted small">{p.email}</span></div></div></td>
                        <td><span style="color:var(--color-text-heading)">{p.studyPrograms.join(", ") || "–"}</span><br /><span class="muted small">{p.universities.join(", ")}{p.semester && /^\d/.test(p.semester) ? ` · ${p.semester}. sem.` : ""}{p.degree ? ` · ${p.degree}` : ""}</span></td>
                        <td><StatusChip status={x.status} />{x.plannedDecision && <div style="margin-top:4px"><span class={`chip ${x.plannedDecision === "accept" ? "chip--green" : x.plannedDecision === "reject" ? "chip--red" : "chip--purple"}`} title={`Planned by ${x.plannedBy ?? "?"}, not sent yet`}>Planned: {DECISION_TEXT[x.plannedDecision].verb}</span></div>}</td>
                        {app.pipeline !== "instant" && <>
                          <td>{applicantScore(app, x).sheets ? <ScoreCell app={app} sub={x} /> : <span class="muted small">Not rated</span>}</td>
                          <td><ReviewerAvatars ids={x.reviewerIds} /></td>
                        </>}
                        {app.pipeline === "interview" && (
                          <td class="small">{slot ? fmtSlot(slot.start) : x.status === "invited" ? <span class="chip chip--amber">No slot yet</span> : <span class="muted">–</span>}</td>
                        )}
                        <td class="muted small">{fmtShort(x.submittedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {selected.size > 0 && (
        <div class="bulkbar" role="toolbar" aria-label="Bulk actions">
          <strong>{selected.size} selected</strong>
          {bulk.length === 0 && <span class="small" style="opacity:.8">Selected applicants are in different stages: no common action.</span>}
          {bulk.filter(d => d !== "reset").map(d => (
            <button class="btn btn--sm btn--secondary"
              onClick={() => act(() => planDecision([...selected], d as PlannedDecision), `Planned for ${selected.size}: ${DECISION_TEXT[d].verb}`).then(() => setSelected(new Set()))}>Plan: {DECISION_TEXT[d].verb}</button>
          ))}
          {bulk.includes("reset") && <button class="btn btn--sm btn--ghost" onClick={() => setConfirm({ ids: [...selected], decision: "reset" })}>{DECISION_TEXT.reset.verb}</button>}
          {selSubs.every(x => !isDemoId(x.id)) && (
            <AddMember label="Add reviewer…" exclude={[]} city={app.tags.location}
              onAdd={id => act(() => assignReviewers([...selected], [id]), `Reviewer assigned to ${selected.size} applicant${selected.size > 1 ? "s" : ""}`)} />
          )}
          <button class="btn btn--ghost btn--sm" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {openSubObj && !reviewing && (
        <ApplicantDrawer acc={acc} app={app} sub={openSubObj} onClose={() => setOpen(null)}
          onDecide={d => setConfirm({ ids: [openSubObj.id], decision: d })} onReview={() => setReviewing(openSubObj.id)} />
      )}

      {reviewing && (
        <ReviewSplit acc={acc} app={app} subId={reviewing} order={rows.map(x => x.id)}
          onNavigate={id => { setReviewing(id); setOpen(id); }} onClose={() => setReviewing(null)} />
      )}

      {confirm && (
        <ConfirmDecision acc={acc} app={app} subs={subs.filter(x => confirm.ids.includes(x.id))} decision={confirm.decision}
          onClose={() => setConfirm(null)} onDone={() => { setConfirm(null); setSelected(new Set()); }} />
      )}
    </div>
  );
}

function ConfirmDecision({ acc, app, subs, decision, onClose, onDone }: {
  acc: Account; app: Application; subs: Submission[]; decision: Decision; onClose: () => void; onDone: () => void;
}) {
  const people = useStore(s => s.people);
  const [send, setSend] = useState(true);
  const info = DECISION_TEXT[decision];
  const first = people.find(p => p.id === subs[0]!.personId)!;
  const tpl = info.mail ? app.templates[info.mail] : undefined;
  const blocker = decision === "invite" ? inviteBlocker(app) : null;

  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const n = await act(() => decide(subs.map(x => x.id), decision, acc.city, send), r => {
      const who = `${info.verb}: ${r.changed} applicant${r.changed === 1 ? "" : "s"}`;
      if (!send || !info.mail || r.changed === 0) return who;
      if (r.skipped) return `${who}. Emails not sent yet: ${r.skipped} (Settings → Emails)`;
      return `${who}, ${r.sent ?? 0} email${r.sent === 1 ? "" : "s"} sent${r.failed ? `, ${r.failed} failed (see Sent emails)` : ""}`;
    });
    if (n !== undefined) onDone(); else setBusy(false);
  };

  return (
    <Modal title={`${info.verb} ${subs.length === 1 ? first.name : `${subs.length} applicants`}?`} onClose={onClose} wide>
      {blocker && <div class="card small" style="background:var(--p-amber-tint);border-color:#F3D19C"><strong>Can't invite yet.</strong> {blocker}</div>}
      {tpl && (
        <>
          <label class="check"><input type="checkbox" checked={send} onChange={e => setSend(e.currentTarget.checked)} />
            <span><strong>Send the “{TEMPLATE_LABEL[info.mail!]}” email</strong> {subs.length > 1 ? `to all ${subs.length}` : ""}<span class="muted small"> · edit the text under the Emails tab</span></span>
          </label>
          {send && (
            <div class="mail">
              <div class="mail__head">
                <span><span class="muted">From:</span> OneAIM {app.tags.location} &lt;applications@one-aim.org&gt;</span>
                <span><span class="muted">To:</span> {first.name} &lt;{first.email}&gt;{subs.length > 1 ? ` and ${subs.length - 1} more` : ""}</span>
                <span><span class="muted">Subject:</span> <strong>{renderTemplate(tpl.subject, app, first, subs[0])}</strong></span>
              </div>
              <div class="mail__body">{renderTemplate(tpl.body, app, first, subs[0])}</div>
            </div>
          )}
        </>
      )}
      {!tpl && <p class="muted">No email is sent for this step.</p>}
      <div class="row" style="justify-content:flex-end">
        <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button class={`btn ${decision === "reject" ? "btn--danger" : decision === "accept" ? "btn--success" : "btn--primary"}`} disabled={busy || !!blocker} onClick={run}>
          {info.verb}{send && tpl ? " & send" : ""}
        </button>
      </div>
    </Modal>
  );
}

function ApplicantDrawer({ acc, app, sub, onClose, onDecide, onReview }: {
  acc: Account; app: Application; sub: Submission; onClose: () => void; onDecide: (d: Decision) => void; onReview: () => void;
}) {
  const person = useStore(s => s.people.find(p => p.id === sub.personId)!);
  const others = useStore(s => s.submissions.filter(x => x.personId === sub.personId && x.id !== sub.id).length);
  const slot = app.slots.find(s => s.id === sub.slotId);
  const decisions = decisionsFor(app, sub.status);

  return (
    <Drawer onClose={onClose}
      head={<div class="row" style="flex-wrap:nowrap">
        <Avatar name={person.name} large />
        <div style="min-width:0">
          <h2 style="font-size:1.25rem">{person.name}</h2>
          <div class="row" style="gap:6px;margin-top:4px"><StatusChip status={sub.status} /><span class="muted small">{person.email}</span></div>
        </div>
      </div>}
      foot={<>
        {isDemoId(sub.id) ? <span class="muted small">Demo applicant: view only.</span> : <>
        {decisions.filter(d => d !== "reset").map(d => {
          const on = sub.plannedDecision === d;
          return (
            <button class={`btn btn--sm ${on ? DECISION_TEXT[d].btn : "btn--secondary"}`} title="Planned only: applied and sent together under “Decisions”"
              onClick={() => act(() => planDecision([sub.id], on ? null : d as PlannedDecision), on ? "Plan removed" : `Planned: ${DECISION_TEXT[d].verb}`)}>
              {on ? `✓ Planned: ${DECISION_TEXT[d].verb}` : `Plan: ${DECISION_TEXT[d].verb}`}
            </button>
          );
        })}
        {decisions.includes("reset") && <button class="btn btn--sm btn--ghost" onClick={() => onDecide("reset")}>{DECISION_TEXT.reset.verb}</button>}
        {decisions.length === 0 && <span class="muted small">Confirmed automatically (instant pipeline).</span>}
        </>}
        {sub.status === "invited" && sub.slotId && (
          <button class="btn btn--secondary btn--sm" title="Emails time, place and meeting link again"
            onClick={() => act(() => sendInterviewDetails(sub.id), r => r.skipped ? `Not sent yet: ${r.skipped}` : "Interview details sent")}>
            Send interview details
          </button>
        )}
        <span class="spacer" />
        <a class="btn btn--ghost btn--sm" href={`/team/outbox?p=${person.id}`}>Emails →</a>
        <a class="btn btn--ghost btn--sm" href={`/team/crm?p=${person.id}`}>CRM profile{others ? ` (+${others})` : ""} →</a>
      </>}>

      <div class="grid-2">
        {app.pipeline !== "instant" && (
          <div class="card stack-s" style="padding:14px 16px">
            <span class="overline">Score</span>
            {applicantScore(app, sub).sheets
              ? <ScoreCell app={app} sub={sub} detailed />
              : <span class="muted small">Not rated yet: fill in the scorecard below.</span>}
          </div>
        )}
        {app.pipeline === "interview" && (
          <div class="card stack-s" style="padding:14px 16px">
            <span class="overline">Interview</span>
            {slot ? <span><strong>{fmtSlot(slot.start)}</strong><br /><span class="muted small">{slot.mode === "online" ? "Online" : slot.location}</span>
                {slot.meetingLink && <><br /><a class="small" href={slot.meetingLink} target="_blank" rel="noopener">Join meeting</a></>}
                <span class="stack-s" style="margin-top:8px"><span class="muted small">Interviewers</span><MemberChips ids={slot.interviewerIds} empty="Nobody assigned yet (tab “Interview slots”)" /></span></span>
              : <span class="muted small">{sub.status === "invited" ? "Invited, no slot booked yet" : "Not invited"}</span>}
          </div>
        )}
      </div>

      <section class="stack-s">
        <h3>Reviewers</h3>
        <div class="row">
          <MemberChips ids={sub.reviewerIds} empty="Nobody assigned yet."
            onRemove={isDemoId(sub.id) ? undefined : id => act(() => unassignReviewer(sub.id, id))} />
          {!isDemoId(sub.id) && <AddMember label="Add reviewer…" exclude={sub.reviewerIds} city={app.tags.location}
            onAdd={id => act(() => assignReviewers([sub.id], [id]), "Reviewer assigned")} />}
        </div>
      </section>

      {Object.keys(app.scorecards).length > 0 && (
        <button class="btn btn--primary btn--sm" style="align-self:flex-start" onClick={onReview}>
          Review side by side: application + scorecard
        </button>
      )}
      {reviewStages(app, sub).map(st => (
        <StageScores key={`${sub.id}-${st}`} app={app} sub={sub} stage={st} acc={acc} />
      ))}
      {app.pipeline !== "instant" && !Object.keys(app.scorecards).length && (
        <p class="muted small">No scorecard for this application yet. Add one in the tab “Scorecards”.</p>
      )}

      <section class="stack-s">
        <h3>Application</h3>
        <Answers app={app} sub={sub} />
      </section>

      <NotesSection acc={acc} sub={sub} />

      <section class="stack-s">
        <h3>History</h3>
        <div class="history">
          {[...sub.history].reverse().map(h => (
            <div class="history__item"><span class="history__dot" /><span><strong>{STATUS_LABEL[h.status]}</strong> <span class="muted">· {fmtDate(h.at)} · {h.by}</span></span></div>
          ))}
        </div>
      </section>
    </Drawer>
  );
}

// ── Setup ────────────────────────────────────────────────────────────────

const IMAGES = ["/images/aachen-connect.jpg", "/images/aachen-hero.jpg", "/images/munich-connect.jpg",
  "/images/munich-hero.jpg", "/images/frankfurt-connect.jpg", "/images/frankfurt-hero.jpg"];

function Setup({ app, hasSubs }: { app: Application; hasSubs: boolean }) {
  const subCount = useStore(s => s.submissions.filter(x => x.applicationId === app.id).length);
  const tagLists = useStore(s => s.tagLists);
  const [d, setD] = useState<Application>(structuredClone(app));
  const dirty = JSON.stringify(d) !== JSON.stringify(app);
  const date = (k: keyof Application["dates"]) => (
    <input class="input" type="date" value={d.dates[k] ?? ""} onInput={e => setD({ ...d, dates: { ...d.dates, [k]: e.currentTarget.value || undefined } })} />
  );
  const fee = parseFee(d.fee);
  const feeBad = !!fee.amount && !fee.currency;
  const bad = !d.dates.opensAt || !d.dates.deadline || d.dates.deadline < d.dates.opensAt || feeBad;
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); await act(() => saveApplication(d), "Application saved"); setBusy(false); };
  const upload = (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) act(async () => setD({ ...d, image: await uploadImage(file) }), "Image uploaded: save to keep it");
  };

  return (
    <div class="stack" style="gap:20px">
      <section class={`card row ${d.published ? "" : "card--tint"}`} style="align-items:flex-start">
        <div style="flex:1;min-width:260px" class="stack-s">
          <h3>{d.published ? "Published" : "Draft: not visible to applicants"}</h3>
          <p class="muted small">
            {d.published
              ? <>Visible on apply.one-aim.org from <strong>{fmtDate(d.dates.opensAt)}</strong> to <strong>{fmtDate(d.dates.deadline)}</strong>. one-aim.org shows it on the {d.tags.location} and {d.tags.program} pages automatically and takes it down after the deadline.</>
              : "Publish when the form, dates and emails are ready. Nothing is shown before the opening date."}
          </p>
        </div>
        <label class="check" style="align-items:center">
          <input type="checkbox" checked={d.published} onChange={e => setD({ ...d, published: e.currentTarget.checked })} />
          <strong>Published</strong>
        </label>
      </section>

      <section class="card stack">
        <h3>Title & tags</h3>
        <div class="grid-2">
          <Field label="Custom title" help="Leave empty for the default title.">
            <input class="input" value={d.title ?? ""} placeholder={`${d.tags.program} ${d.tags.location} – ${d.tags.semester}`} onInput={e => setD({ ...d, title: e.currentTarget.value || undefined })} />
          </Field>
          <Field label="Pipeline" help={hasSubs ? "Locked: applicants have already submitted." : PIPELINES[d.pipeline].description}>
            <select class="input" disabled={hasSubs} value={d.pipeline} onChange={e => setD({ ...d, pipeline: e.currentTarget.value as Application["pipeline"] })}>
              {Object.entries(PIPELINES).map(([k, v]) => <option value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <div class="grid-3">
          <Field label="Semester" required><select class="input" value={d.tags.semester} onChange={e => setD({ ...d, tags: { ...d.tags, semester: e.currentTarget.value } })}>{tagLists.semesters.map(t => <option>{t}</option>)}</select></Field>
          <Field label="Program" required><select class="input" value={d.tags.program} onChange={e => setD({ ...d, tags: { ...d.tags, program: e.currentTarget.value } })}>{tagLists.programs.map(t => <option>{t}</option>)}</select></Field>
          <Field label="Location" required><select class="input" value={d.tags.location} onChange={e => setD({ ...d, tags: { ...d.tags, location: e.currentTarget.value } })}>{tagLists.locations.map(t => <option>{t}</option>)}</select></Field>
        </div>
      </section>

      <section class="card stack">
        <div class="stack-s"><h3>Dates</h3><p class="muted small">These fill the timeline and status card on one-aim.org.</p></div>
        <div class="grid-3">
          <Field label="Applications open" required>{date("opensAt")}</Field>
          <Field label="Deadline" required error={d.dates.deadline && d.dates.opensAt && d.dates.deadline < d.dates.opensAt ? "Deadline is before the opening date." : undefined}>{date("deadline")}</Field>
          <Field label="Final decision by">{date("decisionBy")}</Field>
          {d.pipeline === "interview" && <Field label="Interviews from">{date("interviewsFrom")}</Field>}
          {d.pipeline === "interview" && <Field label="Interviews to">{date("interviewsTo")}</Field>}
          {d.pipeline === "interview" && (
            <Field label="Interview period as text" help='Instead of from/to, e.g. "Oct".'>
              <input class="input" value={d.dates.interviewsLabel ?? ""} onInput={e => setD({ ...d, dates: { ...d.dates, interviewsLabel: e.currentTarget.value || undefined } })} />
            </Field>
          )}
          <Field label="Deadline time" help="Optional, German time. Empty = end of day.">
            <input class="input" type="time" value={d.dates.deadlineTime ?? ""} onInput={e => setD({ ...d, dates: { ...d.dates, deadlineTime: e.currentTarget.value || undefined } })} />
          </Field>
          <Field label={d.pipeline === "instant" ? "Event date" : "Program start"}>{date("startsAt")}</Field>
        </div>
      </section>

      <section class="card stack">
        <h3>Spots & fee</h3>
        <div class="grid-3">
          <Field label="Spots"><input class="input" type="number" min={0} value={d.spots ?? ""} onInput={e => setD({ ...d, spots: Number(e.currentTarget.value) || undefined })} /></Field>
          <Field label="Participation fee" help="Shown on the form. Leave empty if there's no fee; 0 shows “Free”.">
            <input class="input" type="number" min={0} step="0.01" placeholder="e.g. 50" value={fee.amount}
              onInput={e => setD({ ...d, fee: feeValue(e.currentTarget.value, fee.currency) })} />
          </Field>
          <Field label="Currency" required={!!fee.amount} error={feeBad ? "Please select the currency." : undefined}>
            <select class={`input ${feeBad ? "input--invalid" : ""}`} value={fee.currency} disabled={!fee.amount}
              onChange={e => setD({ ...d, fee: feeValue(fee.amount, e.currentTarget.value) })}>
              <option value="">Select currency…</option>
              {CURRENCIES.map(([c, label]) => <option value={c}>{label}</option>)}
            </select>
          </Field>
        </div>
      </section>

      <section class="card stack">
        <h3>Public form page</h3>
        <Field label="Intro text" help="Shown at the top of the application form.">
          <textarea class="input" value={d.intro} onInput={e => setD({ ...d, intro: e.currentTarget.value })} />
        </Field>
        <div class="field">
          <span class="field__label">Header image</span>
          <div class="row">
            {IMAGES.map(src => (
              <button type="button" onClick={() => setD({ ...d, image: src })} aria-label={src}
                style={`width:112px;height:64px;border-radius:12px;border:3px solid ${d.image === src ? "var(--color-brand-blue)" : "transparent"};background:url(${src}) center/cover;cursor:pointer`} />
            ))}
            {d.image && !IMAGES.includes(d.image) && (
              <span style={`width:112px;height:64px;border-radius:12px;border:3px solid var(--color-brand-blue);background:url(${d.image}) center/cover`} />
            )}
            <label class="btn btn--ghost btn--sm" style="cursor:pointer">+ Upload<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={upload} /></label>
          </div>
        </div>
      </section>

      <div class="bulkbar" style={dirty ? "" : "display:none"}>
        <strong>Unsaved changes</strong>
        <button class="btn btn--ghost btn--sm" onClick={() => setD(structuredClone(app))}>Discard</button>
        <button class="btn btn--primary btn--sm" disabled={bad || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>

      <section class="card row row--between">
        <div><h3>Delete application</h3><p class="muted small">Removes the round and its submissions. People stay in the network database.</p></div>
        <button class="btn btn--danger" onClick={() => {
          confirmDialog({
            title: "Delete application?", danger: true, confirmLabel: "Delete application",
            message: `Do you really want to delete "${appTitle(app)}"?` + (hasSubs
              ? `\n\nThis also deletes ${subCount === 1 ? "its 1 submission" : `all ${subCount} submissions`} with answers, interview bookings and comments. The applicants stay in the network database.`
              : "") + "\n\nThis can't be undone.",
          }).then(ok => {
            if (ok) act(async () => { await deleteApplication(app.id); return true; }, "Application deleted")
              .then(done => { if (done) window.location.href = "/team/applications"; });
          });
        }}><IconTrash width={16} />Delete</button>
      </section>
    </div>
  );
}

// ── Form ─────────────────────────────────────────────────────────────────

function FormTab({ app, hasSubs }: { app: Application; hasSubs: boolean }) {
  const [fields, setFields] = useState(structuredClone(app.fields));
  const dirty = JSON.stringify(fields) !== JSON.stringify(app.fields);
  return (
    <div class="stack">
      <FormBuilder fields={fields} onChange={setFields}
        note={hasSubs
          ? "Applicants have already submitted. You can still fix typos or add optional questions, but avoid removing questions: earlier answers to removed questions are hidden."
          : `Copied from blueprint “${app.blueprintName}”. Changes here only affect this application.`} />
      <div class="bulkbar" style={dirty ? "" : "display:none"}>
        <strong>Unsaved form changes</strong>
        <button class="btn btn--ghost btn--sm" onClick={() => setFields(structuredClone(app.fields))}>Discard</button>
        <button class="btn btn--primary btn--sm" onClick={() => act(() => saveApplication({ ...app, fields }), "Form saved")}>Save form</button>
      </div>
      <p class="muted small">Profile fields used: {app.fields.filter(f => KINDS[f.kind].profile).map(f => KINDS[f.kind].label).join(", ")}</p>
    </div>
  );
}

// ── Emails ───────────────────────────────────────────────────────────────

function Emails({ app }: { app: Application }) {
  const keys = templatesFor(app.pipeline);
  const [key, setKey] = useState<TemplateKey>(keys[0]!);
  const [t, setT] = useState(structuredClone(app.templates));
  const dirty = JSON.stringify(t) !== JSON.stringify(app.templates);
  const sample = { name: "Alex Example" };

  return (
    <div class="stack">
      <div class="row">
        {keys.map(k => <button class={`chip-btn ${key === k ? "is-active" : ""}`} onClick={() => setKey(k)}>{TEMPLATE_LABEL[k]}</button>)}
      </div>
      <div class="grid-2" style="align-items:start">
        <div class="card stack">
          <Field label="Subject"><input class="input" value={t[key].subject} onInput={e => setT({ ...t, [key]: { ...t[key], subject: e.currentTarget.value } })} /></Field>
          <Field label="Message"><textarea class="input" style="min-height:260px" value={t[key].body} onInput={e => setT({ ...t, [key]: { ...t[key], body: e.currentTarget.value } })} /></Field>
          <div class="stack-s">
            <span class="field__help">Placeholders, click to insert:</span>
            <div class="row" style="gap:6px">
              {PLACEHOLDERS.filter(p => !PLACEHOLDER_ONLY[p] || PLACEHOLDER_ONLY[p]!.includes(key)).map(p => (
                <button class="chip chip--outline mono" style="cursor:pointer" onClick={() => setT({ ...t, [key]: { ...t[key], body: t[key].body + p } })}>{p}</button>
              ))}
            </div>
          </div>
        </div>
        <div class="stack-s">
          <span class="overline">Preview</span>
          <div class="mail">
            <div class="mail__head">
              <span><span class="muted">From:</span> OneAIM {app.tags.location} &lt;applications@one-aim.org&gt;</span>
              <span><span class="muted">To:</span> {sample.name} &lt;alex@example.com&gt;</span>
              <span><span class="muted">Subject:</span> <strong>{renderTemplate(t[key].subject, app, sample)}</strong></span>
            </div>
            <div class="mail__body">{renderTemplate(t[key].body, app, sample)}</div>
          </div>
          <p class="muted small">Sent automatically: {key === "confirmation" ? "right after an applicant submits." : key === "invite" ? "when you invite someone to an interview." : key === "acceptance" ? "when you accept someone." : "when you reject someone."}</p>
        </div>
      </div>
      <div class="bulkbar" style={dirty ? "" : "display:none"}>
        <strong>Unsaved email changes</strong>
        <button class="btn btn--ghost btn--sm" onClick={() => setT(structuredClone(app.templates))}>Discard</button>
        <button class="btn btn--primary btn--sm" onClick={() => act(() => saveApplication({ ...app, templates: t }), "Emails saved")}>Save emails</button>
      </div>
    </div>
  );
}

// ── Interview slots ──────────────────────────────────────────────────────

function Slots({ app, subs }: { app: Application; subs: Submission[] }) {
  const people = useStore(s => s.people);
  const [day, setDay] = useState(app.dates.interviewsFrom ?? "");
  const [times, setTimes] = useState("17:00, 17:20, 17:40");
  const [mode, setMode] = useState<Slot["mode"]>("online");
  const [location, setLocation] = useState("Online");
  const [meetingLink, setMeetingLink] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [editing, setEditing] = useState<string | null>(null);

  const linkOk = /^https:\/\/\S+$/.test(meetingLink.trim());
  const canAdd = mode === "online" ? linkOk : location.trim().length > 0;
  const blocker = inviteBlocker(app);

  const add = () => {
    const list = times.split(/[,\s]+/).filter(x => /^\d{1,2}:\d{2}$/.test(x));
    if (!day || list.length === 0) { toast("Pick a date and at least one time like 17:00"); return; }
    const past = list.filter(tm => new Date(`${day}T${tm.padStart(5, "0")}`) <= new Date());
    if (past.length) { toast(`These times are in the past: ${past.join(", ")}. Please pick a future date or time.`); return; }
    act(() => addSlots(app.id, list.map(tm => ({
      start: `${day}T${tm.padStart(5, "0")}`, durationMin: 15, mode, capacity,
      location: mode === "online" ? (location.trim() || "Online") : location.trim(),
      meetingLink: mode === "online" ? meetingLink.trim() : undefined,
    }))), `${list.length} slot${list.length > 1 ? "s" : ""} added`);
  };

  const remove = (id: string) => {
    const booked = subs.filter(x => x.slotId === id).length;
    confirmDialog({
      title: "Remove interview slot?", danger: true, confirmLabel: "Remove slot",
      message: booked
        ? `Do you really want to remove this slot? ${booked === 1 ? "Someone has" : `${booked} people have`} booked it and will need to book again.`
        : "Do you really want to remove this slot?",
    }).then(ok => { if (ok) act(() => removeSlot(id), "Slot removed"); });
  };

  return (
    <div class="stack" style="gap:20px">
      <div class={`card row ${blocker ? "" : "card--tint"}`} style={blocker ? "border-color:#F3D19C;background:var(--p-amber-tint)" : ""}>
        <span style="flex:1">{blocker
          ? <><strong>Invitations are blocked.</strong> {blocker}</>
          : <><strong>Ready for invitations.</strong> Applicants book a slot via the link in their invitation; the meeting link is only sent by email after booking, never shown on the booking page.</>}</span>
      </div>

      <section class="card stack">
        <div class="stack-s"><h3>Add slots</h3><p class="muted small">Invited applicants pick one of these via the link in their invitation email.</p></div>
        <div class="row">
          {(["online", "in_person"] as const).map(m => (
            <button type="button" class={`chip-btn ${mode === m ? "is-active" : ""}`}
              onClick={() => { setMode(m); setLocation(m === "online" ? "Online" : ""); }}>{m === "online" ? "Online" : "In person"}</button>
          ))}
        </div>
        <div class="grid-2">
          <Field label="Date"><input class="input" type="date" min={new Date().toISOString().slice(0, 10)} value={day} onInput={e => setDay(e.currentTarget.value)} /></Field>
          <Field label="Start times" help="Comma separated, e.g. 17:00, 17:20, 17:40"><input class="input" value={times} onInput={e => setTimes(e.currentTarget.value)} /></Field>
          {mode === "online" ? (
            <Field label="Meeting link" required help="Zoom, Teams or Meet. Only sent by email after booking." error={meetingLink && !linkOk ? "Paste the full link starting with https://" : undefined}>
              <input class="input" type="url" placeholder="https://zoom.us/j/…" value={meetingLink} onInput={e => setMeetingLink(e.currentTarget.value)} />
            </Field>
          ) : (
            <Field label="Place" required help="Shown on the booking page and in the confirmation email.">
              <input class="input" placeholder="e.g. RWTH Collective Incubator, Room 2" value={location} onInput={e => setLocation(e.currentTarget.value)} />
            </Field>
          )}
          <Field label="People per slot"><input class="input" type="number" min={1} value={capacity} onInput={e => setCapacity(Math.max(1, Number(e.currentTarget.value) || 1))} /></Field>
        </div>
        <button class="btn btn--primary" style="align-self:flex-start" disabled={!canAdd} onClick={add}><IconPlus width={16} />Add slots</button>
      </section>

      {app.slots.length === 0
        ? <div class="empty">No slots yet.</div>
        : (
          <div class="card card--flush">
            <table class="table">
              <thead><tr><th>Time</th><th>Place / meeting link</th><th>Interviewers</th><th>Booked</th><th /></tr></thead>
              <tbody>
                {app.slots.map(sl => {
                  const booked = subs.filter(x => x.slotId === sl.id);
                  const complete = slotComplete(sl);
                  const past = slotIsPast(sl);
                  return (
                    <tr style={past ? "opacity:.55" : ""}>
                      <td><span class="row" style="gap:8px"><IconCalendar width={17} /><strong>{fmtSlot(sl.start)}</strong>{past && <span class="chip chip--gray">Past</span>}</span></td>
                      <td class="small">
                        {editing === sl.id ? (
                          <SlotEdit slot={sl} onDone={() => setEditing(null)} />
                        ) : (
                          <div class="stack-s" style="gap:2px">
                            <span>{sl.mode === "online" ? "Online" : "In person"}{sl.location && sl.location !== "Online" ? ` · ${sl.location}` : ""}</span>
                            {!past && sl.mode === "online" && (sl.meetingLink
                              ? <a href={sl.meetingLink} target="_blank" rel="noopener" style="word-break:break-all">{sl.meetingLink}</a>
                              : <span class="chip chip--red">Meeting link missing</span>)}
                            {past && sl.meetingLink && <span class="muted small" style="word-break:break-all">{sl.meetingLink}</span>}
                            {!past && sl.mode === "in_person" && !complete && <span class="chip chip--red">Place missing</span>}
                            {!past && <button class="btn btn--ghost btn--sm" style="align-self:flex-start;padding:2px 8px" onClick={() => setEditing(sl.id)}>Edit</button>}
                          </div>
                        )}
                      </td>
                      <td>
                        <div class="stack-s">
                          <MemberChips ids={sl.interviewerIds} onRemove={past ? undefined : id => act(() => setInterviewers(sl.id, sl.interviewerIds.filter(x => x !== id)))} />
                          {!past && <AddMember label="Add interviewer…" exclude={sl.interviewerIds} city={app.tags.location}
                            onAdd={id => act(() => setInterviewers(sl.id, [...sl.interviewerIds, id]), "Interviewer assigned")} />}
                        </div>
                      </td>
                      <td>
                        {booked.length === 0 ? <span class="muted small">{past ? "Not booked" : `Free (${sl.capacity})`}</span>
                          : booked.map(b => <span class="chip chip--purple" style="margin:2px">{people.find(p => p.id === b.personId)?.name}</span>)}
                        {booked.length > 0 && booked.length < sl.capacity && <span class="muted small"> +{sl.capacity - slotTaken(app, sl.id)} free</span>}
                      </td>
                      <td class="num"><button class="icon-btn" aria-label="Remove slot" onClick={() => remove(sl.id)}><IconTrash /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function SlotEdit({ slot, onDone }: { slot: Slot; onDone: () => void }) {
  const [mode, setMode] = useState(slot.mode);
  const [location, setLocation] = useState(slot.location);
  const [link, setLink] = useState(slot.meetingLink ?? "");
  const ok = mode === "online" ? /^https:\/\/\S+$/.test(link.trim()) : location.trim().length > 0;
  return (
    <div class="stack-s">
      <select class="input input--sm" value={mode} onChange={e => setMode(e.currentTarget.value as Slot["mode"])} aria-label="Mode">
        <option value="online">Online</option><option value="in_person">In person</option>
      </select>
      {mode === "online"
        ? <input class="input input--sm" type="url" placeholder="https://zoom.us/j/…" value={link} onInput={e => setLink(e.currentTarget.value)} aria-label="Meeting link" />
        : <input class="input input--sm" placeholder="Place" value={location} onInput={e => setLocation(e.currentTarget.value)} aria-label="Place" />}
      <div class="row" style="gap:6px">
        <button class="btn btn--primary btn--sm" disabled={!ok}
          onClick={() => act(() => updateSlot(slot.id, mode === "online"
            ? { mode, meetingLink: link, location: slot.location || "Online" }
            : { mode, location, meetingLink: "" }), "Slot updated").then(onDone)}>Save</button>
        <button class="btn btn--ghost btn--sm" onClick={onDone}>Cancel</button>
      </div>
      <span class="muted small">Already booked? Use “Send interview details” on the applicant to send the new link.</span>
    </div>
  );
}

// ── Review: scores, reviewers, scorecards ───────────────────────────────

const dtFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDateTime = (iso: string) => dtFmt.format(new Date(iso)).replace("Sept", "Sep");

function ScoreCell({ app, sub, detailed }: { app: Application; sub: Submission; detailed?: boolean }) {
  const sc = applicantScore(app, sub);
  const part = (label: string, v?: number, n?: number) => v === undefined ? null
    : <span>{label} <strong>{fmtScore(v)}</strong>{n !== undefined && <span class="muted"> ({n})</span>}</span>;
  if (!detailed) {
    return (
      <span class="score-pill" title={[sc.screening !== undefined ? `Screening ${fmtScore(sc.screening)}` : "", sc.interview !== undefined ? `Interview ${fmtScore(sc.interview)}` : ""].filter(Boolean).join(" · ")}>
        {fmtScore(sc.overall)}<small>/ 5 · {sc.sheets} sheet{sc.sheets > 1 ? "s" : ""}</small>
      </span>
    );
  }
  return (
    <span class="stack-s" style="gap:2px">
      <span class="score-pill" style="font-size:1.4rem">{fmtScore(sc.overall)}<small>/ 5</small></span>
      <span class="small row" style="gap:10px">
        {part("Screening", sc.screening, sub.scoreSheets.filter(x => x.stage === "screening").length)}
        {part("Interview", sc.interview, sub.scoreSheets.filter(x => x.stage === "interview").length)}
      </span>
    </span>
  );
}

function ReviewerAvatars({ ids }: { ids: string[] }) {
  const team = useStore(s => s.team);
  if (!ids.length) return <span class="muted small">–</span>;
  return (
    <span class="row" style="gap:2px;flex-wrap:nowrap" title={ids.map(id => team.find(m => m.id === id)?.name ?? "?").join(", ")}>
      {ids.slice(0, 3).map(id => { const m = team.find(x => x.id === id); return <Avatar name={m?.name ?? "?"} src={m?.photo} />; })}
      {ids.length > 3 && <span class="muted small">+{ids.length - 3}</span>}
    </span>
  );
}

/** Scorecards of one stage: everyone's sheets, and your own to fill in */
function StageScores({ app, sub, stage, acc }: { app: Application; sub: Submission; stage: ReviewStage; acc: Account }) {
  const team = useStore(s => s.team);
  const card = app.scorecards[stage]!;
  const sheets = sub.scoreSheets.filter(x => x.stage === stage);
  const mine = sheets.find(x => x.memberId === acc.memberId);
  const [editing, setEditing] = useState(false);
  const demo = isDemoId(sub.id);
  const avg = applicantScore(app, sub)[stage];

  return (
    <section class="stack-s">
      <div class="row row--between">
        <h3>{stage === "screening" ? "Screening" : "Interview"} scorecard</h3>
        <span class="small">{sheets.length ? <>Average <strong>{fmtScore(avg)}</strong> / 5 from {sheets.length}</> : <span class="muted">Not rated yet</span>}</span>
      </div>
      {sheets.length > 0 && (
        <div class="table-wrap">
          <table class="table table--compact">
            <thead><tr><th>Category</th>{sheets.map(sh => <th class="num">{team.find(m => m.id === sh.memberId)?.name.split(" ")[0] ?? "Former"}</th>)}</tr></thead>
            <tbody>
              {card.criteria.map(c => (
                <tr><td title={c.help}>{c.label}{c.weight > 1 && <span class="muted small"> ×{c.weight}</span>}</td>
                  {sheets.map(sh => <td class="num">{sh.scores[c.id] ?? "–"}</td>)}</tr>
              ))}
              <tr><td><strong>Total</strong></td>{sheets.map(sh => <td class="num"><strong>{fmtScore(sheetScore(card, sh))}</strong></td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
      {sheets.filter(sh => sh.note).map(sh => (
        <p class="small"><strong>{team.find(m => m.id === sh.memberId)?.name ?? "Former member"}:</strong> {sh.note}</p>
      ))}
      {!demo && (editing || (!mine && acc.memberId))
        ? (acc.memberId
            ? <div class="card" style="padding:14px 16px;box-shadow:none">
                <ScoreSheetForm card={card} sheet={mine}
                  onCancel={mine || editing ? () => setEditing(false) : undefined}
                  onSave={(scores, note) => act(() => saveScoreSheet(sub.id, stage, scores, note, acc), "Scorecard saved").then(() => setEditing(false))} />
              </div>
            : null)
        : !demo && mine && (
            <div class="row">
              <span class="muted small">Your total: <strong>{fmtScore(sheetScore(card, mine))}</strong></span>
              <button class="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>Edit my scorecard</button>
              <button class="btn btn--ghost btn--sm" onClick={async () => {
                if (await confirmDialog({ title: "Delete your scorecard?", message: "Your ratings for this stage are removed.", danger: true, confirmLabel: "Delete" })) act(() => deleteScoreSheet(mine.id), "Deleted");
              }}>Delete</button>
            </div>
          )}
      {!acc.memberId && <p class="muted small">Scorecards need your personal team account.</p>}
    </section>
  );
}

/** The application's own scorecards (copied from templates, editable here) */
function ScorecardsTab({ app }: { app: Application }) {
  const templates = useStore(s => s.scorecards);
  const subs = useStore(s => s.submissions.filter(x => x.applicationId === app.id));
  const stages: ReviewStage[] = app.pipeline === "interview" ? ["screening", "interview"] : ["screening"];
  const [drafts, setDrafts] = useState<Partial<Record<ReviewStage, Scorecard>>>(structuredClone(app.scorecards));
  const dirty = JSON.stringify(drafts) !== JSON.stringify(app.scorecards);
  const valid = stages.every(st => !drafts[st] || scorecardValid(drafts[st]!));
  const rated = (st: ReviewStage) => subs.reduce((n, x) => n + x.scoreSheets.filter(y => y.stage === st).length, 0);

  return (
    <div class="stack">
      <p class="muted small">Every team member rates applicants with these scorecards: one sheet per person and stage. Templates are managed under Blueprints → Scorecards; changes here only affect this application.</p>
      {stages.map(st => {
        const card = drafts[st];
        return (
          <section class="card stack">
            <div class="row row--between">
              <h3>{st === "screening" ? "Screening" : "Interview"} scorecard</h3>
              <div class="row" style="gap:6px">
                <select class="input input--sm" style="width:auto" value="" aria-label="Use template"
                  onChange={e => {
                    const t = templates.find(x => x.id === e.currentTarget.value);
                    if (t) setDrafts({ ...drafts, [st]: { name: t.name, criteria: structuredClone(t.criteria) } });
                  }}>
                  <option value="">{card ? "Replace with template…" : "Use template…"}</option>
                  {templates.map(t => <option value={t.id}>{t.name}</option>)}
                </select>
                {card && <button class="btn btn--ghost btn--sm" onClick={() => { const d = { ...drafts }; delete d[st]; setDrafts(d); }}>Remove</button>}
              </div>
            </div>
            {rated(st) > 0 && <p class="small" style="color:var(--p-amber)">{rated(st)} scorecard{rated(st) > 1 ? "s were" : " was"} already filled in. Removing categories drops their ratings from the totals.</p>}
            {card
              ? <ScorecardEditor value={card} onChange={c => setDrafts({ ...drafts, [st]: c })} />
              : <p class="muted small">No scorecard for this stage. Pick a template to start.</p>}
          </section>
        );
      })}
      <div class="row">
        <button class="btn btn--primary" disabled={!dirty || !valid} onClick={() => act(() => saveApplication({ ...app, scorecards: drafts }), "Scorecards saved")}>Save scorecards</button>
        {dirty && <button class="btn btn--ghost" onClick={() => setDrafts(structuredClone(app.scorecards))}>Discard changes</button>}
        {!valid && <span class="small field__error">Every category needs a name.</span>}
      </div>
    </div>
  );
}

function NotesSection({ acc, sub }: { acc: Account; sub: Submission }) {
  const [comment, setComment] = useState("");
  return (
    <section class="stack-s">
      <h3>Notes</h3>
      <p class="muted small">Only visible to the team. Each note is marked with the stage of the process and the time it was written.</p>
      {[...sub.comments].reverse().map(c => (
        <div class="note">
          <div class="row small" style="gap:8px">
            {c.stage && <span class="chip chip--outline">{STAGE_LABEL[c.stage]}</span>}
            <strong style="color:var(--color-text-heading)">{c.author}</strong>
            <span class="spacer" />
            <span class="muted">{fmtDateTime(c.at)}</span>
          </div>
          <p style="margin-top:6px;white-space:pre-wrap">{c.text}</p>
        </div>
      ))}
      <textarea class="input" style="min-height:70px" placeholder={`Add a note (stage: ${STAGE_LABEL[sub.status]})…`} value={comment} disabled={isDemoId(sub.id)} onInput={e => setComment(e.currentTarget.value)} />
      <button class="btn btn--secondary btn--sm" style="align-self:flex-start" disabled={!comment.trim()}
        onClick={async () => { await act(() => addComment(sub.id, acc.city, comment)); setComment(""); }}>Add note</button>
    </section>
  );
}

/**
 * Full-screen review: the application on the left, scorecards and notes on the
 * right; both sides scroll on their own. Previous / next follow the list order.
 */
function ReviewSplit({ acc, app, subId, order, onNavigate, onClose }: {
  acc: Account; app: Application; subId: string; order: string[]; onNavigate: (id: string) => void; onClose: () => void;
}) {
  const sub = useStore(s => s.submissions.find(x => x.id === subId));
  const person = useStore(s => s.people.find(p => p.id === sub?.personId));
  const left = useRef<HTMLDivElement>(null);
  const i = order.indexOf(subId);
  const prev = i > 0 ? order[i - 1] : undefined;
  const next = i >= 0 && i < order.length - 1 ? order[i + 1] : undefined;

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Alt + arrows: previous / next applicant (plain arrows stay for text fields)
      if (e.altKey && e.key === "ArrowLeft" && prev) onNavigate(prev);
      if (e.altKey && e.key === "ArrowRight" && next) onNavigate(next);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [prev, next]);
  useEffect(() => { left.current?.scrollTo(0, 0); }, [subId]);
  if (!sub || !person) return null;
  const stages = reviewStages(app, sub);

  return (
    <div class="review-split" role="dialog" aria-modal="true" aria-label={`Review ${person.name}`}>
      <header class="review-split__head">
        <Avatar name={person.name} />
        <div style="min-width:0">
          <strong style="color:var(--color-text-heading)">{person.name}</strong>
          <div class="row small" style="gap:6px"><StatusChip status={sub.status} /><span class="muted">{appTitle(app)}</span></div>
        </div>
        <span class="spacer" />
        {i >= 0 && <span class="muted small">{i + 1} of {order.length}</span>}
        <button class="btn btn--secondary btn--sm" disabled={!prev} title="Previous applicant (Alt + ←)" onClick={() => prev && onNavigate(prev)}>← Previous</button>
        <button class="btn btn--secondary btn--sm" disabled={!next} title="Next applicant (Alt + →)" onClick={() => next && onNavigate(next)}>Next →</button>
        <button class="icon-btn" aria-label="Close" onClick={onClose}><IconX /></button>
      </header>
      <div class="review-split__body">
        <div class="review-split__pane" ref={left}>
          <section class="stack-s">
            <span class="overline">Application</span>
            <p class="muted small">
              {person.studyPrograms.join(", ")}{person.universities.length ? ` · ${person.universities.join(", ")}` : ""}
              {person.semester && /^\d/.test(person.semester) ? ` · ${person.semester}. semester` : ""}{person.degree ? ` · ${person.degree}` : ""}
            </p>
            <Answers app={app} sub={sub} />
          </section>
        </div>
        <div class="review-split__pane review-split__pane--side">
          {stages.length === 0 && <p class="muted small">No scorecard for this application yet (tab “Scorecards”).</p>}
          {stages.map(st => <StageScores key={`${sub.id}-${st}`} app={app} sub={sub} stage={st} acc={acc} />)}
          <NotesSection key={sub.id} acc={acc} sub={sub} />
        </div>
      </div>
    </div>
  );
}

/** Scorecards that apply to this applicant now: screening always, the interview one once they're past screening */
function reviewStages(app: Application, sub: Submission): ReviewStage[] {
  return (["screening", "interview"] as ReviewStage[])
    .filter(st => app.scorecards[st] && (st === "screening" || sub.status !== "new" || sub.scoreSheets.some(x => x.stage === st)));
}
