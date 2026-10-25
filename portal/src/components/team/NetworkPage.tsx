import { useMemo, useState } from "preact/hooks";
import type { Application, FileRef, Person, Submission, SubmissionStatus } from "../../lib/types";
import { useStore } from "../../lib/store";
import { appTitle, fmtDate, STATUS_LABEL } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { Avatar, Drawer, StatusChip, useParam } from "../ui/Ui";
import { IconDownload, IconFile, IconSearch } from "../ui/Icons";
import { Answers, FileCard, isFile, openFile } from "./Answers";

export default function NetworkPage() {
  const p = useParam("p");
  return <TeamShell active="network">{() => <Network initial={p} />}</TeamShell>;
}

type Outcome = "" | "accepted" | "rejected" | "pending";

function Network({ initial }: { initial: string | null }) {
  const s = useStore(x => x);
  const [q, setQ] = useState("");
  const [program, setProgram] = useState("");
  const [location, setLocation] = useState("");
  const [semester, setSemester] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("");
  const [uni, setUni] = useState("");
  const [open, setOpen] = useState<string | null>(initial);

  const rows = useMemo(() => s.people.map(p => {
    const subs = s.submissions.filter(x => x.personId === p.id).map(x => ({ sub: x, app: s.applications.find(a => a.id === x.applicationId) }))
      .filter(x => x.app);
    return { p, subs };
  }), [s]);

  const unis = [...new Set(s.people.map(p => p.university).filter(Boolean))].sort() as string[];
  const isAccepted = (st: SubmissionStatus) => st === "accepted" || st === "confirmed";

  const filtered = rows.filter(({ p, subs }) => {
    const ql = q.toLowerCase();
    if (ql && !`${p.name} ${p.email} ${p.studyProgram ?? ""} ${p.university ?? ""}`.toLowerCase().includes(ql)) return false;
    if (uni && p.university !== uni) return false;
    // Tag filters and outcome apply to the same submission, e.g. "accepted in AIM Connect Aachen"
    const match = subs.filter(({ app }) =>
      (!program || app!.tags.program === program) && (!location || app!.tags.location === location) && (!semester || app!.tags.semester === semester));
    if ((program || location || semester) && match.length === 0) return false;
    const pool = program || location || semester ? match : subs;
    if (outcome === "accepted" && !pool.some(x => isAccepted(x.sub.status))) return false;
    if (outcome === "rejected" && !pool.some(x => x.sub.status === "rejected")) return false;
    if (outcome === "pending" && !pool.some(x => x.sub.status === "new" || x.sub.status === "invited")) return false;
    return true;
  }).sort((a, b) => a.p.name.localeCompare(b.p.name));

  const exportCsv = () => {
    const head = ["Name", "Email", "Phone", "LinkedIn", "University", "Study program", "Semester", "Degree", "Applications"];
    const lines = filtered.map(({ p, subs }) => [p.name, p.email, p.phone ?? "", p.linkedin ?? "", p.university ?? "", p.studyProgram ?? "",
      p.semester ?? "", p.degree ?? "", subs.map(x => `${appTitle(x.app!)} (${STATUS_LABEL[x.sub.status]})`).join("; ")]);
    const csv = [head, ...lines].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "oneaim-network.csv";
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
      <PageHead overline="Network" title="Network database"
        sub="Everyone who ever applied, one profile per email address, with their full application history."
        actions={<button class="btn btn--secondary" onClick={exportCsv}><IconDownload width={16} />Export CSV</button>} />

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
        <select class="input input--sm" style="width:auto" value={outcome} onChange={e => setOutcome(e.currentTarget.value as Outcome)} aria-label="Outcome">
          <option value="">Any outcome</option><option value="accepted">Accepted / confirmed</option><option value="pending">In progress</option><option value="rejected">Rejected</option>
        </select>
      </div>

      <div class="card card--flush">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Person</th><th>Study</th><th>CV</th><th>Applications</th><th>In network since</th></tr></thead>
            <tbody>
              {filtered.map(({ p, subs }) => (
                <tr class="is-clickable" onClick={() => setOpen(p.id)}>
                  <td><div class="cell-person"><Avatar name={p.name} /><div><strong>{p.name}</strong><span class="muted small">{p.email}</span></div></div></td>
                  <td><span style="color:var(--color-text-heading)">{p.studyProgram ?? "–"}</span><br /><span class="muted small">{p.university ?? ""}</span></td>
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

type Entry = { sub: Submission; app: Application };

/** All CVs of a person, newest first (each submission can carry one). */
export function cvsOf(entries: Entry[]): { file: FileRef; entry: Entry }[] {
  return entries
    .flatMap(entry => entry.app.fields.filter(f => f.kind === "cv")
      .map(f => entry.sub.answers[f.id]).filter(isFile).map(file => ({ file, entry })))
    .sort((a, b) => b.entry.sub.submittedAt.localeCompare(a.entry.sub.submittedAt));
}

function PersonDrawer({ person: p, subs, onClose }: { person: Person; subs: Entry[]; onClose: () => void }) {
  const info: [string, string | undefined, "link" | "mail" | undefined][] = [
    ["Email", p.email, "mail"], ["Phone", p.phone, undefined], ["LinkedIn", p.linkedin, "link"],
    ["University", p.university, undefined], ["Study program", p.studyProgram, undefined],
    ["Semester", p.semester, undefined], ["Degree level", p.degree, undefined],
  ];
  const sorted = [...subs].sort((a, b) => b.sub.submittedAt.localeCompare(a.sub.submittedAt));
  const cvs = cvsOf(sorted);
  const [latest, ...older] = cvs;

  return (
    <Drawer onClose={onClose}
      head={<div class="row" style="flex-wrap:nowrap"><Avatar name={p.name} large /><div><h2 style="font-size:1.25rem">{p.name}</h2><span class="muted small">In the network since {fmtDate(p.firstSeen)} · {subs.length} application{subs.length === 1 ? "" : "s"}</span></div></div>}
      foot={<><a class="btn btn--secondary btn--sm" href={`/team/outbox?p=${p.id}`}>Emails with {p.name.split(" ")[0]}</a><span class="spacer" />
        <span class="muted small">Profile = newest answers from their applications</span></>}>

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
