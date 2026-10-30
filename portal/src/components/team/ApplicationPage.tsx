import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Account, Application, PlannedDecision, ReviewStage, Scorecard, Slot, Submission, SubmissionStatus, TemplateKey } from "../../lib/types";
import {
  addComment, addSlots, decide, deleteApplication, inviteBlocker, removeSlot, renderTemplate, saveApplication,
  sendInterviewDetails, slotComplete, slotIsPast, slotTaken, updateSlot, uploadImage, useStore, type Decision,
  formOptionsFromState, getState, applicantScore, planDecision, addInterviewerToSlots, clearInterviewers, removeSlots, assignReviewers, unassignReviewer, setInterviewers, saveScoreSheet,
  deleteScoreSheet, sheetScore,
} from "../../lib/store";
import { DecisionsTab } from "./DecisionsTab";
import { AddMember, fmtScore, MemberChips, ScorecardEditor, scorecardValid, ScoreSheetForm, STAGE_LABEL } from "./Review";
import {
  appPhase, appTitle, CURRENCIES, feeValue, fmtDate, parseFee, fmtShort, fmtSlot, KINDS, PIPELINES, PLACEHOLDER_ONLY, PLACEHOLDERS, STATUS_LABEL, TEMPLATE_LABEL, today, nowLocal,
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
  // Profile to open once when the Applicants tab shows next (from the link or a click in Decisions)
  const [pendingOpen, setPendingOpen] = useState<string | null>(openSub);
  // Decisions tab: profile opened next to the list
  const [side, setSide] = useState<{ id: string; order: string[] } | null>(null);
  const [sideReview, setSideReview] = useState(false);
  const [sideConfirm, setSideConfirm] = useState<Decision | null>(null);

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
        <span class="muted small">Created by {app.createdBy} · from blueprint “{app.blueprintName}”</span>
      </div>

      {isDemoId(app.id) && (
        <div class="demo-banner" role="status">
          <strong>Demo application: made up, view only.</strong> Reviewers, scorecards, notes and decisions can't be changed here, since these applicants don't exist in the database. Use a real application to try the workflow.
        </div>
      )}
      <ProcessBar app={app} subs={subs} />
      <PublishBar app={app} />

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

      {tab === "applicants" && <Applicants acc={acc} app={app} subs={subs} openSub={pendingOpen} onOpened={() => setPendingOpen(null)} />}
      {tab === "decisions" && <>
        <DecisionsTab app={app} subs={subs} onOpen={(id, order) => setSide({ id, order })} />
        {/* The profile opens next to the planner; the tab stays */}
        {side && !sideReview && subs.find(x => x.id === side.id) && (
          <ApplicantDrawer acc={acc} app={app} sub={subs.find(x => x.id === side.id)!} onClose={() => setSide(null)}
            onDecide={d => setSideConfirm(d)} onReview={() => setSideReview(true)} />
        )}
        {side && sideReview && (
          <ReviewSplit acc={acc} app={app} subId={side.id} order={side.order}
            onNavigate={id => setSide({ ...side, id })} onClose={() => setSideReview(false)} />
        )}
        {side && sideConfirm && (
          <ConfirmDecision acc={acc} app={app} subs={subs.filter(x => x.id === side.id)} decision={sideConfirm}
            onClose={() => setSideConfirm(null)} onDone={() => setSideConfirm(null)} />
        )}
      </>}
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
  withdraw: { verb: "Could not attend", btn: "btn--secondary" },
};

/** Decisions on applicants who already have a final decision are applied right away (not planned) */
const DECIDED: SubmissionStatus[] = ["accepted", "rejected", "withdrawn"];
const decidedVerb = (d: Decision, status: SubmissionStatus) =>
  d === "accept" && status === "rejected" ? "Move to accepted" : d === "accept" && status === "withdrawn" ? "Accepted again" : DECISION_TEXT[d].verb;

function decisionsFor(app: Application, status: SubmissionStatus): Decision[] {
  if (app.pipeline === "instant") return [];
  // After the decision: accepted ones can drop out, rejected / dropped-out ones can still be accepted
  if (status === "accepted") return ["withdraw", "reset"];
  if (status === "rejected" || status === "withdrawn") return ["accept", "reset"];
  if (app.pipeline === "screening") return status === "new" ? ["accept", "reject"] : ["reset"];
  if (status === "new") return ["invite", "reject"];
  if (status === "invited") return ["accept", "reject"];
  return ["reset"];
}

type SortKey = "name" | "study" | "status" | "screening" | "reviewers" | "interview" | "interviewers" | "interviewScore" | "submitted";
/** First click: scores and dates newest/highest first, text A–Z */
const DEFAULT_DIR: Record<SortKey, 1 | -1> = {
  name: 1, study: 1, status: 1, screening: -1, reviewers: 1, interview: 1, interviewers: 1, interviewScore: -1, submitted: -1,
};
const STATUS_ORDER: SubmissionStatus[] = ["new", "invited", "accepted", "confirmed", "rejected"];

function Applicants({ acc, app, subs, openSub, onOpened }: {
  acc: Account; app: Application; subs: Submission[]; openSub: string | null; onOpened: () => void;
}) {
  const people = useStore(s => s.people);
  const [status, setStatus] = useState<SubmissionStatus | "all">("all");
  const [q, setQ] = useState("");
  // Sorting by clicking a column header; clicking again reverses
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "submitted", dir: -1 });
  const sortBy = (key: SortKey) => setSort(s => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: DEFAULT_DIR[key] }));
  // "Assigned to me" = my reviews in screening; "My interviews" = interviews I lead
  const [mine, setMine] = useState<"" | "review" | "interviews">("");
  const me = acc.memberId;
  const isMyReview = (x: Submission) => !!me && x.status === "new" && x.reviewerIds.includes(me);
  const isMyInterview = (x: Submission) => !!me && x.status === "invited" && !!app.slots.find(sl => sl.id === x.slotId)?.interviewerIds.includes(me);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(openSub);
  useEffect(() => { if (openSub) onOpened(); }, []);   // opened once; not again on the next visit
  const [confirm, setConfirm] = useState<{ ids: string[]; decision: Decision } | null>(null);

  const person = (x: Submission) => people.find(p => p.id === x.personId)!;
  const team = useStore(st => st.team);
  const slotOf = (x: Submission) => app.slots.find(sl => sl.id === x.slotId);
  const sortValue = (key: SortKey, x: Submission): string | number | undefined => {
    const p = person(x);
    switch (key) {
      case "name": return p.name.toLowerCase();
      case "study": return (p.studyPrograms[0] ?? "").toLowerCase() || undefined;
      case "status": return STATUS_ORDER.indexOf(x.status);
      case "screening": return applicantScore(app, x).screening;
      case "reviewers": return x.reviewerIds.map(id => team.find(m => m.id === id)?.name ?? "").sort()[0]?.toLowerCase() || undefined;
      case "interview": return slotOf(x)?.start;
      case "interviewers": return slotOf(x)?.interviewerIds.map(id => team.find(m => m.id === id)?.name ?? "").sort()[0]?.toLowerCase() || undefined;
      case "interviewScore": return applicantScore(app, x).interview;
      case "submitted": return x.submittedAt;
    }
  };
  const th = (key: SortKey, label: string, title?: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} title={title}>
      <button type="button" class={`th-sort ${sort.key === key ? "is-active" : ""}`} onClick={() => sortBy(key)}>
        {label}<span class="th-sort__arrow" aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
  const statuses: SubmissionStatus[] = app.pipeline === "instant" ? ["confirmed"]
    : app.pipeline === "screening" ? ["new", "accepted", "rejected", "withdrawn"] : ["new", "invited", "accepted", "rejected", "withdrawn"];

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    return subs
      .filter(x => status === "all" || x.status === status)
      .filter(x => !mine || (mine === "review" ? isMyReview(x) : isMyInterview(x)))
      .filter(x => { const p = person(x); return !ql || `${p.name} ${p.email} ${p.universities.join(" ")} ${p.studyPrograms.join(" ")}`.toLowerCase().includes(ql); })
      .sort((a, b) => {
        const va = sortValue(sort.key, a), vb = sortValue(sort.key, b);
        // Empty values (not rated, no slot…) always go last
        if (va === undefined || vb === undefined) return va === vb ? 0 : va === undefined ? 1 : -1;
        const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
        return c * sort.dir || a.submittedAt.localeCompare(b.submittedAt);
      });
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
          <button class={`chip-btn ${status === st ? "is-active" : ""}`} onClick={() => {
            setStatus(st);
            if ((mine === "review" && st !== "all" && st !== "new") || (mine === "interviews" && st !== "all" && st !== "invited")) setMine("");
          }}>
            {st === "all" ? "All" : STATUS_LABEL[st]}
            <span style="opacity:.7;margin-left:6px">{st === "all" ? subs.length : subs.filter(x => x.status === st).length}</span>
          </button>
        ))}
        <span class="spacer" />
        {me && (status === "all" || status === "new") && subs.some(x => x.status === "new") && (
          <button class={`chip-btn ${mine === "review" ? "is-active" : ""}`} onClick={() => setMine(mine === "review" ? "" : "review")} title="Applicants in screening you're assigned to review">
            Assigned to me <span style="opacity:.7;margin-left:6px">{subs.filter(isMyReview).length}</span>
          </button>
        )}
        {me && app.pipeline === "interview" && (status === "all" || status === "invited") && subs.some(x => x.status === "invited") && (
          <button class={`chip-btn ${mine === "interviews" ? "is-active" : ""}`} onClick={() => setMine(mine === "interviews" ? "" : "interviews")} title="Interviews you lead">
            My interviews <span style="opacity:.7;margin-left:6px">{subs.filter(isMyInterview).length}</span>
          </button>
        )}
        {app.spots && <span class="chip chip--green">{accepted} / {app.spots} spots filled</span>}
      </div>

      <div class="row">
        <div style="position:relative;flex:1;min-width:220px">
          <IconSearch width={17} style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-text-muted)" />
          <input class="input input--sm" style="padding-left:36px" placeholder="Search name, university, study program…" value={q} onInput={e => setQ(e.currentTarget.value)} aria-label="Search applicants" />
        </div>
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
                    {th("name", "Applicant")}{th("study", "Study")}{th("status", "Status")}
                    {app.pipeline !== "instant" && <>{th("screening", "Screening score", "Average of the screening scorecards")}{th("reviewers", "Reviewers")}</>}
                    {app.pipeline === "interview" && <>{th("interview", "Interview")}{th("interviewers", "Interviewers")}{th("interviewScore", "Interview score", "Average of the interview scorecards")}</>}
                    {th("submitted", "Submitted")}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(x => {
                    const p = person(x);
                    const slot = app.slots.find(s => s.id === x.slotId);
                    return (
                      <tr class={`is-clickable ${selected.has(x.id) ? "is-selected" : ""}`} onClick={() => setOpen(x.id)}>
                        <td onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${p.name}`} disabled={isDemoId(x.id)} checked={selected.has(x.id)} onChange={() => toggle(x.id)} /></td>
                        <td><div class="cell-person"><Avatar name={p.name} /><strong>{p.name}</strong></div></td>
                        <td class="cell-study"><span style="color:var(--color-text-heading)">{p.studyPrograms.join(", ") || "–"}</span><br /><span class="muted small">{p.universities.join(", ")}{p.semester && /^\d/.test(p.semester) ? ` · ${p.semester}. sem.` : ""}{p.degree ? ` · ${p.degree}` : ""}</span></td>
                        <td><StatusChip status={x.status} />{x.plannedDecision && <div style="margin-top:4px"><span class={`chip ${x.plannedDecision === "accept" ? "chip--green" : x.plannedDecision === "reject" ? "chip--red" : "chip--purple"}`} title={`Planned by ${x.plannedBy ?? "?"}, not sent yet`}>Planned: {DECISION_TEXT[x.plannedDecision].verb}</span></div>}</td>
                        {app.pipeline !== "instant" && <>
                          <td><StageScoreCell app={app} sub={x} stage="screening" /></td>
                          <td><ReviewerAvatars ids={x.reviewerIds} /></td>
                        </>}
                        {app.pipeline === "interview" && <>
                          <td class="small" style="white-space:nowrap">{slot ? fmtSlot(slot.start) : x.status === "invited" ? <span class="chip chip--amber">No slot yet</span> : <span class="muted">–</span>}</td>
                          <td>{slot ? <ReviewerAvatars ids={slot.interviewerIds} /> : <span class="muted small">–</span>}</td>
                          <td>{slot || x.scoreSheets.some(y => y.stage === "interview") ? <StageScoreCell app={app} sub={x} stage="interview" /> : <span class="muted small">–</span>}</td>
                        </>}
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
          {selSubs.every(x => DECIDED.includes(x.status)) && bulk.filter(d => d !== "reset").map(d => (
            <button class="btn btn--sm btn--secondary" onClick={() => setConfirm({ ids: [...selected], decision: d })}>{decidedVerb(d, selSubs[0]!.status)}</button>
          ))}
          {!selSubs.every(x => DECIDED.includes(x.status)) && bulk.filter(d => d !== "reset").map(d => (
            <button class="btn btn--sm btn--secondary"
              onClick={() => act(() => planDecision([...selected], d as PlannedDecision), `Planned for ${selected.size}: ${DECISION_TEXT[d].verb}`).then(() => setSelected(new Set()))}>Plan: {DECISION_TEXT[d].verb}</button>
          ))}
          {bulk.includes("reset") && <button class="btn btn--sm btn--ghost" onClick={() => setConfirm({ ids: [...selected], decision: "reset" })}>{DECISION_TEXT.reset.verb}</button>}
          {selSubs.every(x => !isDemoId(x.id)) && (
            <AddMember dropUp label="Add reviewer…" exclude={[]} city={app.tags.location}
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
    <Modal title={decision === "withdraw"
      ? `Mark ${subs.length === 1 ? first.name : `${subs.length} participants`} as “could not attend”?`
      : `${info.verb} ${subs.length === 1 ? first.name : `${subs.length} applicants`}?`} onClose={onClose} wide>
      {decision === "withdraw" && (
        <p class="small">For accepted participants who dropped out. Their spot becomes free again (e.g. for someone you move up from the rejected), and they no longer count as participants. You can accept them again later.</p>
      )}
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
        {DECIDED.includes(sub.status) && decisions.filter(d => d !== "reset").map(d => (
          <button class={`btn btn--sm ${d === "accept" ? "btn--success" : "btn--secondary"}`} onClick={() => onDecide(d)}>{decidedVerb(d, sub.status)}</button>
        ))}
        {!DECIDED.includes(sub.status) && decisions.filter(d => d !== "reset").map(d => {
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
  // "Published" is switched in the header; Setup never overwrites it
  const dirty = JSON.stringify({ ...d, published: app.published }) !== JSON.stringify(app);
  const date = (k: keyof Application["dates"]) => (
    <input class="input" type="date" value={d.dates[k] ?? ""} onInput={e => setD({ ...d, dates: { ...d.dates, [k]: e.currentTarget.value || undefined } })} />
  );
  const fee = parseFee(d.fee);
  const feeBad = !!fee.amount && !fee.currency;
  const dateErr = dateProblems(d);
  const bad = !d.dates.opensAt || !d.dates.deadline || d.dates.deadline < d.dates.opensAt || feeBad || Object.keys(dateErr).length > 0;
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); await act(() => saveApplication({ ...d, published: app.published }), "Application saved"); setBusy(false); };
  const upload = (e: Event) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) act(async () => setD({ ...d, image: await uploadImage(file) }), "Image uploaded: save to keep it");
  };

  return (
    <div class="stack" style="gap:20px">
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
          <Field label="Deadline" required help="Applications close at 23:59 (German time) on this day." helpBelow error={d.dates.deadline && d.dates.opensAt && d.dates.deadline < d.dates.opensAt ? "Deadline is before the opening date." : undefined}>{date("deadline")}</Field>
          {d.pipeline !== "instant" && <Field label="Final decision by" required error={dateErr.decisionBy}>{date("decisionBy")}</Field>}
          {d.pipeline === "interview" && <Field label="Interviews from" required error={dateErr.interviewsFrom}>{date("interviewsFrom")}</Field>}
          {d.pipeline === "interview" && <Field label="Interviews to" required error={dateErr.interviewsTo}>{date("interviewsTo")}</Field>}
          <Field label={d.pipeline === "instant" ? "Event date" : "Program start"} required error={dateErr.startsAt}>{date("startsAt")}</Field>
        </div>
      </section>

      <section class="card stack">
        <h3>Spots & fee</h3>
        <div class="grid-3">
          <Field label="Spots"><input class="input" type="number" min={0} value={d.spots ?? ""} onInput={e => setD({ ...d, spots: Number(e.currentTarget.value) || undefined })} /></Field>
          <Field label="Participation fee" help="Shown on the form. Leave empty if there's no fee; 0 shows “Free”." helpBelow>
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
  const [parallel, setParallel] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = app.slots.length > 0 && app.slots.every(sl => selected.has(sl.id));
  const [editing, setEditing] = useState<string | null>(null);

  const linkOk = /^https:\/\/\S+$/.test(meetingLink.trim());
  const canAdd = mode === "online" ? linkOk : location.trim().length > 0;
  const blocker = inviteBlocker(app);

  const add = () => {
    const list = times.split(/[,\s]+/).filter(x => /^\d{1,2}:\d{2}$/.test(x));
    if (!day || list.length === 0) { toast("Pick a date and at least one time like 17:00"); return; }
    const past = list.filter(tm => new Date(`${day}T${tm.padStart(5, "0")}`) <= new Date());
    if (past.length) { toast(`These times are in the past: ${past.join(", ")}. Please pick a future date or time.`); return; }
    // Parallel interviews = separate slots at the same time, one applicant each, each with its own interviewers
    const n = Math.max(1, parallel);
    act(() => addSlots(app.id, list.flatMap(tm => Array.from({ length: n }, () => ({
      start: `${day}T${tm.padStart(5, "0")}`, durationMin: 15, mode, capacity: 1,
      location: mode === "online" ? (location.trim() || "Online") : location.trim(),
      meetingLink: mode === "online" ? meetingLink.trim() : undefined,
    })))), `${list.length * n} slot${list.length * n > 1 ? "s" : ""} added`);
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

  // Overview numbers: slots, places (a slot can hold several people), bookings
  const upcoming = app.slots.filter(sl => !slotIsPast(sl));
  const places = app.slots.reduce((n, sl) => n + sl.capacity, 0);
  const booked = app.slots.reduce((n, sl) => n + subs.filter(x => x.slotId === sl.id).length, 0);
  const freeUpcoming = upcoming.reduce((n, sl) => n + Math.max(0, sl.capacity - subs.filter(x => x.slotId === sl.id).length), 0);
  const invitedNoSlot = subs.filter(x => x.status === "invited" && !x.slotId).length;
  const noInterviewer = upcoming.filter(sl => !sl.interviewerIds.length).length;

  return (
    <div class="stack" style="gap:20px">
      <div class="stats">
        <div class="card stat">
          <span class="stat__num">{app.slots.length}</span><span class="stat__label">Interview slots</span>
          <span class="muted small">{upcoming.length} upcoming · {app.slots.length - upcoming.length} past{places !== app.slots.length ? ` · ${places} places` : ""}</span>
        </div>
        <div class="card stat">
          <span class="stat__num">{booked} / {places}</span><span class="stat__label">Booked</span>
          <span class="muted small">{places ? `${Math.round((booked / places) * 100)}% of all places` : "no slots yet"}</span>
        </div>
        <div class="card stat">
          <span class="stat__num">{freeUpcoming}</span><span class="stat__label">Free places</span>
          <span class="muted small">{invitedNoSlot ? `${invitedNoSlot} invited, not booked yet` : "in upcoming slots"}</span>
        </div>
        <div class="card stat">
          <span class="stat__num">{noInterviewer}</span><span class="stat__label">Without interviewer</span>
          <span class="muted small">upcoming slots nobody is assigned to</span>
        </div>
      </div>
      {invitedNoSlot > freeUpcoming && (
        <p class="small field__error">{invitedNoSlot} invited applicants haven't booked yet, but only {freeUpcoming} free place{freeUpcoming === 1 ? " is" : "s are"} left. Add more slots.</p>
      )}

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
          <Field label="Start times" help="Comma separated, e.g. 17:00, 17:20, 17:40" helpBelow><input class="input" value={times} onInput={e => setTimes(e.currentTarget.value)} /></Field>
          {mode === "online" ? (
            <Field label="Meeting link" required help="Zoom, Teams or Meet. Only sent by email after booking." helpBelow error={meetingLink && !linkOk ? "Paste the full link starting with https://" : undefined}>
              <input class="input" type="url" placeholder="https://zoom.us/j/…" value={meetingLink} onInput={e => setMeetingLink(e.currentTarget.value)} />
            </Field>
          ) : (
            <Field label="Place" required help="Shown on the booking page and in the confirmation email." helpBelow>
              <input class="input" placeholder="e.g. RWTH Collective Incubator, Room 2" value={location} onInput={e => setLocation(e.currentTarget.value)} />
            </Field>
          )}
          <Field label="Parallel interviews" help="Interviews at the same time. Each becomes its own slot with its own interviewers." helpBelow>
            <input class="input" type="number" min={1} max={30} value={parallel} onInput={e => setParallel(Math.min(30, Math.max(1, Number(e.currentTarget.value) || 1)))} />
          </Field>
        </div>
        <button class="btn btn--primary" style="align-self:flex-start" disabled={!canAdd} onClick={add}><IconPlus width={16} />Add slots</button>
      </section>

      {app.slots.length === 0
        ? <div class="empty">No slots yet.</div>
        : (
          <div class="card card--flush">
            <table class="table table--slots">
              <thead><tr>
                <th style="width:36px"><input type="checkbox" aria-label="Select all slots" checked={allSel}
                  onChange={() => setSelected(allSel ? new Set() : new Set(app.slots.map(sl => sl.id)))} /></th>
                <th>Time</th><th>Place / meeting link</th><th>Interviewers</th><th>Booked</th><th />
              </tr></thead>
              <tbody>
                {app.slots.map(sl => {
                  const booked = subs.filter(x => x.slotId === sl.id);
                  const complete = slotComplete(sl);
                  const past = slotIsPast(sl);
                  const same = app.slots.filter(x => x.start === sl.start);
                  return (
                    <tr style={past ? "opacity:.55" : ""} class={selected.has(sl.id) ? "is-selected" : ""}>
                      <td><input type="checkbox" aria-label={`Select slot ${fmtSlot(sl.start)}`} checked={selected.has(sl.id)} onChange={() => toggleSel(sl.id)} /></td>
                      <td><span class="row" style="gap:8px"><IconCalendar width={17} /><strong>{fmtSlot(sl.start)}</strong>
                        {same.length > 1 && <span class="chip chip--outline" title="Parallel interviews at the same time">{same.indexOf(sl) + 1} of {same.length}</span>}
                        {past && <span class="chip chip--gray">Past</span>}</span></td>
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
                            {!past && <button class="link-btn small slot-edit" onClick={() => setEditing(sl.id)}>Edit</button>}
                          </div>
                        )}
                      </td>
                      <td>
                        <div class="slot-interviewers">
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

      {selected.size > 0 && (
        <div class="bulkbar" role="toolbar" aria-label="Selected slots">
          <strong>{selected.size} slot{selected.size > 1 ? "s" : ""} selected</strong>
          <AddMember dropUp label="Add interviewer…" exclude={[]} city={app.tags.location}
            onAdd={id => act(() => addInterviewerToSlots([...selected], id), n => `Interviewer added to ${n} slot${n === 1 ? "" : "s"}`)} />
          <button class="btn btn--ghost btn--sm" onClick={() => act(() => clearInterviewers([...selected]), "Interviewers removed")}>Clear interviewers</button>
          <button class="btn btn--ghost btn--sm" onClick={async () => {
            const bookedN = subs.filter(x => x.slotId && selected.has(x.slotId)).length;
            if (await confirmDialog({
              title: `Delete ${selected.size} slot${selected.size > 1 ? "s" : ""}?`, danger: true, confirmLabel: "Delete",
              message: bookedN ? `${bookedN} applicant${bookedN > 1 ? "s have" : " has"} booked one of them and will need to book again.` : "Nobody has booked them yet.",
            })) act(() => removeSlots([...selected]), "Slots deleted").then(() => setSelected(new Set()));
          }}>Delete</button>
          <button class="btn btn--ghost btn--sm" onClick={() => setSelected(new Set())}>Cancel</button>
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

/** Public or not: switched right at the top of the application, saved immediately */
function PublishBar({ app }: { app: Application }) {
  const [busy, setBusy] = useState(false);
  const missing = Object.keys(dateProblems(app)).length > 0;
  const toggle = async (on: boolean) => {
    if (on && missing) { toast("Fill in all dates under “Setup & dates” first (final decision, interviews, program start)."); return; }
    if (!(await confirmDialog(on
      ? { title: "Publish this application?", confirmLabel: "Publish",
          message: `It becomes visible on the apply site and one-aim.org from ${fmtDate(app.dates.opensAt)} (opening date) until the deadline ${fmtDate(app.dates.deadline)}. Check form, dates and emails first.` }
      : { title: "Take it offline?", confirmLabel: "Unpublish", danger: true,
          message: "The form disappears from the apply site and one-aim.org. Applications already submitted stay." }))) return;
    setBusy(true);
    await act(() => saveApplication({ ...app, published: on }), on ? "Published" : "Taken offline");
    setBusy(false);
  };
  return (
    <div class={`publish-bar ${app.published ? "is-on" : ""}`}>
      <label class="demo-switch publish-switch" style="margin:0">
        {/* The switch only moves once the change is confirmed and saved */}
        <input type="checkbox" role="switch" checked={app.published} disabled={busy || isDemoId(app.id)}
          onClick={e => { e.preventDefault(); toggle(!app.published); }} />
        <span class="demo-switch__track" aria-hidden="true"><span /></span>
        <strong>{app.published ? "Public" : "Not public (draft)"}</strong>
      </label>
      <span class="muted small">
        {app.published
          ? <>Visible on the apply site and one-aim.org from {fmtDate(app.dates.opensAt)} to {fmtDate(app.dates.deadline)}.</>
          : missing ? "Only the team can see it. Fill in all dates under “Setup & dates” before publishing." : "Only the team can see it. Publish when form, dates and emails are ready."}
      </span>
    </div>
  );
}

// ── Where the process stands ─────────────────────────────────────────────

type StepKey = "open" | "screening" | "interviews" | "final" | "finished";

/** The current step, from the dates and the applicants' statuses */
function processStep(app: Application, subs: Submission[]): { step: StepKey | "upcoming"; text: string } {
  const t = today();
  const n = (st: SubmissionStatus) => subs.filter(x => x.status === st).length;
  if (t < app.dates.opensAt) return { step: "upcoming", text: `Applications open on ${fmtDate(app.dates.opensAt)}.` };
  if (t <= app.dates.deadline) {
    return { step: "open", text: `Applications open until ${fmtDate(app.dates.deadline)}, 23:59 · ${subs.length} so far.` };
  }
  if (app.pipeline === "instant") return { step: "finished", text: `Registration closed on ${fmtDate(app.dates.deadline)} · ${n("confirmed")} registered.` };
  const fresh = n("new"), invited = n("invited");
  if (fresh) {
    const due = app.pipeline === "interview" ? app.dates.interviewsFrom : app.dates.decisionBy;
    return { step: "screening", text: `${fresh} of ${subs.length} applicants still to screen${due ? ` · ${app.pipeline === "interview" ? "interviews start" : "decisions due"} ${fmtDate(due)}` : ""}.` };
  }
  if (app.pipeline === "interview" && invited) {
    const now = nowLocal();
    const upcoming = subs.filter(x => x.status === "invited" && app.slots.find(sl => sl.id === x.slotId && sl.start >= now)).length;
    const unbooked = subs.filter(x => x.status === "invited" && !x.slotId).length;
    const interviewsLeft = upcoming > 0 || unbooked > 0 || (!!app.dates.interviewsTo && t <= app.dates.interviewsTo);
    if (interviewsLeft) {
      return { step: "interviews", text: `${invited} invited · ${upcoming} interviews ahead${unbooked ? ` · ${unbooked} not booked yet` : ""}${app.dates.interviewsTo ? ` · until ${fmtDate(app.dates.interviewsTo)}` : ""}.` };
    }
    return { step: "final", text: `Interviews done · ${invited} waiting for the final decision${app.dates.decisionBy ? ` · due ${fmtDate(app.dates.decisionBy)}` : ""}.` };
  }
  return { step: "finished", text: `Process finished · ${n("accepted")} accepted, ${n("rejected")} rejected${n("withdrawn") ? `, ${n("withdrawn")} could not attend` : ""}.` };
}

function ProcessBar({ app, subs }: { app: Application; subs: Submission[] }) {
  const steps: [StepKey, string][] = app.pipeline === "instant"
    ? [["open", "Registration open"], ["finished", "Closed"]]
    : app.pipeline === "screening"
      ? [["open", "Applications open"], ["screening", "Screening"], ["finished", "Finished"]]
      : [["open", "Applications open"], ["screening", "Screening"], ["interviews", "Interviews"], ["final", "Final decisions"], ["finished", "Finished"]];
  const { step, text } = processStep(app, subs);
  const at = step === "upcoming" ? -1 : steps.findIndex(([k]) => k === step);
  return (
    <div class="process" aria-label="Process status">
      <ol class="process__steps">
        {steps.map(([k, label], i) => (
          <li class={`process__step ${i < at ? "is-done" : i === at ? "is-current" : ""}`} aria-current={i === at ? "step" : undefined}>
            <span class="process__dot">{i < at ? "✓" : i + 1}</span>{label}
          </li>
        ))}
      </ol>
      <span class="small"><strong>{step === "upcoming" ? "Not open yet" : steps[at]?.[1]}:</strong> {text}</span>
    </div>
  );
}

/** Average of one stage's scorecards, with the number of sheets */
function StageScoreCell({ app, sub, stage }: { app: Application; sub: Submission; stage: ReviewStage }) {
  const v = applicantScore(app, sub)[stage];
  const n = sub.scoreSheets.filter(x => x.stage === stage).length;
  if (v === undefined) return <span class="muted small">Not rated</span>;
  return <span class="score-pill" title={`${n} scorecard${n > 1 ? "s" : ""}`}>{fmtScore(v)}<small>/ 5 · {n}</small></span>;
}

/** Required dates per pipeline and their order; empty object = all fine */
export function dateProblems(app: Pick<Application, "dates" | "pipeline">): Partial<Record<"decisionBy" | "interviewsFrom" | "interviewsTo" | "startsAt", string>> {
  const d = app.dates, out: Partial<Record<"decisionBy" | "interviewsFrom" | "interviewsTo" | "startsAt", string>> = {};
  const need = "Required.";
  if (app.pipeline === "interview") {
    if (!d.interviewsFrom) out.interviewsFrom = need;
    else if (d.deadline && d.interviewsFrom < d.deadline) out.interviewsFrom = "Interviews start before the deadline.";
    if (!d.interviewsTo) out.interviewsTo = need;
    else if (d.interviewsFrom && d.interviewsTo < d.interviewsFrom) out.interviewsTo = "Ends before the interviews start.";
  }
  if (app.pipeline !== "instant") {
    const after = app.pipeline === "interview" ? d.interviewsTo : d.deadline;
    if (!d.decisionBy) out.decisionBy = need;
    else if (after && d.decisionBy < after) out.decisionBy = app.pipeline === "interview" ? "Before the end of the interviews." : "Before the deadline.";
  }
  if (!d.startsAt) out.startsAt = need;
  else if (app.pipeline !== "instant" && d.decisionBy && d.startsAt < d.decisionBy) out.startsAt = "Before the final decision.";
  else if (app.pipeline === "instant" && d.deadline && d.startsAt < d.deadline) out.startsAt = "Before the registration deadline.";
  return out;
}
