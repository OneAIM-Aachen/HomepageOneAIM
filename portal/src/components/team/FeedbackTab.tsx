// Participant feedback of an application: a list of feedbacks, each with a
// name, a send time, its own form (copy of a feedback blueprint), its email
// and the answers. The database sends the link at the set time (pg_cron,
// every 5 minutes) to every accepted participant who hasn't got it yet;
// "Send now" does the same right away.
import { useState } from "preact/hooks";
import type { Answer, Application, FeedbackForm, Field as FieldT, Submission } from "../../lib/types";
import {
  createFeedback, deleteFeedback, feedbackLink, renderTemplate, saveFeedback, sendFeedbackNow, useStore,
} from "../../lib/store";
import { fmtShort, fmtSlot, nowLocal, PLACEHOLDER_ONLY, PLACEHOLDERS } from "../../lib/fields";
import { isDemoId } from "../../lib/demo";
import { FormBuilder } from "./FormBuilder";
import { FieldAnswers } from "./Answers";
import { FormRenderer } from "../apply/FormRenderer";
import { act, Avatar, confirmDialog, Field, Modal, toast } from "../ui/Ui";
import { IconPlus } from "../ui/Icons";

const isParticipant = (x: Submission) => x.status === "accepted" || x.status === "confirmed";

/** Participants of this feedback: who got the link, who answered, who is still waiting */
function useReach(fb: FeedbackForm, subs: Submission[]) {
  const mine = useStore(s => s.outbox.filter(m => m.feedbackId === fb.id));
  const responses = useStore(s => s.feedbackResponses.filter(r => r.feedbackId === fb.id));
  const participants = subs.filter(isParticipant);
  const got = new Set(mine.filter(m => m.status !== "failed").map(m => m.submissionId));
  const answered = new Set(responses.map(r => r.submissionId));
  const waiting = participants.filter(x => !got.has(x.id) && !answered.has(x.id));
  return { participants, got, answered, waiting, responses, mails: mine };
}

function SendState({ fb }: { fb: FeedbackForm }) {
  if (fb.sentAt) return <span class="chip chip--green">Sent {fmtShort(fb.sentAt)}</span>;
  if (fb.sendAt) return <span class="chip chip--blue">Scheduled {fmtSlot(fb.sendAt)}</span>;
  return <span class="chip chip--gray">Not scheduled</span>;
}

async function confirmSendNow(fb: FeedbackForm, n: number) {
  const ok = await confirmDialog({
    title: `Send “${fb.name}” now?`, confirmLabel: `Send to ${n}`,
    message: `${n} accepted participant${n === 1 ? "" : "s"} get the email with their personal link right away.`,
  });
  if (!ok) return;
  const sent = await act(() => sendFeedbackNow(fb.id));
  if (sent !== undefined) toast(sent ? `Feedback link sent to ${sent}` : "Everyone has the link already");
}

export function FeedbackTab({ app, subs }: { app: Application; subs: Submission[] }) {
  const feedbacks = useStore(s => s.feedbacks.filter(f => f.applicationId === app.id));
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const demo = isDemoId(app.id);
  const participants = subs.filter(isParticipant).length;
  const opened = feedbacks.find(f => f.id === openId);

  if (opened) return <Detail app={app} fb={opened} subs={subs} demo={demo} onBack={() => setOpenId(null)} />;

  return (
    <div class="stack">
      <div class="row" style="align-items:flex-start">
        <p class="muted small" style="flex:1;margin:0">
          Feedback is only sent to the <strong>accepted participants</strong> of this application ({participants} right now).
          Each one gets a personal link by email and can answer once.
        </p>
        <button class="btn btn--primary" disabled={demo} onClick={() => setCreating(true)}><IconPlus width={18} />Set up new feedback</button>
      </div>

      {feedbacks.length === 0 ? (
        <div class="empty">No feedback set up yet. Use “Set up new feedback” to pick a form and a time.</div>
      ) : (
        <div class="card card--flush">
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>Feedback</th><th>Form</th><th>Sending</th><th>Answers</th><th></th></tr></thead>
              <tbody>
                {feedbacks.map(fb => <Row fb={fb} subs={subs} demo={demo} onOpen={() => setOpenId(fb.id)} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && <NewFeedback app={app} participants={participants} onClose={() => setCreating(false)}
        onCreated={id => { setCreating(false); if (id) setOpenId(id); }} />}
    </div>
  );
}

function Row({ fb, subs, demo, onOpen }: { fb: FeedbackForm; subs: Submission[]; demo: boolean; onOpen: () => void }) {
  const r = useReach(fb, subs);
  return (
    <tr class="is-clickable" onClick={onOpen}>
      <td><strong style="color:var(--color-text-heading)">{fb.name}</strong><br /><span class="muted small">created {fmtShort(fb.createdAt)}</span></td>
      <td>{fb.blueprintName || "–"}<br /><span class="muted small">{fb.fields.length} question{fb.fields.length === 1 ? "" : "s"}</span></td>
      <td><SendState fb={fb} />{!!fb.sentAt && r.waiting.length > 0 && <div class="muted small">{r.waiting.length} not sent yet</div>}</td>
      <td>{r.answered.size} / {r.participants.length}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn--secondary btn--sm" disabled={demo || !r.waiting.length || !fb.fields.length}
          title={r.waiting.length ? "" : "All accepted participants have the link"}
          onClick={e => { e.stopPropagation(); confirmSendNow(fb, r.waiting.length); }}>Send now</button>
        <button class="btn btn--ghost btn--sm" onClick={e => { e.stopPropagation(); onOpen(); }}>Open</button>
      </td>
    </tr>
  );
}

// ── New feedback ─────────────────────────────────────────────────────────

type When = "scheduled" | "now" | "later";

function NewFeedback({ app, participants, onClose, onCreated }: {
  app: Application; participants: number; onClose: () => void; onCreated: (openId: string | null) => void;
}) {
  const blueprints = useStore(s => s.blueprints.filter(b => b.kind === "feedback"));
  const count = useStore(s => s.feedbacks.filter(f => f.applicationId === app.id).length);
  const [name, setName] = useState(count ? "" : "Feedback after the program");
  const [bp, setBp] = useState(blueprints[0]?.id ?? "");
  const [when, setWhen] = useState<When>("scheduled");
  const [sendAt, setSendAt] = useState(app.dates.startsAt ? `${app.dates.startsAt}T18:00` : "");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const pick = blueprints.find(b => b.id === bp);
  // The copy of the chosen form, edited right here before it's set up
  const [intro, setIntro] = useState(pick?.description ?? "");
  const [fields, setFields] = useState(structuredClone(pick?.fields ?? []));
  const edited = !!pick && (intro !== pick.description || JSON.stringify(fields) !== JSON.stringify(pick.fields));
  const choose = async (id: string) => {
    const b = blueprints.find(x => x.id === id);
    if (!b || id === bp) return;
    if (edited && !(await confirmDialog({ title: "Use another form?", confirmLabel: "Use other form",
      message: `Your changes to “${pick!.name}” are discarded.` }))) return;
    setBp(id); setIntro(b.description); setFields(structuredClone(b.fields));
  };
  const past = when === "scheduled" && !!sendAt && sendAt <= nowLocal();
  const valid = name.trim() && pick && fields.length > 0 && fields.every(f => f.label.trim())
    && (when !== "scheduled" || (sendAt && !past)) && (when !== "now" || participants > 0);

  const create = async () => {
    if (!pick) return;
    setBusy(true);
    const id = await act(() => createFeedback({
      applicationId: app.id, name, blueprintName: pick.name, intro, fields,
      subject: app.templates.feedback.subject, body: app.templates.feedback.body,
      sendAt: when === "scheduled" ? sendAt : undefined,
    }), when === "now" ? undefined : "Feedback set up");
    if (!id) { setBusy(false); return; }
    if (when === "now") {
      const n = await act(() => sendFeedbackNow(id));
      if (n !== undefined) toast(`Feedback link sent to ${n} participant${n === 1 ? "" : "s"}`);
      onCreated(null);
    } else onCreated(id);
  };

  return (
    <Modal title="Set up new feedback" onClose={onClose} wide>
      <Field label="Name" required help="For you and the participants, e.g. “Feedback after week 1” or “Final feedback”.">
        <input class="input" value={name} onInput={e => setName(e.currentTarget.value)} autoFocus />
      </Field>
      <div class="stack-s">
        <span class="field__label">Form<span class="req">*</span></span>
        <span class="field__help">Pick a feedback form from Blueprints and adjust it below. Changes only affect this feedback, not the blueprint.</span>
        {blueprints.length === 0
          ? <p class="muted small">No feedback forms yet. <a href="/team/blueprints">Create one under Blueprints</a>.</p>
          : <div class="grid-2">
              {blueprints.map(b => (
                <button type="button" class={`slot ${bp === b.id ? "is-active" : ""}`} onClick={() => choose(b.id)}>
                  <strong>{b.name}</strong>
                  <span class="muted small">{b.fields.length} questions · {b.description || "No intro text"}</span>
                </button>
              ))}
            </div>}
      </div>
      {pick && (
        <div class="stack-s feedback-setup__form">
          <div class="row">
            <span class="field__label" style="flex:1">Questions{edited && <span class="muted small" style="font-weight:400"> · changed</span>}</span>
            <button type="button" class="btn btn--secondary btn--sm" onClick={() => setPreview(true)}>Preview</button>
            {edited && <button type="button" class="btn btn--ghost btn--sm" onClick={() => { setIntro(pick.description); setFields(structuredClone(pick.fields)); }}>Reset to “{pick.name}”</button>}
          </div>
          <Field label="Intro text" help="Shown above the questions.">
            <textarea class="input" style="min-height:60px" value={intro} onInput={e => setIntro(e.currentTarget.value)} />
          </Field>
          <FormBuilder fields={fields} onChange={setFields} feedback />
          {!fields.length && <span class="field__error">Add at least one question.</span>}
        </div>
      )}
      <div class="stack-s">
        <span class="field__label">When to send</span>
        <label class="check"><input type="radio" name="when" checked={when === "scheduled"} onChange={() => setWhen("scheduled")} />
          <span><strong>At a date and time</strong></span></label>
        {when === "scheduled" && (
          <div style="padding-left:28px" class="stack-s">
            <input class="input" type="datetime-local" style="max-width:260px" value={sendAt} onInput={e => setSendAt(e.currentTarget.value)} aria-label="Send on" />
            <span class="field__help">German time. Goes out within 5 minutes after this time, to everyone accepted by then.</span>
            {past && <span class="field__error">This time is in the past.</span>}
          </div>
        )}
        <label class="check"><input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} />
          <span><strong>Send now</strong> <span class="muted small">to the {participants} accepted participant{participants === 1 ? "" : "s"}, with the questions above</span></span></label>
        <label class="check"><input type="radio" name="when" checked={when === "later"} onChange={() => setWhen("later")} />
          <span><strong>Not yet</strong> <span class="muted small">set a time or send it later</span></span></label>
      </div>
      <p class="muted small">Only the accepted participants of this application get the link.</p>
      <div class="row" style="justify-content:flex-end">
        <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button class="btn btn--primary" disabled={!valid || busy} onClick={create}>{when === "now" ? `Set up & send to ${participants}` : "Set up feedback"}</button>
      </div>
      {preview && (
        <Modal title="Feedback form preview" onClose={() => setPreview(false)} wide>
          {intro && <p style="white-space:pre-line">{intro}</p>}
          <FormRenderer fields={fields} preview consent={false} submitLabel="Send feedback" />
        </Modal>
      )}
    </Modal>
  );
}

// ── One feedback ─────────────────────────────────────────────────────────

type View = "settings" | "form" | "email" | "answers";

function Detail({ app, fb, subs, demo, onBack }: { app: Application; fb: FeedbackForm; subs: Submission[]; demo: boolean; onBack: () => void }) {
  const [view, setView] = useState<View>("settings");
  const answers = useStore(s => s.feedbackResponses.filter(r => r.feedbackId === fb.id).length);
  const views: [View, string, number?][] = [["settings", "Name & sending"], ["form", "Form", fb.fields.length], ["email", "Email"], ["answers", "Answers", answers]];
  return (
    <div class="stack">
      <div class="row">
        <button class="link-btn small" onClick={onBack}>← All feedback</button>
      </div>
      <div class="row">
        <h2 style="margin:0">{fb.name}</h2>
        <SendState fb={fb} />
      </div>
      <div class="row">
        {views.map(([k, label, n]) => (
          <button class={`chip-btn ${view === k ? "is-active" : ""}`} onClick={() => setView(k)}>{label}{n !== undefined ? ` (${n})` : ""}</button>
        ))}
      </div>
      {view === "settings" && <Settings fb={fb} subs={subs} demo={demo} onDeleted={onBack} />}
      {view === "form" && <FormEditor fb={fb} answered={answers} demo={demo} />}
      {view === "email" && <EmailEditor app={app} fb={fb} demo={demo} />}
      {view === "answers" && <Answers fb={fb} subs={subs} />}
    </div>
  );
}

function Settings({ fb, subs, demo, onDeleted }: { fb: FeedbackForm; subs: Submission[]; demo: boolean; onDeleted: () => void }) {
  const r = useReach(fb, subs);
  const [name, setName] = useState(fb.name);
  const [sendAt, setSendAt] = useState(fb.sendAt ?? "");
  const changed = name.trim() !== fb.name || sendAt !== (fb.sendAt ?? "");
  const past = !!sendAt && sendAt !== fb.sendAt && sendAt <= nowLocal();

  const remove = async () => {
    if (await confirmDialog({
      title: "Delete feedback?", danger: true, confirmLabel: "Delete",
      message: r.answered.size
        ? `Delete “${fb.name}”? The ${r.answered.size} answer${r.answered.size === 1 ? "" : "s"} are deleted too.`
        : `Delete “${fb.name}”?${fb.sendAt && !fb.sentAt ? " The scheduled sending is cancelled." : ""}`,
    })) { const ok = await act(() => deleteFeedback(fb.id), "Feedback deleted"); if (ok !== undefined) onDeleted(); }
  };

  return (
    <div class="grid-2" style="align-items:start">
      <section class="card stack">
        <Field label="Name" required>
          <input class="input" value={name} disabled={demo} onInput={e => setName(e.currentTarget.value)} />
        </Field>
        {fb.sentAt ? (
          <p class="muted small">Sent on {fmtSlot(localOf(fb.sentAt))}. Participants accepted later can get it with “Send now”.</p>
        ) : (
          <Field label="Send on" help="German time. Goes out within 5 minutes after this time, to everyone accepted by then. Leave empty to send by hand.">
            <div class="row" style="flex-wrap:nowrap">
              <input class="input" type="datetime-local" value={sendAt} disabled={demo} style="max-width:260px" onInput={e => setSendAt(e.currentTarget.value)} />
              {sendAt && <button class="btn btn--ghost btn--sm" disabled={demo} onClick={() => setSendAt("")}>Clear</button>}
            </div>
          </Field>
        )}
        {past && <p class="field__error">This time is in the past. Pick a later time, or use “Send now”.</p>}
        <div class="row">
          <button class="btn btn--ghost btn--sm" disabled={demo} onClick={remove}>Delete feedback</button>
          <span class="spacer" />
          <button class="btn btn--primary btn--sm" disabled={demo || !changed || !name.trim() || past}
            onClick={() => act(() => saveFeedback({ ...fb, name, sendAt: fb.sentAt ? fb.sendAt : sendAt || undefined }), "Saved")}>Save</button>
        </div>
      </section>

      <section class="card stack">
        <div class="card__head"><h2>Accepted participants</h2></div>
        <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div class="stat"><span class="stat__num">{r.participants.length}</span><span class="stat__label">Participants</span></div>
          <div class="stat"><span class="stat__num">{r.got.size}</span><span class="stat__label">Got the link</span></div>
          <div class="stat"><span class="stat__num">{r.answered.size}</span><span class="stat__label">Answered</span></div>
        </div>
        <p class="muted small">Only accepted participants get this feedback. Rejected or withdrawn applicants never do.</p>
        <div class="row">
          <span class="muted small" style="flex:1">{r.waiting.length ? `${r.waiting.length} participant${r.waiting.length === 1 ? " hasn't" : "s haven't"} got the link yet.` : r.participants.length ? "All participants have the link." : "No accepted participants yet."}</span>
          <button class="btn btn--secondary btn--sm" disabled={demo || !r.waiting.length || !fb.fields.length} onClick={() => confirmSendNow(fb, r.waiting.length)}>Send now</button>
        </div>
      </section>
    </div>
  );
}

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in local time (for fmtSlot) */
function localOf(iso: string) {
  const d = new Date(iso), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function FormEditor({ fb, answered, demo }: { fb: FeedbackForm; answered: number; demo: boolean }) {
  const [intro, setIntro] = useState(fb.intro);
  const [fields, setFields] = useState(structuredClone(fb.fields));
  const [preview, setPreview] = useState(false);
  const dirty = intro !== fb.intro || JSON.stringify(fields) !== JSON.stringify(fb.fields);

  return (
    <div class="stack">
      <div class="card stack-s">
        <Field label="Intro text" help="Shown above the questions.">
          <textarea class="input" style="min-height:70px" value={intro} disabled={demo} onInput={e => setIntro(e.currentTarget.value)} />
        </Field>
      </div>
      <FormBuilder fields={fields} onChange={setFields} readOnly={demo} feedback
        note={answered
          ? `${answered} participant${answered === 1 ? " has" : "s have"} already answered. You can still fix typos or add optional questions, but avoid removing questions: their answers are hidden then.`
          : `Copied from the feedback form “${fb.blueprintName}”. Changes here only affect this feedback.`} />
      <div class="row"><button class="btn btn--secondary btn--sm" onClick={() => setPreview(true)}>Preview form</button></div>
      <div class="bulkbar" style={dirty ? "" : "display:none"}>
        <strong>Unsaved form changes</strong>
        <button class="btn btn--ghost btn--sm" onClick={() => { setIntro(fb.intro); setFields(structuredClone(fb.fields)); }}>Discard</button>
        <button class="btn btn--primary btn--sm" disabled={!fields.length}
          onClick={() => act(() => saveFeedback({ ...fb, intro, fields }), "Form saved")}>Save form</button>
      </div>
      {preview && (
        <Modal title="Feedback form preview" onClose={() => setPreview(false)} wide>
          {intro && <p style="white-space:pre-line">{intro}</p>}
          <FormRenderer fields={fields} preview consent={false} submitLabel="Send feedback" />
        </Modal>
      )}
    </div>
  );
}

function EmailEditor({ app, fb, demo }: { app: Application; fb: FeedbackForm; demo: boolean }) {
  const [t, setT] = useState({ subject: fb.subject, body: fb.body });
  const dirty = t.subject !== fb.subject || t.body !== fb.body;
  const sample = { name: "Alex Example" };
  const missingLink = !t.body.includes("{feedback_link}");
  return (
    <div class="stack">
      <div class="grid-2" style="align-items:start">
        <div class="card stack">
          <Field label="Subject"><input class="input" value={t.subject} disabled={demo} onInput={e => setT({ ...t, subject: e.currentTarget.value })} /></Field>
          <Field label="Message" error={missingLink ? "The message needs {feedback_link}, otherwise participants can't open the form." : undefined}>
            <textarea class="input" style="min-height:240px" value={t.body} disabled={demo} onInput={e => setT({ ...t, body: e.currentTarget.value })} />
          </Field>
          <div class="stack-s">
            <span class="field__help">Placeholders, click to insert:</span>
            <div class="row" style="gap:6px">
              {PLACEHOLDERS.filter(p => !PLACEHOLDER_ONLY[p] || PLACEHOLDER_ONLY[p]!.includes("feedback")).map(p => (
                <button class="chip chip--outline mono" style="cursor:pointer" disabled={demo} onClick={() => setT({ ...t, body: t.body + p })}>{p}</button>
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
              <span><span class="muted">Subject:</span> <strong>{renderTemplate(t.subject, app, sample)}</strong></span>
            </div>
            <div class="mail__body">{renderTemplate(t.body, app, sample)}</div>
          </div>
          <p class="muted small">Sent to every accepted participant, each with a personal link, so they can answer only once.</p>
        </div>
      </div>
      <div class="bulkbar" style={dirty ? "" : "display:none"}>
        <strong>Unsaved email changes</strong>
        <button class="btn btn--ghost btn--sm" onClick={() => setT({ subject: fb.subject, body: fb.body })}>Discard</button>
        <button class="btn btn--primary btn--sm" disabled={missingLink || !t.subject.trim()}
          onClick={() => act(() => saveFeedback({ ...fb, ...t }), "Email saved")}>Save email</button>
      </div>
    </div>
  );
}

// ── Answers: summary per question and per participant ────────────────────

function Answers({ fb, subs }: { fb: FeedbackForm; subs: Submission[] }) {
  const r = useReach(fb, subs);
  const people = useStore(s => s.people);
  const [open, setOpen] = useState<string | null>(null);
  const list = subs.filter(x => isParticipant(x) || r.answered.has(x.id));
  const name = (sub: Submission) => people.find(p => p.id === sub.personId)?.name ?? "Unknown";
  const opened = r.responses.find(x => x.id === open);
  const openedSub = opened && subs.find(x => x.id === opened.submissionId);

  return (
    <div class="stack">
      {r.responses.length === 0
        ? <div class="empty">No answers yet.{fb.sentAt ? "" : " Answers show up here once the link has been sent."}</div>
        : <section class="card stack">
            <div class="card__head"><h2>Summary</h2><span class="muted small">{r.responses.length} of {r.participants.length} answered</span></div>
            {fb.fields.map(f => <QuestionSummary field={f} answers={r.responses.map(x => x.answers[f.id])} />)}
          </section>}

      <section class="card card--flush">
        <div class="card__head" style="padding:20px 24px 0"><h2>Participants</h2></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Participant</th><th>Link</th><th>Answered</th><th></th></tr></thead>
            <tbody>
              {list.map(x => {
                const resp = r.responses.find(y => y.submissionId === x.id);
                const got = r.got.has(x.id);
                return (
                  <tr class={resp ? "is-clickable" : ""} onClick={() => resp && setOpen(resp.id)}>
                    <td><div class="cell-person"><Avatar name={name(x)} /><strong>{name(x)}</strong></div></td>
                    <td class="muted">{got || resp ? "sent" : "not sent yet"}</td>
                    <td>{resp ? <span class="chip chip--green">{fmtShort(resp.submittedAt)}</span> : <span class="muted">–</span>}</td>
                    <td style="text-align:right">
                      <button class="btn btn--ghost btn--sm" onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(feedbackLink(x, fb.id)); toast("Personal feedback link copied"); }}>Copy link</button>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={4} class="muted">No accepted participants yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {opened && openedSub && (
        <Modal title={`Feedback from ${name(openedSub)}`} onClose={() => setOpen(null)} wide>
          <p class="muted small">Answered {fmtShort(opened.submittedAt)}</p>
          <FieldAnswers fields={fb.fields} answers={opened.answers} at={opened.submittedAt} />
        </Modal>
      )}
    </div>
  );
}

function QuestionSummary({ field: f, answers }: { field: FieldT; answers: Answer[] }) {
  const given = answers.filter(v => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length));
  const choice = f.kind === "single" || f.kind === "dropdown" || f.kind === "multi" || f.kind === "yesno";
  let body;
  if (choice) {
    const values = given.flatMap(v => (f.kind === "yesno" ? [v ? "Yes" : "No"] : Array.isArray(v) ? v.map(String) : [String(v)]));
    const options = f.kind === "yesno" ? ["Yes", "No"] : [...(f.options ?? []), ...new Set(values.filter(v => !f.options?.includes(v)))];
    body = (
      <div class="stack-s">
        {options.map(o => {
          const n = values.filter(v => v === o).length;
          const pct = given.length ? Math.round((n / given.length) * 100) : 0;
          return (
            <div class="row" style="gap:10px;flex-wrap:nowrap">
              <span class="small" style="width:38%;min-width:0">{o}</span>
              <span style="flex:1;height:10px;border-radius:6px;background:var(--color-border-subtle, #E5E9F2);overflow:hidden">
                <span style={`display:block;height:100%;width:${pct}%;background:var(--color-brand-blue)`} />
              </span>
              <span class="small muted" style="width:70px;text-align:right">{n} · {pct}%</span>
            </div>
          );
        })}
      </div>
    );
  } else if (f.kind === "number") {
    const nums = given.map(Number).filter(n => !Number.isNaN(n));
    body = <p class="small">Average <strong>{nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "–"}</strong></p>;
  } else {
    body = given.length
      ? <ul class="stack-s" style="margin:0;padding-left:18px">{given.map(v => <li class="small" style="white-space:pre-line">{String(v)}</li>)}</ul>
      : <p class="muted small">No answers.</p>;
  }
  return (
    <div class="stack-s" style="padding-top:12px;border-top:1px solid var(--color-border-subtle, #E5E9F2)">
      <strong style="color:var(--color-text-heading)">{f.label}</strong>
      <span class="muted small">{given.length} answer{given.length === 1 ? "" : "s"}</span>
      {body}
    </div>
  );
}
