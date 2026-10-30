// Participant feedback of an application: a copy of a feedback blueprint,
// a time to send the link, the email text and the answers.
// The database sends the link at that time (pg_cron, every 5 minutes) to
// every participant (accepted / confirmed) who hasn't got it yet.
import { useState } from "preact/hooks";
import type { Answer, Application, FeedbackForm, Field as FieldT, Submission } from "../../lib/types";
import {
  deleteFeedbackForm, feedbackLink, renderTemplate, saveApplication, saveFeedbackForm, sendFeedbackNow, useStore,
} from "../../lib/store";
import { fmtShort, fmtSlot, nowLocal, PLACEHOLDER_ONLY, PLACEHOLDERS } from "../../lib/fields";
import { isDemoId } from "../../lib/demo";
import { FormBuilder } from "./FormBuilder";
import { FieldAnswers } from "./Answers";
import { FormRenderer } from "../apply/FormRenderer";
import { act, Avatar, confirmDialog, Field, Modal, toast } from "../ui/Ui";

type View = "sending" | "form" | "email" | "responses";

const isParticipant = (x: Submission) => x.status === "accepted" || x.status === "confirmed";

export function FeedbackTab({ app, subs }: { app: Application; subs: Submission[] }) {
  const [view, setView] = useState<View>("sending");
  const responses = useStore(s => s.feedbackResponses.filter(r => r.applicationId === app.id));
  const demo = isDemoId(app.id);

  if (!app.feedback) return <ChooseForm app={app} demo={demo} />;

  const views: [View, string, number?][] = [
    ["sending", "Sending"], ["form", "Form", app.feedback.fields.length], ["email", "Email"], ["responses", "Answers", responses.length],
  ];
  return (
    <div class="stack">
      <div class="row">
        {views.map(([k, label, n]) => (
          <button class={`chip-btn ${view === k ? "is-active" : ""}`} onClick={() => setView(k)}>{label}{n !== undefined ? ` (${n})` : ""}</button>
        ))}
      </div>
      {view === "sending" && <Sending app={app} form={app.feedback} subs={subs} demo={demo} />}
      {view === "form" && <FormEditor app={app} form={app.feedback} answered={responses.length} demo={demo} />}
      {view === "email" && <EmailEditor app={app} demo={demo} />}
      {view === "responses" && <Responses app={app} form={app.feedback} subs={subs} />}
    </div>
  );
}

// ── No form yet: pick a feedback blueprint ───────────────────────────────

function ChooseForm({ app, demo }: { app: Application; demo: boolean }) {
  const blueprints = useStore(s => s.blueprints.filter(b => b.kind === "feedback"));
  const [bp, setBp] = useState(blueprints[0]?.id ?? "");
  const pick = blueprints.find(b => b.id === bp);
  return (
    <div class="card stack" style="max-width:760px">
      <div class="stack-s">
        <h2>Ask your participants for feedback</h2>
        <p class="muted">Pick a feedback form, adjust it if you like and set a date and time. Every participant then gets an email with a personal link to the form, and you see the answers here.</p>
      </div>
      {blueprints.length === 0
        ? <p class="muted small">No feedback forms yet. <a href="/team/blueprints">Create one under Blueprints</a>.</p>
        : <div class="grid-2">
            {blueprints.map(b => (
              <button type="button" class={`slot ${bp === b.id ? "is-active" : ""}`} onClick={() => setBp(b.id)}>
                <strong>{b.name}</strong>
                <span class="muted small">{b.fields.length} questions · {b.description || "No intro text"}</span>
              </button>
            ))}
          </div>}
      <div class="row">
        <a class="small" href="/team/blueprints">Manage feedback forms under Blueprints →</a>
        <span class="spacer" />
        <button class="btn btn--primary" disabled={!pick || demo}
          onClick={() => pick && act(() => saveFeedbackForm(app.id, { blueprintName: pick.name, intro: pick.description, fields: structuredClone(pick.fields) }), "Feedback form added")}>
          Use this form
        </button>
      </div>
      {demo && <p class="muted small">Demo application: view only.</p>}
    </div>
  );
}

// ── Sending: time, recipients, send now ──────────────────────────────────

function Sending({ app, form, subs, demo }: { app: Application; form: FeedbackForm; subs: Submission[]; demo: boolean }) {
  const outbox = useStore(s => s.outbox.filter(m => m.applicationId === app.id && m.type === "feedback"));
  const responses = useStore(s => s.feedbackResponses.filter(r => r.applicationId === app.id));
  const [sendAt, setSendAt] = useState(form.sendAt ?? (app.dates.startsAt ? `${app.dates.startsAt}T18:00` : ""));

  const participants = subs.filter(isParticipant);
  const got = new Set(outbox.filter(m => m.status !== "failed").map(m => m.submissionId));
  const answered = new Set(responses.map(r => r.submissionId));
  const waiting = participants.filter(x => !got.has(x.id) && !answered.has(x.id));
  const sent = outbox.filter(m => m.status === "sent").length;
  const queued = outbox.filter(m => m.status === "queued").length;
  const failed = outbox.filter(m => m.status === "failed").length;
  const changed = sendAt !== (form.sendAt ?? "");
  const past = !!sendAt && sendAt <= nowLocal();

  const save = (value?: string) => act(() => saveFeedbackForm(app.id, { ...form, sendAt: value }), value ? "Sending time saved" : "Sending time removed");
  const sendNow = async () => {
    const ok = await confirmDialog({
      title: "Send the feedback link now?", confirmLabel: `Send to ${waiting.length}`,
      message: `${waiting.length} participant${waiting.length === 1 ? "" : "s"} get the email with their personal link right away.`,
    });
    if (!ok) return;
    const n = await act(() => sendFeedbackNow(app.id));
    if (n !== undefined) toast(n ? `Feedback link sent to ${n}` : "Everyone has the link already");
  };

  return (
    <div class="grid-2" style="align-items:start">
      <section class="card stack">
        <div class="card__head"><h2>When to send</h2>
          {form.sentAt ? <span class="chip chip--green">Sent {fmtShort(form.sentAt)}</span>
            : form.sendAt ? <span class="chip chip--blue">Scheduled</span> : <span class="chip chip--gray">Not scheduled</span>}
        </div>
        {form.sentAt ? (
          <p class="muted small">The link went out on {fmtSlot(toLocalString(form.sentAt))}. Participants accepted later can get it with “Send now”.</p>
        ) : (
          <>
            <Field label="Send the link on" help="German time. The email goes out within 5 minutes after this time, to everyone accepted by then. Usually the last day of the program or the day after.">
              <input class="input" type="datetime-local" value={sendAt} disabled={demo} style="max-width:260px"
                onInput={e => setSendAt(e.currentTarget.value)} />
            </Field>
            {past && changed && <p class="field__error">This time is in the past. Pick a later time, or use “Send now”.</p>}
            <div class="row">
              {form.sendAt && <span class="small"><strong>Scheduled for {fmtSlot(form.sendAt)}</strong></span>}
              <span class="spacer" />
              {form.sendAt && <button class="btn btn--ghost btn--sm" disabled={demo} onClick={() => { setSendAt(""); save(undefined); }}>Remove time</button>}
              <button class="btn btn--primary btn--sm" disabled={demo || !sendAt || !changed || past} onClick={() => save(sendAt)}>Save time</button>
            </div>
          </>
        )}
      </section>

      <section class="card stack">
        <div class="card__head"><h2>Participants</h2><span class="muted small">accepted{app.pipeline === "instant" ? " / registered" : ""}</span></div>
        <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div class="stat"><span class="stat__num">{participants.length}</span><span class="stat__label">Participants</span></div>
          <div class="stat"><span class="stat__num">{got.size}</span><span class="stat__label">Got the link</span>
            <span class="muted small">{[queued && `${queued} sending`, failed && `${failed} failed`].filter(Boolean).join(" · ") || (sent ? `${sent} delivered` : "")}</span></div>
          <div class="stat"><span class="stat__num">{answered.size}</span><span class="stat__label">Answered</span></div>
        </div>
        {participants.length === 0 && <p class="muted small">No participants yet. Everyone you accept gets the link at the scheduled time.</p>}
        <div class="row">
          <span class="muted small" style="flex:1">{waiting.length ? `${waiting.length} participant${waiting.length === 1 ? " hasn't" : "s haven't"} got the link yet.` : participants.length ? "All participants have the link." : ""}</span>
          <button class="btn btn--secondary btn--sm" disabled={demo || !waiting.length || !form.fields.length} onClick={sendNow}>Send now</button>
        </div>
      </section>
    </div>
  );
}

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in local time (for fmtSlot) */
function toLocalString(iso: string) {
  const d = new Date(iso), p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Form ─────────────────────────────────────────────────────────────────

function FormEditor({ app, form, answered, demo }: { app: Application; form: FeedbackForm; answered: number; demo: boolean }) {
  const [intro, setIntro] = useState(form.intro);
  const [fields, setFields] = useState(structuredClone(form.fields));
  const [preview, setPreview] = useState(false);
  const dirty = intro !== form.intro || JSON.stringify(fields) !== JSON.stringify(form.fields);

  const remove = async () => {
    if (await confirmDialog({ title: "Remove feedback form?", danger: true, confirmLabel: "Remove",
      message: "Remove the feedback form from this application? The scheduled sending is cancelled too." }))
      act(() => deleteFeedbackForm(app.id), "Feedback form removed");
  };

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
          : `Copied from the feedback form “${form.blueprintName}”. Changes here only affect this application.`} />
      <div class="row">
        <button class="btn btn--secondary btn--sm" onClick={() => setPreview(true)}>Preview form</button>
        <span class="spacer" />
        {!answered && !form.sentAt && <button class="btn btn--ghost btn--sm" disabled={demo} onClick={remove}>Remove feedback form</button>}
      </div>
      <div class="bulkbar" style={dirty ? "" : "display:none"}>
        <strong>Unsaved form changes</strong>
        <button class="btn btn--ghost btn--sm" onClick={() => { setIntro(form.intro); setFields(structuredClone(form.fields)); }}>Discard</button>
        <button class="btn btn--primary btn--sm" disabled={!fields.length}
          onClick={() => act(() => saveFeedbackForm(app.id, { ...form, intro, fields }), "Feedback form saved")}>Save form</button>
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

// ── Email ────────────────────────────────────────────────────────────────

function EmailEditor({ app, demo }: { app: Application; demo: boolean }) {
  const [t, setT] = useState(structuredClone(app.templates.feedback));
  const dirty = JSON.stringify(t) !== JSON.stringify(app.templates.feedback);
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
          <p class="muted small">Sent automatically at the time set under “Sending”, to every participant. Each one gets a personal link, so they can answer only once.</p>
        </div>
      </div>
      <div class="bulkbar" style={dirty ? "" : "display:none"}>
        <strong>Unsaved email changes</strong>
        <button class="btn btn--ghost btn--sm" onClick={() => setT(structuredClone(app.templates.feedback))}>Discard</button>
        <button class="btn btn--primary btn--sm" disabled={missingLink}
          onClick={() => act(() => saveApplication({ ...app, templates: { ...app.templates, feedback: t } }), "Email saved")}>Save email</button>
      </div>
    </div>
  );
}

// ── Answers: summary per question and per participant ────────────────────

function Responses({ app, form, subs }: { app: Application; form: FeedbackForm; subs: Submission[] }) {
  const responses = useStore(s => s.feedbackResponses.filter(r => r.applicationId === app.id));
  const people = useStore(s => s.people);
  const outbox = useStore(s => s.outbox.filter(m => m.applicationId === app.id && m.type === "feedback"));
  const [open, setOpen] = useState<string | null>(null);
  const participants = subs.filter(x => isParticipant(x) || responses.some(r => r.submissionId === x.id));
  const name = (sub: Submission) => people.find(p => p.id === sub.personId)?.name ?? "Unknown";
  const opened = responses.find(r => r.id === open);
  const openedSub = opened && subs.find(x => x.id === opened.submissionId);

  return (
    <div class="stack">
      {responses.length === 0
        ? <div class="empty">No answers yet.{form.sentAt ? "" : " Answers show up here once the link has been sent."}</div>
        : <section class="card stack">
            <div class="card__head"><h2>Summary</h2><span class="muted small">{responses.length} of {participants.length} answered</span></div>
            {form.fields.map(f => <QuestionSummary field={f} answers={responses.map(r => r.answers[f.id])} />)}
          </section>}

      <section class="card card--flush">
        <div class="card__head" style="padding:20px 24px 0"><h2>Participants</h2></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Participant</th><th>Link</th><th>Answered</th><th></th></tr></thead>
            <tbody>
              {participants.map(x => {
                const r = responses.find(y => y.submissionId === x.id);
                const mail = outbox.find(m => m.submissionId === x.id && m.status !== "failed") ?? outbox.find(m => m.submissionId === x.id);
                return (
                  <tr class={r ? "is-clickable" : ""} onClick={() => r && setOpen(r.id)}>
                    <td><div class="cell-person"><Avatar name={name(x)} /><strong>{name(x)}</strong></div></td>
                    <td class="muted">{!mail ? "not sent yet" : mail.status === "sent" ? `sent ${fmtShort(mail.at)}` : mail.status === "queued" ? "sending…" : "sending failed"}</td>
                    <td>{r ? <span class="chip chip--green">{fmtShort(r.submittedAt)}</span> : <span class="muted">–</span>}</td>
                    <td style="text-align:right">
                      <button class="btn btn--ghost btn--sm" onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(feedbackLink(x)); toast("Personal feedback link copied"); }}>Copy link</button>
                    </td>
                  </tr>
                );
              })}
              {participants.length === 0 && <tr><td colSpan={4} class="muted">No participants yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {opened && openedSub && (
        <Modal title={`Feedback from ${name(openedSub)}`} onClose={() => setOpen(null)} wide>
          <p class="muted small">Answered {fmtShort(opened.submittedAt)}</p>
          <FieldAnswers fields={form.fields} answers={opened.answers} at={opened.submittedAt} />
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
