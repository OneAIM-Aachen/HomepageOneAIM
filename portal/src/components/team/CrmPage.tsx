import { useEffect, useMemo, useState } from "preact/hooks";
import type { Account, Application, FileRef, Person, Submission, SubmissionStatus } from "../../lib/types";
import { actorLabel, loadEmailSettings, personalize, ROLE_LABEL, sendGroupEmail, useStore, type EmailSettings } from "../../lib/store";
import { appTitle, DEGREE_OPTIONS, fmtDate, SEMESTER_OPTIONS, STATUS_LABEL } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { act, Avatar, confirmDialog, Drawer, Field, Modal, StatusChip, useParam } from "../ui/Ui";
import { IconDownload, IconFile, IconMail, IconSearch } from "../ui/Icons";
import { Answers, FileCard, isFile, openFile } from "./Answers";

// CRM: everyone who ever applied, one profile per email address.
// (The curated internal network is NetworkPage.)
export default function CrmPage() {
  const p = useParam("p");
  return <TeamShell active="crm">{acc => <Crm acc={acc} initial={p} />}</TeamShell>;
}

type Outcome = "" | "accepted" | "rejected" | "pending";

// Filters can come from the URL (links from the Insights page)
const param = (k: string) => (typeof window === "undefined" ? "" : new URLSearchParams(location.search).get(k) ?? "");

function Crm({ acc, initial }: { acc: Account; initial: string | null }) {
  const s = useStore(x => x);
  const [mailing, setMailing] = useState(false);
  const [q, setQ] = useState("");
  const [program, setProgram] = useState(param("program"));
  const [location, setLocation] = useState(param("city"));
  const [semester, setSemester] = useState(param("round"));
  const [outcome, setOutcome] = useState<Outcome>(param("status") as Outcome);
  const [uni, setUni] = useState(param("uni"));
  const [studyProg, setStudyProg] = useState(param("study"));
  const [field, setField] = useState(param("field"));
  const [termSem, setTermSem] = useState(param("sem"));
  const [degree, setDegree] = useState(param("degree"));
  const [appId, setAppId] = useState(param("app"));
  const [teamOnly, setTeamOnly] = useState(param("team") === "1");
  const [open, setOpen] = useState<string | null>(initial);

  const rows = useMemo(() => s.people.map(p => {
    const subs = s.submissions.filter(x => x.personId === p.id).map(x => ({ sub: x, app: s.applications.find(a => a.id === x.applicationId) }))
      .filter(x => x.app);
    return { p, subs };
  }), [s]);

  const unis = [...new Set(s.people.flatMap(p => p.universities))].sort();
  const studies = [...new Set(s.people.flatMap(p => p.studyPrograms))].sort();
  const fields = [...new Set(s.studyPrograms.map(p => p.category))].sort();
  const categoryOf = (name: string) => s.studyPrograms.find(p => p.name === name)?.category ?? "Other";
  const isAccepted = (st: SubmissionStatus) => st === "accepted" || st === "confirmed";

  const filtered = rows.filter(({ p, subs }) => {
    const ql = q.toLowerCase();
    if (ql && !`${p.name} ${p.email} ${p.studyPrograms.join(" ")} ${p.universities.join(" ")}`.toLowerCase().includes(ql)) return false;
    if (uni && !p.universities.includes(uni)) return false;
    if (studyProg && !p.studyPrograms.includes(studyProg)) return false;
    if (field && !p.studyPrograms.some(x => categoryOf(x) === field)) return false;
    if (termSem && p.semester !== termSem) return false;
    if (degree && p.degree !== degree) return false;
    if (teamOnly && !s.team.some(m => m.personId === p.id)) return false;
    // Tag filters and outcome apply to the same submission, e.g. "accepted in AIM Connect Aachen"
    const match = subs.filter(({ app }) => (!appId || app!.id === appId) &&
      (!program || app!.tags.program === program) && (!location || app!.tags.location === location) && (!semester || app!.tags.semester === semester));
    if ((program || location || semester || appId) && match.length === 0) return false;
    const pool = program || location || semester || appId ? match : subs;
    if (outcome === "accepted" && !pool.some(x => isAccepted(x.sub.status))) return false;
    if (outcome === "rejected" && !pool.some(x => x.sub.status === "rejected")) return false;
    if (outcome === "pending" && !pool.some(x => x.sub.status === "new" || x.sub.status === "invited")) return false;
    return true;
  }).sort((a, b) => a.p.name.localeCompare(b.p.name));

  const exportCsv = () => {
    const head = ["Name", "Email", "Phone", "LinkedIn", "University affiliations", "Study programs", "Semester", "Degree", "Applications"];
    const lines = filtered.map(({ p, subs }) => [p.name, p.email, p.phone ?? "", p.linkedin ?? "", p.universities.join("; "), p.studyPrograms.join("; "),
      p.semester ?? "", p.degree ?? "", subs.map(x => `${appTitle(x.app!)} (${STATUS_LABEL[x.sub.status]})`).join("; ")]);
    const csv = [head, ...lines].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "oneaim-crm.csv";
    a.click();
  };

  const openRow = rows.find(r => r.p.id === open);
  const sel = (label: string, value: string, set: (v: string) => void, opts: string[]) => (
    <select class="input input--sm" style="width:auto" value={value} onChange={e => set(e.currentTarget.value)} aria-label={label}>
      <option value="">{label}</option>{opts.map(o => <option>{o}</option>)}
    </select>
  );

  return (
    <div class="stack" style="gap:20px">
      <PageHead overline="CRM" title="All applicants"
        sub="Everyone who ever applied, one profile per email address, with their full application history. The curated network is under “Network”."
        actions={<>
          <button class="btn btn--secondary" onClick={exportCsv}><IconDownload width={16} />Export CSV</button>
          <button class="btn btn--primary" disabled={!filtered.length} onClick={() => setMailing(true)}
            title="Write one email to everyone matching the current filters"><IconMail width={16} />Email {filtered.length} {filtered.length === 1 ? "person" : "people"}</button>
        </>} />
      {mailing && <GroupEmailModal people={filtered.map(r => r.p)} acc={acc} onClose={() => setMailing(false)} />}

      {appId && (
        <div class="row" style="margin-bottom:-6px">
          <span class="chip chip--blue">Application: {(() => { const x = s.applications.find(y => y.id === appId); return x ? appTitle(x) : "unknown"; })()}</span>
          <button class="btn btn--ghost btn--sm" onClick={() => setAppId("")}>Show all applications</button>
        </div>
      )}
      <div class="stats">
        <div class="card stat"><span class="stat__num">{s.people.length}</span><span class="stat__label">People</span></div>
        <div class="card stat"><span class="stat__num">{rows.filter(r => r.subs.some(x => isAccepted(x.sub.status))).length}</span><span class="stat__label">Participants</span><span class="muted small">accepted at least once</span></div>
        <div class="card stat"><span class="stat__num">{rows.filter(r => r.subs.length > 1).length}</span><span class="stat__label">Applied more than once</span></div>
        <div class="card stat"><span class="stat__num">{unis.length}</span><span class="stat__label">Universities</span></div>
      </div>

      <div class="row">
        <div style="position:relative;flex:1;min-width:220px">
          <IconSearch width={17} style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-text-muted)" />
          <input class="input input--sm" style="padding-left:36px" placeholder="Search name, email, study program…" value={q} onInput={e => setQ(e.currentTarget.value)} aria-label="Search people" />
        </div>
        {sel("All programs", program, setProgram, s.tagLists.programs)}
        {sel("All locations", location, setLocation, s.tagLists.locations)}
        {sel("All semesters", semester, setSemester, s.tagLists.semesters)}
        {sel("All universities", uni, setUni, unis)}
        {sel("All study programs", studyProg, setStudyProg, studies)}
        {sel("All fields", field, setField, fields)}
        {sel("Any semester", termSem, setTermSem, SEMESTER_OPTIONS)}
        {sel("Any degree", degree, setDegree, DEGREE_OPTIONS)}
        <label class="row small" style="gap:6px;flex-wrap:nowrap"><input type="checkbox" checked={teamOnly} onChange={e => setTeamOnly(e.currentTarget.checked)} />Team members only</label>
        <select class="input input--sm" style="width:auto" value={outcome} onChange={e => setOutcome(e.currentTarget.value as Outcome)} aria-label="Outcome">
          <option value="">Any outcome</option><option value="accepted">Accepted / confirmed</option><option value="pending">In progress</option><option value="rejected">Rejected</option>
        </select>
      </div>

      <div class="card card--flush">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Person</th><th>Study</th><th>CV</th><th>Applications</th><th>First applied</th></tr></thead>
            <tbody>
              {filtered.map(({ p, subs }) => (
                <tr class="is-clickable" onClick={() => setOpen(p.id)}>
                  <td><div class="cell-person"><Avatar name={p.name} /><div><strong>{p.name}</strong>{(() => { const m = s.team.find(t => t.personId === p.id); return m ? <span class="chip chip--purple" style="margin-left:6px" title={`${ROLE_LABEL[m.role]}, OneAIM ${m.city}`}>{m.status === "alumni" ? "Alumni" : "Team"} · {m.city}</span> : null; })()}<span class="muted small">{p.email}</span></div></div></td>
                  <td><span style="color:var(--color-text-heading)">{p.studyPrograms.join(", ") || "–"}</span><br /><span class="muted small">{p.universities.join(", ")}</span></td>
                  <td>{cvsOf(subs as Entry[]).length
                    ? <span class="chip chip--blue" title={cvsOf(subs as Entry[])[0]!.file.fileName}><IconFile width={14} />CV</span>
                    : <span class="muted small">–</span>}</td>
                  <td>
                    <div class="row" style="gap:6px">
                      {subs.map(({ sub, app }) => (
                        <span class={`chip ${isAccepted(sub.status) ? "chip--green" : sub.status === "rejected" ? "chip--gray" : "chip--blue"}`} title={`${appTitle(app!)}: ${STATUS_LABEL[sub.status]}`}>
                          {app!.tags.program.replace("AIM ", "")} · {app!.tags.location} · {app!.tags.semester}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td class="muted small">{fmtDate(p.firstSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div class="empty" style="border:none">Nobody matches these filters.</div>}
      </div>
      <p class="muted small">{filtered.length} of {s.people.length} people. Green = accepted/confirmed, blue = in progress, gray = rejected.</p>

      {openRow && <PersonDrawer person={openRow.p} subs={openRow.subs as Entry[]} onClose={() => setOpen(null)} />}
    </div>
  );
}

export type Entry = { sub: Submission; app: Application };

/** All CVs of a person, newest first (each submission can carry one). */
export function cvsOf(entries: Entry[]): { file: FileRef; entry: Entry }[] {
  return entries
    .flatMap(entry => entry.app.fields.filter(f => f.kind === "cv")
      .map(f => entry.sub.answers[f.id]).filter(isFile).map(file => ({ file, entry })))
    .sort((a, b) => b.entry.sub.submittedAt.localeCompare(a.entry.sub.submittedAt));
}

export function PersonDrawer({ person: p, subs, onClose }: { person: Person; subs: Entry[]; onClose: () => void }) {
  const info: [string, string | undefined, "link" | "mail" | undefined][] = [
    ["Email", p.email, "mail"], ["Phone", p.phone, undefined], ["LinkedIn", p.linkedin, "link"],
    ["University affiliations", p.universities.join(", ") || undefined, undefined], ["Study programs", p.studyPrograms.join(", ") || undefined, undefined],
    ["Semester", p.semester, undefined], ["Degree level", p.degree, undefined],
  ];
  const sorted = [...subs].sort((a, b) => b.sub.submittedAt.localeCompare(a.sub.submittedAt));
  const cvs = cvsOf(sorted);
  const [latest, ...older] = cvs;
  const member = useStore(x => x.team.find(m => m.personId === p.id));
  const dept = useStore(x => x.departments.find(d => d.id === member?.departmentId));

  return (
    <Drawer onClose={onClose}
      head={<div class="row" style="flex-wrap:nowrap"><Avatar name={p.name} large /><div><h2 style="font-size:1.25rem">{p.name}</h2><span class="muted small">First applied {fmtDate(p.firstSeen)} · {subs.length} application{subs.length === 1 ? "" : "s"}</span></div></div>}
      foot={<><a class="btn btn--secondary btn--sm" href={`/team/outbox?p=${p.id}`}>Emails with {p.name.split(" ")[0]}</a><span class="spacer" />
        <span class="muted small">Profile = newest answers from their applications</span></>}>

      {member && (
        <section class="team-note">
          <div style="flex:1;min-width:0">
            <span class="overline">{member.status === "alumni" ? `OneAIM alumni${member.alumniSince ? ` · left ${fmtDate(member.alumniSince)}` : ""}` : "OneAIM team"}</span>
            <p><strong style="color:var(--color-text-heading)">{member.position || (member.role === "lead" && dept ? `Team Lead | ${dept.name}` : ROLE_LABEL[member.role])}</strong> · {member.city}{dept && member.role !== "lead" ? ` · ${dept.name}` : ""}{member.memberSince ? ` · since ${member.memberSince}` : ""}</p>
          </div>
          <a class="btn btn--secondary btn--sm" href={`/team/team?member=${member.id}`}>Team profile</a>
        </section>
      )}

      <section class="stack-s">
        <h3>CV</h3>
        {latest
          ? <div class="file-card file-card--hero">
              <span class="file-card__icon"><IconFile width={24} /></span>
              <div style="flex:1;min-width:0">
                <strong>{latest.file.fileName}</strong>
                <span class="muted small">Latest · uploaded {fmtDate(latest.entry.sub.submittedAt)} with {appTitle(latest.entry.app)}</span>
              </div>
              <button class="btn btn--primary btn--sm" onClick={() => openFile(latest.file)}>Open CV</button>
            </div>
          : <p class="muted small">No CV uploaded yet. Their applications so far didn't ask for one.</p>}
        {older.length > 0 && (
          <div class="stack-s">
            <span class="muted small">Earlier CVs</span>
            {older.map(c => <FileCard file={c.file} sub={`${fmtDate(c.entry.sub.submittedAt)} · ${appTitle(c.entry.app)}`} />)}
          </div>
        )}
      </section>

      <section class="stack-s">
        <h3>Profile</h3>
        <dl class="qa" style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px">
          {info.map(([k, v, kind]) => (
            <div><dt>{k}</dt><dd>{v ? (kind === "link" ? <a href={v} target="_blank" rel="noopener">{v.replace(/^https?:\/\/(www\.)?/, "")}</a> : kind === "mail" ? <a href={`mailto:${v}`}>{v}</a> : v) : "–"}</dd></div>
          ))}
        </dl>
      </section>

      <section class="stack-s">
        <h3>Applications & answers</h3>
        <p class="muted small">Everything they submitted, newest first.</p>
        {sorted.map(({ sub, app }, i) => (
          <details class="acc" open={i === 0}>
            <summary>
              <div style="flex:1;min-width:0">
                <strong style="color:var(--color-text-heading)">{appTitle(app)}</strong>
                <div class="muted small">Applied {fmtDate(sub.submittedAt)}{sub.score ? ` · ${"★".repeat(sub.score)}` : ""}{sub.comments.length ? ` · ${sub.comments.length} comment${sub.comments.length > 1 ? "s" : ""}` : ""}</div>
              </div>
              <StatusChip status={sub.status} />
            </summary>
            <div class="acc__body">
              <Answers app={app} sub={sub} />
              {sub.comments.length > 0 && (
                <div class="stack-s">
                  <span class="overline">Team comments</span>
                  {sub.comments.map(c => <p class="small"><strong>{c.author}:</strong> {c.text}</p>)}
                </div>
              )}
              <a class="btn btn--ghost btn--sm" style="align-self:flex-start" href={`/team/application?id=${app.id}&s=${sub.id}`}>Open in application →</a>
            </div>
          </details>
        ))}
      </section>
    </Drawer>
  );
}

/** One email to everyone matching the CRM filters; each person gets their own copy. */
function GroupEmailModal({ people, acc, onClose }: { people: Person[]; acc: Account; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(`Hi {first_name},\n\n\n\nBest,\n${acc.legacy ? `Your OneAIM ${acc.city} team` : `${acc.name.split(" ")[0]}\nOneAIM ${acc.city}`}`);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { loadEmailSettings().then(setSettings).catch(() => undefined); }, []);

  const real = people.filter(p => !p.id.startsWith("demo-"));
  const demoCount = people.length - real.length;
  const sample = real[0] ?? people[0];
  const days = settings ? Math.ceil(real.length / settings.daily_limit) : 1;

  const send = async () => {
    if (!(await confirmDialog({
      title: `Send to ${real.length} ${real.length === 1 ? "person" : "people"}?`, confirmLabel: "Send emails",
      message: `Everyone gets their own email (they don't see each other).${days > 1 ? ` Because of the daily limit (${settings!.daily_limit}), sending takes about ${days} days.` : ""}${settings?.test_mode ? `\n\nTest mode is on: all emails go to ${settings.test_recipient ?? "nobody"}.` : ""}`,
    }))) return;
    setBusy(true);
    const r = await act(() => sendGroupEmail(real, subject, body, actorLabel(acc)), x => `${x.queued} emails queued. You'll find them under Emails.`);
    setBusy(false);
    if (r) onClose();
  };

  return (
    <Modal title="Email everyone in this selection" onClose={onClose} wide>
      <div class="stack">
        <div class="stack-s">
          <p class="small"><strong>{real.length} recipient{real.length === 1 ? "" : "s"}</strong>, everyone matching the current filters. Each person gets their own email.</p>
          {demoCount > 0 && <p class="muted small">{demoCount} demo people are left out (made up, they have no real address).</p>}
          <details>
            <summary class="small" style="cursor:pointer">Show recipients</summary>
            <p class="muted small" style="margin-top:6px;max-height:120px;overflow:auto">{real.map(p => `${p.name} <${p.email}>`).join(", ") || "–"}</p>
          </details>
          {settings?.test_mode && <div class="demo-banner" role="status"><span><strong>Test mode is on:</strong> all emails go to {settings.test_recipient ?? "nobody"} instead of the recipients.</span></div>}
          {days > 1 && <p class="muted small">Brevo sends up to {settings!.daily_limit} emails per day; the rest go out automatically over the next {days - 1} day{days > 2 ? "s" : ""}.</p>}
        </div>
        <Field label="Subject" required><input class="input" value={subject} onInput={e => setSubject(e.currentTarget.value)} /></Field>
        <Field label="Message" required help="{first_name} and {full_name} are filled in for each person.">
          <textarea class="input" rows={9} value={body} onInput={e => setBody(e.currentTarget.value)} />
        </Field>
        {sample && subject.trim() && (
          <div class="stack-s">
            <span class="overline">Preview for {sample.name}</span>
            <div class="card" style="padding:14px;white-space:pre-wrap;font-size:14px"><strong>{personalize(subject, sample)}</strong>{"\n\n"}{personalize(body, sample)}</div>
          </div>
        )}
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button class="btn btn--primary" disabled={busy || !real.length || !subject.trim() || !body.trim()} onClick={send}>
            {busy ? "Sending…" : `Send to ${real.length} ${real.length === 1 ? "person" : "people"}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
