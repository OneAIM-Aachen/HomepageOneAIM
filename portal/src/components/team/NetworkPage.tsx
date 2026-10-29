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
import type { State, TeamMember } from "../../lib/types";
import { inviteToNetworkSite, useStore } from "../../lib/store";
import { appTitle } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { act, Avatar, useParam } from "../ui/Ui";
import { IconExternal, IconSearch } from "../ui/Icons";
import { subtitle } from "./MemberDrawer";
import { ProfileDrawer, type NetworkProfile } from "../network/Profile";

export default function NetworkPage() {
  const p = useParam("p");
  return <TeamShell active="network">{() => <Network initial={p} />}</TeamShell>;
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

      {openRow && <ProfileDrawer r={openRow} onClose={() => setOpen(null)} foot={<>
        {openRow.personId && <a class="btn btn--primary btn--sm" href={`/team/crm?p=${openRow.personId}`}>Full profile in CRM</a>}
        {openRow.memberId && <a class="btn btn--secondary btn--sm" href={`/team/team?member=${openRow.memberId}`}>Team profile</a>}
        <span class="spacer" />
        <NetworkSiteStatus r={openRow} />
      </>} />}
    </div>
  );
}

/** Login on the members site: invited when, or a button to invite. Team members use their team login. */
function NetworkSiteStatus({ r }: { r: NetworkProfile }) {
  const acc = useStore(x => (r.personId ? x.networkAccounts[r.personId] : undefined));
  const teamLogin = useStore(x => x.team.some(m => m.id === r.memberId && m.email));
  if (r.key.startsWith("demo-")) return <span class="muted small">Demo person</span>;
  if (teamLogin) return <span class="muted small">Uses the team login on the network site</span>;
  if (!r.personId) return <span class="muted small">No email yet</span>;
  return (
    <span class="row" style="gap:8px">
      {acc?.invitedAt && <span class="muted small">Network site: invited {new Date(acc.invitedAt).toLocaleDateString("en-GB")}</span>}
      <button class="btn btn--ghost btn--sm" onClick={() => act(() => inviteToNetworkSite(r.personId!), `Welcome email sent to ${r.email}`)}>
        {acc ? "Send login again" : "Invite to network site"}
      </button>
    </span>
  );
}
