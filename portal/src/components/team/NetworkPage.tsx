// Network: the curated OneAIM network. Only people who were accepted in an
// application with a selection (screening, or screening + interview),
// current team members and team alumni. Instant registrations don't count.
// (Everyone who ever applied, with all details, is in the CRM.)
//
// A network profile deliberately shows only: name, photo, contact data,
// studies, the OneAIM programs/events they took part in and their team
// history. No emails, CVs, answers, comments or declined applications.
// networkProfiles() is the one place that decides these fields; when
// network members get their own access, the same list becomes a database
// function so nothing else can reach them. Team accounts can jump to the
// full CRM profile from here.
import { useMemo, useState } from "preact/hooks";
import type { RoleEntry, State, TeamMember } from "../../lib/types";
import { useStore } from "../../lib/store";
import { appTitle } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { Avatar, Drawer, useParam } from "../ui/Ui";
import { IconExternal, IconSearch } from "../ui/Icons";
import { fmtMonth, roleLabel, subtitle } from "./MemberDrawer";

export default function NetworkPage() {
  const p = useParam("p");
  return <TeamShell active="network">{() => <Network initial={p} />}</TeamShell>;
}

interface Participation {
  title: string;
  program: string;
  city: string;
  semester: string;
  /** Event without selection (instant registration) */
  event: boolean;
}

export interface NetworkProfile {
  key: string;
  name: string;
  photo?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  universities: string[];
  studyPrograms: string[];
  semester?: string;
  degree?: string;
  /** Accepted / confirmed only, newest first */
  participations: Participation[];
  team?: { status: TeamMember["status"]; city: string; label: string; alumniSince?: string; history: RoleEntry[] };
  /** Team area only: links to the full CRM profile and the team profile */
  personId?: string;
  memberId?: string;
}

/** Everyone in the network, reduced to the fields a network profile may show. */
export function networkProfiles(s: State): NetworkProfile[] {
  const memberOf = new Map(s.team.filter(m => m.personId).map(m => [m.personId!, m]));
  const team = (m: TeamMember) => ({
    status: m.status, city: m.city, label: subtitle(m, s.departments), alumniSince: m.alumniSince, history: m.history,
  });
  const out: NetworkProfile[] = [];
  for (const p of s.people) {
    const taken = s.submissions
      .filter(x => x.personId === p.id && (x.status === "accepted" || x.status === "confirmed"))
      .map(x => s.applications.find(a => a.id === x.applicationId))
      .filter(a => !!a)
      .sort((a, b) => b!.dates.opensAt.localeCompare(a!.dates.opensAt));
    const member = memberOf.get(p.id);
    // In the network: accepted after a selection, or (former) team member
    if (!taken.some(a => a!.pipeline !== "instant") && !member) continue;
    out.push({
      key: p.id, name: p.name, photo: member?.photo, email: p.email, phone: p.phone, linkedin: p.linkedin ?? member?.linkedin,
      universities: p.universities, studyPrograms: p.studyPrograms, semester: p.semester, degree: p.degree,
      participations: taken.map(a => ({
        title: appTitle(a!), program: a!.tags.program, city: a!.tags.location, semester: a!.tags.semester, event: a!.pipeline === "instant",
      })),
      team: member && team(member), personId: p.id, memberId: member?.id,
    });
  }
  // Team members and alumni without an email yet have no CRM profile
  for (const m of s.team.filter(x => !x.personId)) {
    out.push({
      key: m.id, name: m.name, photo: m.photo, linkedin: m.linkedin, universities: [], studyPrograms: [],
      participations: [], team: team(m), memberId: m.id,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

type Who = "" | "participants" | "team" | "alumni";

function Network({ initial }: { initial: string | null }) {
  const s = useStore(x => x);
  const [q, setQ] = useState("");
  const [who, setWho] = useState<Who>("");
  const [city, setCity] = useState("");
  const [program, setProgram] = useState("");
  const [semester, setSemester] = useState("");
  const [uni, setUni] = useState("");
  const [study, setStudy] = useState("");
  const [open, setOpen] = useState<string | null>(initial);

  const rows = useMemo(() => networkProfiles(s), [s]);
  const isParticipant = (r: NetworkProfile) => r.participations.some(x => !x.event);
  const isTeam = (r: NetworkProfile) => r.team?.status === "active";
  const isAlumni = (r: NetworkProfile) => r.team?.status === "alumni";
  const unis = [...new Set(rows.flatMap(r => r.universities))].sort();
  const studies = [...new Set(rows.flatMap(r => r.studyPrograms))].sort();

  const filtered = rows.filter(r => {
    const ql = q.trim().toLowerCase();
    if (ql && !`${r.name} ${r.email ?? ""} ${r.studyPrograms.join(" ")} ${r.universities.join(" ")}`.toLowerCase().includes(ql)) return false;
    if (who === "participants" && !isParticipant(r)) return false;
    if (who === "team" && !isTeam(r)) return false;
    if (who === "alumni" && !isAlumni(r)) return false;
    if (uni && !r.universities.includes(uni)) return false;
    if (study && !r.studyPrograms.includes(study)) return false;
    if (city && r.team?.city !== city && !r.participations.some(x => x.city === city)) return false;
    if ((program || semester) && !r.participations.some(x => (!program || x.program === program) && (!semester || x.semester === semester))) return false;
    return true;
  });

  const openRow = rows.find(r => r.key === open);
  const sel = (label: string, value: string, set: (v: string) => void, opts: string[]) => (
    <select class="input input--sm" style="width:auto" value={value} onChange={e => set(e.currentTarget.value)} aria-label={label}>
      <option value="">{label}</option>{opts.map(o => <option>{o}</option>)}
    </select>
  );
  const whoBtn = (v: Who, text: string, n: number) => (
    <button class={`chip-btn ${who === v ? "is-active" : ""}`} onClick={() => setWho(v)}>{text} <span class="muted">{n}</span></button>
  );
  const nParticipants = rows.filter(isParticipant).length;
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
                      {r.team && (r.team.status === "active"
                        ? <span class="chip chip--purple">{r.team.label} · {r.team.city}</span>
                        : <span class="chip chip--gray">Team alumni · {r.team.city}</span>)}
                      {r.participations.filter(x => !x.event).map(x => (
                        <span class="chip chip--green" title={x.title}>{x.program.replace("AIM ", "")} · {x.city} · {x.semester}</span>
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

      {openRow && <NetworkDrawer r={openRow} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Network profile: contact, studies, OneAIM history. Nothing from applications beyond what they took part in. */
function NetworkDrawer({ r, onClose }: { r: NetworkProfile; onClose: () => void }) {
  const contact: [string, string | undefined, "mail" | "tel" | "link"][] = [
    ["Email", r.email, "mail"], ["Phone", r.phone, "tel"], ["LinkedIn", r.linkedin, "link"],
  ];
  const studies: [string, string | undefined][] = [
    ["University affiliations", r.universities.join(", ") || undefined], ["Study programs", r.studyPrograms.join(", ") || undefined],
    ["Semester", r.semester], ["Degree level", r.degree],
  ];
  const programs = r.participations.filter(x => !x.event);
  const events = r.participations.filter(x => x.event);
  const list = (items: Participation[]) => (
    <ul class="stack-s" style="list-style:none;padding:0;margin:0">
      {items.map(x => <li><strong style="color:var(--color-text-heading)">{x.title}</strong><span class="muted small"> · {x.city} · {x.semester}</span></li>)}
    </ul>
  );

  return (
    <Drawer onClose={onClose}
      head={<div class="row" style="flex-wrap:nowrap">
        <Avatar name={r.name} src={r.photo} large />
        <div style="min-width:0">
          <h2 style="font-size:1.25rem">{r.name}</h2>
          <span class="muted small">
            {r.team ? (r.team.status === "active" ? `${r.team.label} · OneAIM ${r.team.city}` : `Team alumni · OneAIM ${r.team.city}`) : "OneAIM network"}
          </span>
        </div>
      </div>}
      foot={<>
        {r.personId && <a class="btn btn--primary btn--sm" href={`/team/crm?p=${r.personId}`}>Full profile in CRM</a>}
        {r.memberId && <a class="btn btn--secondary btn--sm" href={`/team/team?member=${r.memberId}`}>Team profile</a>}
        <span class="spacer" />
        <span class="muted small">Network view: contact, studies, OneAIM history</span>
      </>}>

      <section class="stack-s">
        <h3>Contact</h3>
        <dl class="qa" style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px">
          {contact.map(([k, v, kind]) => (
            <div><dt>{k}</dt><dd>{!v ? "–"
              : kind === "mail" ? <a href={`mailto:${v}`}>{v}</a>
              : kind === "tel" ? <a href={`tel:${v.replace(/\s+/g, "")}`}>{v}</a>
              : <a href={v} target="_blank" rel="noopener">{v.replace(/^https?:\/\/(www\.)?/, "")}</a>}</dd></div>
          ))}
        </dl>
      </section>

      <section class="stack-s">
        <h3>Studies</h3>
        <dl class="qa" style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px">
          {studies.map(([k, v]) => <div><dt>{k}</dt><dd>{v ?? "–"}</dd></div>)}
        </dl>
      </section>

      <section class="stack-s">
        <h3>OneAIM programs</h3>
        {programs.length ? list(programs) : <p class="muted small">No program participation yet.</p>}
      </section>

      {events.length > 0 && (
        <section class="stack-s">
          <h3>Events attended</h3>
          {list(events)}
        </section>
      )}

      {r.team && (
        <section class="stack-s">
          <h3>In the OneAIM team</h3>
          {r.team.status === "alumni" && <p class="muted small">Team alumni{r.team.alumniSince ? ` since ${fmtMonth(r.team.alumniSince)}` : ""}.</p>}
          <ol class="history">
            {[...r.team.history].reverse().map(e => (
              <li class="history__item">
                <span class="history__dot" />
                <div style="flex:1;min-width:0">
                  <strong style="color:var(--color-text-heading)">{roleLabel(e)}</strong>
                  <span class="muted"> · {e.city}{e.department && e.role !== "lead" ? ` · ${e.department}` : ""}</span>
                  <div class="muted small">{fmtMonth(e.from)} – {e.to ? fmtMonth(e.to) : "today"}</div>
                </div>
              </li>
            ))}
            {r.team.history.length === 0 && <li class="muted small">No positions recorded yet.</li>}
          </ol>
        </section>
      )}
    </Drawer>
  );
}
