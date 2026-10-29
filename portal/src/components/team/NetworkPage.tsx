// Network: the curated OneAIM network. Only people who were accepted in an
// application with a selection (screening, or screening + interview),
// current team members and team alumni. Instant registrations don't count.
// (Everyone who ever applied is in the CRM.)
import { useMemo, useState } from "preact/hooks";
import type { Account, Person, TeamMember } from "../../lib/types";
import { useStore } from "../../lib/store";
import { appTitle } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { Avatar, useParam } from "../ui/Ui";
import { IconExternal, IconSearch } from "../ui/Icons";
import { PersonDrawer, type Entry } from "./CrmPage";
import { MemberDrawer, subtitle } from "./MemberDrawer";

export default function NetworkPage() {
  const p = useParam("p");
  return <TeamShell active="network">{acc => <Network acc={acc} initial={p} />}</TeamShell>;
}

type Who = "" | "participants" | "team" | "alumni";

interface Row {
  key: string;
  name: string;
  email?: string;
  photo?: string;
  linkedin?: string;
  person?: Person;
  member?: TeamMember;
  /** Accepted after a selection (screening or screening + interview) */
  participations: Entry[];
  universities: string[];
  studyPrograms: string[];
}

function Network({ acc, initial }: { acc: Account; initial: string | null }) {
  const s = useStore(x => x);
  const [q, setQ] = useState("");
  const [who, setWho] = useState<Who>("");
  const [city, setCity] = useState("");
  const [program, setProgram] = useState("");
  const [semester, setSemester] = useState("");
  const [uni, setUni] = useState("");
  const [study, setStudy] = useState("");
  const [open, setOpen] = useState<string | null>(initial);

  const rows = useMemo(() => {
    const memberOf = new Map(s.team.filter(m => m.personId).map(m => [m.personId!, m]));
    const out: Row[] = [];
    for (const p of s.people) {
      const participations = s.submissions
        .filter(x => x.personId === p.id && x.status === "accepted")
        .map(x => ({ sub: x, app: s.applications.find(a => a.id === x.applicationId)! }))
        .filter(x => x.app && x.app.pipeline !== "instant");
      const member = memberOf.get(p.id);
      if (!participations.length && !member) continue;
      out.push({
        key: p.id, name: p.name, email: p.email, photo: member?.photo, linkedin: p.linkedin ?? member?.linkedin, person: p, member,
        participations, universities: p.universities, studyPrograms: p.studyPrograms,
      });
    }
    // Team members and alumni without an email yet have no CRM profile
    for (const m of s.team.filter(x => !x.personId)) {
      out.push({ key: m.id, name: m.name, photo: m.photo, linkedin: m.linkedin, member: m, participations: [], universities: [], studyPrograms: [] });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [s]);

  const isTeam = (r: Row) => r.member?.status === "active";
  const isAlumni = (r: Row) => r.member?.status === "alumni";
  const unis = [...new Set(rows.flatMap(r => r.universities))].sort();
  const studies = [...new Set(rows.flatMap(r => r.studyPrograms))].sort();

  const filtered = rows.filter(r => {
    const ql = q.trim().toLowerCase();
    if (ql && !`${r.name} ${r.email ?? ""} ${r.studyPrograms.join(" ")} ${r.universities.join(" ")}`.toLowerCase().includes(ql)) return false;
    if (who === "participants" && !r.participations.length) return false;
    if (who === "team" && !isTeam(r)) return false;
    if (who === "alumni" && !isAlumni(r)) return false;
    if (uni && !r.universities.includes(uni)) return false;
    if (study && !r.studyPrograms.includes(study)) return false;
    if (city && r.member?.city !== city && !r.participations.some(x => x.app.tags.location === city)) return false;
    if ((program || semester) && !r.participations.some(x => (!program || x.app.tags.program === program) && (!semester || x.app.tags.semester === semester))) return false;
    return true;
  });

  const openRow = rows.find(r => r.key === open) ?? (() => {
    // Old links (/team/network?p=…) to someone who is only in the CRM
    const p = s.people.find(x => x.id === open);
    return p ? { key: p.id, name: p.name, person: p, participations: [], universities: [], studyPrograms: [] } as Row : undefined;
  })();
  const sel = (label: string, value: string, set: (v: string) => void, opts: string[]) => (
    <select class="input input--sm" style="width:auto" value={value} onChange={e => set(e.currentTarget.value)} aria-label={label}>
      <option value="">{label}</option>{opts.map(o => <option>{o}</option>)}
    </select>
  );
  const whoBtn = (v: Who, text: string, n: number) => (
    <button class={`chip-btn ${who === v ? "is-active" : ""}`} onClick={() => setWho(v)}>{text} <span class="muted">{n}</span></button>
  );
  const nParticipants = rows.filter(r => r.participations.length).length;
  const nTeam = rows.filter(isTeam).length;
  const nAlumni = rows.filter(isAlumni).length;

  return (
    <div class="stack" style="gap:20px">
      <PageHead overline="Network" title="OneAIM network"
        sub="People who were accepted after a selection (screening, or screening and interview), our team and our alumni. Everyone who ever applied is in the CRM." />

      <div class="stats">
        <div class="card stat"><span class="stat__num">{rows.length}</span><span class="stat__label">In the network</span></div>
        <div class="card stat"><span class="stat__num">{nParticipants}</span><span class="stat__label">Participants</span><span class="muted small">accepted after a selection</span></div>
        <div class="card stat"><span class="stat__num">{nTeam}</span><span class="stat__label">Team members</span></div>
        <div class="card stat"><span class="stat__num">{nAlumni}</span><span class="stat__label">Team alumni</span></div>
      </div>

      <div class="row" style="gap:6px" role="group" aria-label="Who">
        {whoBtn("", "Everyone", rows.length)}
        {whoBtn("participants", "Participants", nParticipants)}
        {whoBtn("team", "Team", nTeam)}
        {whoBtn("alumni", "Alumni", nAlumni)}
      </div>

      <div class="row">
        <div style="position:relative;flex:1;min-width:220px">
          <IconSearch width={17} style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-text-muted)" />
          <input class="input input--sm" style="padding-left:36px" placeholder="Search name, email, study program…" value={q} onInput={e => setQ(e.currentTarget.value)} aria-label="Search network" />
        </div>
        {sel("All cities", city, setCity, s.tagLists.locations)}
        {sel("All programs", program, setProgram, s.tagLists.programs)}
        {sel("All semesters", semester, setSemester, s.tagLists.semesters)}
        {sel("All universities", uni, setUni, unis)}
        {sel("All study programs", study, setStudy, studies)}
      </div>

      <div class="card card--flush">
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Person</th><th>In the network as</th><th>Study</th><th>LinkedIn</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr class="is-clickable" onClick={() => setOpen(r.key)}>
                  <td><div class="cell-person"><Avatar name={r.name} src={r.photo} /><div><strong>{r.name}</strong><span class="muted small">{r.email ?? "No email yet"}</span></div></div></td>
                  <td>
                    <div class="row" style="gap:6px">
                      {r.member && (r.member.status === "active"
                        ? <span class="chip chip--purple">{subtitle(r.member, s.departments)} · {r.member.city}</span>
                        : <span class="chip chip--gray">Team alumni · {r.member.city}</span>)}
                      {r.participations.map(({ app }) => (
                        <span class="chip chip--green" title={appTitle(app)}>{app.tags.program.replace("AIM ", "")} · {app.tags.location} · {app.tags.semester}</span>
                      ))}
                    </div>
                  </td>
                  <td><span style="color:var(--color-text-heading)">{r.studyPrograms.join(", ") || "–"}</span><br /><span class="muted small">{r.universities.join(", ")}</span></td>
                  <td>{r.linkedin
                    ? <a href={r.linkedin} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} class="small">Profile <IconExternal width={13} /></a>
                    : <span class="muted small">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div class="empty" style="border:none">Nobody matches these filters.</div>}
      </div>
      <p class="muted small">{filtered.length} of {rows.length} people. Green = participant accepted after a selection, purple = team, gray = team alumni.</p>

      {openRow?.person && (
        <PersonDrawer person={openRow.person}
          subs={s.submissions.filter(x => x.personId === openRow.person!.id).map(x => ({ sub: x, app: s.applications.find(a => a.id === x.applicationId)! })).filter(x => x.app)}
          onClose={() => setOpen(null)} />
      )}
      {openRow && !openRow.person && openRow.member && <MemberDrawer member={openRow.member} acc={acc} onClose={() => setOpen(null)} />}
    </div>
  );
}
