// Team overview: organigram of every city team (president(s) → departments
// with leads and members), member profiles, invitations and departments.
// Every member has the same rights, so everyone can edit everything here.
import { useState } from "preact/hooks";
import type { Account, Department, TeamMember, TeamRole } from "../../lib/types";
import { addDepartment, inviteMember, removeDepartment, renameDepartment, useStore } from "../../lib/store";
import { isDemoId } from "../../lib/demo";
import { fmtDate } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { MemberDrawer, RoleFields, subtitle } from "./MemberDrawer";
import { act, Avatar, confirmDialog, Field, Modal, useParam } from "../ui/Ui";
import { IconPlus, IconSearch, IconTrash } from "../ui/Icons";

export default function TeamPage() {
  return <TeamShell active="team">{acc => <Team acc={acc} />}</TeamShell>;
}

const ROLE_ORDER: Record<TeamRole, number> = { president: 0, co_president: 1, lead: 2, member: 3 };
const byRole = (a: TeamMember, b: TeamMember) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name);

function Team({ acc }: { acc: Account }) {
  const s = useStore(x => x);
  const initialMember = useParam("member");
  const [city, setCity] = useState(useParam("city") ?? "");
  const [view, setView] = useState<"org" | "list">(useParam("view") === "org" ? "org" : "list");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(initialMember);
  const [inviting, setInviting] = useState(useParam("invite") === "1");
  const [editingDepts, setEditingDepts] = useState(false);

  const cities = s.tagLists.locations;
  const shown = city ? [city] : cities.filter(c => s.team.some(m => m.city === c) || s.departments.some(d => d.city === c));
  const member = s.team.find(m => m.id === open);
  const pending = s.team.filter(m => m.email && !m.active).length;
  const noLogin = s.team.filter(m => !m.email).length;

  const ql = q.trim().toLowerCase();
  const listed = s.team.filter(m => (!city || m.city === city) &&
    (!ql || `${m.name} ${m.email ?? ""} ${m.position ?? ""} ${s.departments.find(d => d.id === m.departmentId)?.name ?? ""}`.toLowerCase().includes(ql)));

  return (
    <div class="stack">
      <PageHead overline="OneAIM" title="Team overview"
        sub="Who is who in every city. Click a person for their profile; everyone can edit, invite and remove."
        actions={<>
          <button class="btn btn--secondary" onClick={() => setEditingDepts(true)}>Departments</button>
          <button class="btn btn--primary" onClick={() => setInviting(true)}><IconPlus width={18} />Invite member</button>
        </>} />

      {acc.legacy && (
        <div class="demo-banner" role="status">
          <strong>You're signed in with the shared {acc.city} login.</strong> Invite yourself and the team here; everyone then signs in with their own account.
        </div>
      )}

      <div class="stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <div class="card stat"><span class="stat__num">{s.team.length}</span><span class="stat__label">Team members</span></div>
        <div class="card stat"><span class="stat__num">{s.departments.length}</span><span class="stat__label">Departments</span></div>
        <div class="card stat"><span class="stat__num">{noLogin}</span><span class="stat__label">Without login</span><span class="muted small">no email added yet</span></div>
        <div class="card stat"><span class="stat__num">{pending}</span><span class="stat__label">Invitations open</span><span class="muted small">no password set yet</span></div>
      </div>

      <div class="row">
        <div class="row" style="gap:6px" role="group" aria-label="City">
          <button class={`chip-btn ${!city ? "is-active" : ""}`} onClick={() => setCity("")}>All cities</button>
          {cities.map(c => <button class={`chip-btn ${city === c ? "is-active" : ""}`} onClick={() => setCity(c)}>{c}</button>)}
        </div>
        <span class="spacer" />
        <div class="row" style="gap:6px" role="group" aria-label="View">
          <button class={`chip-btn ${view === "list" ? "is-active" : ""}`} onClick={() => setView("list")}>List</button>
          <button class={`chip-btn ${view === "org" ? "is-active" : ""}`} onClick={() => setView("org")}>Organigram</button>
        </div>
      </div>

      {view === "org"
        ? (shown.length
            ? shown.map(c => <CityOrg city={c} members={s.team.filter(m => m.city === c)} departments={s.departments.filter(d => d.city === c)} onOpen={setOpen} />)
            : <div class="empty">No team members yet. Start with “Invite member”.</div>)
        : (
          <div class="stack-s">
            <div style="position:relative;max-width:380px">
              <IconSearch width={17} style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-text-muted)" />
              <input class="input input--sm" style="padding-left:36px" placeholder="Search name, email, department…" value={q} onInput={e => setQ(e.currentTarget.value)} aria-label="Search team" />
            </div>
            <div class="card card--flush">
              <div class="table-wrap">
                <table class="table">
                  <thead><tr><th>Person</th><th>City</th><th>Role</th><th>Department</th><th>Member since</th><th>Account</th></tr></thead>
                  <tbody>
                    {[...listed].sort((a, b) => a.city.localeCompare(b.city) || byRole(a, b)).map(m => (
                      <tr class="is-clickable" onClick={() => setOpen(m.id)}>
                        <td><div class="cell-person"><Avatar name={m.name} src={m.photo} /><div><strong>{m.name}</strong><span class="muted small">{m.email ?? "No email yet"}</span></div></div></td>
                        <td>{m.city}</td>
                        <td>{subtitle(m, s.departments)}</td>
                        <td>{s.departments.find(d => d.id === m.departmentId)?.name ?? "–"}</td>
                        <td class="muted small">{m.memberSince ?? "–"}</td>
                        <td>{!m.email ? <span class="chip chip--gray">No login</span> : m.active ? <span class="chip chip--green">Active</span> : <span class="chip chip--amber" title={m.invitedAt ? `Invited ${fmtDate(m.invitedAt)}` : undefined}>Invited</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {listed.length === 0 && <div class="empty" style="border:none">Nobody matches.</div>}
            </div>
          </div>
        )}

      {member && <MemberDrawer key={member.id} member={member} acc={acc} onClose={() => setOpen(null)} />}
      {inviting && <InviteModal acc={acc} city={city} onClose={() => setInviting(false)} onDone={id => { setInviting(false); setOpen(id); }} />}
      {editingDepts && <DepartmentsModal city={city || acc.city} onClose={() => setEditingDepts(false)} />}
    </div>
  );
}

function PersonCard({ m, kind, onOpen }: { m: TeamMember; kind: "top" | "lead" | "row"; onOpen: (id: string) => void }) {
  const departments = useStore(x => x.departments);
  return (
    <button class={`person-card person-card--${kind}`} onClick={() => onOpen(m.id)}
      title={!m.email ? "No login yet" : m.active ? undefined : "Invitation sent, no password set yet"}>
      <Avatar name={m.name} src={m.photo} />
      <span class="person-card__text"><strong>{m.name}</strong><span>{subtitle(m, departments)}</span></span>
    </button>
  );
}

function CityOrg({ city, members, departments, onOpen }: {
  city: string; members: TeamMember[]; departments: Department[]; onOpen: (id: string) => void;
}) {
  const top = members.filter(m => m.role === "president" || m.role === "co_president").sort(byRole);
  const cols = [...departments].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(d => ({ key: d.id, name: d.name, people: members.filter(m => m.departmentId === d.id).sort(byRole) }));
  const loose = members.filter(m => !top.includes(m) && !m.departmentId).sort(byRole);

  return (
    <section class="card org-city">
      <div class="org-city__head">
        <h2>OneAIM {city}</h2>
        <span class="muted small">{members.length} member{members.length === 1 ? "" : "s"} · {departments.length} department{departments.length === 1 ? "" : "s"}</span>
      </div>
      <div class="org">
        <div class="org__inner">
          <div class="org__top">
            {top.length ? top.map(m => <PersonCard m={m} kind="top" onOpen={onOpen} />)
                        : <div class="person-card person-card--top muted small" style="cursor:default">No president yet</div>}
          </div>
          {cols.length > 0 && <div class="org__stem" />}
          <div class="org__depts">
            {cols.map(c => {
              const leads = c.people.filter(m => m.role === "lead");
              const rest = c.people.filter(m => m.role !== "lead");
              return (
                <div class="org__dept">
                  <div class="org__dept-name">{c.name}</div>
                  {leads.map(m => <PersonCard m={m} kind="lead" onOpen={onOpen} />)}
                  {rest.length > 0 && <div class="org__members">{rest.map(m => <PersonCard m={m} kind="row" onOpen={onOpen} />)}</div>}
                  {c.people.length === 0 && <p class="muted small" style="text-align:center">Nobody yet</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {loose.length > 0 && (
        <div class="org-others">
          <div class="org__dept-name" style="text-align:left">Other members</div>
          <div class="org-others__grid">{loose.map(m => <PersonCard m={m} kind="row" onOpen={onOpen} />)}</div>
        </div>
      )}
    </section>
  );
}


function InviteModal({ acc, city: preset, onClose, onDone }: { acc: Account; city: string; onClose: () => void; onDone: (id: string) => void }) {
  const cities = useStore(x => x.tagLists.locations);
  const [d, setD] = useState({ name: "", email: "", city: preset || acc.city || cities[0] || "", role: "member" as TeamRole, departmentId: undefined as string | undefined, position: "" });
  const [busy, setBusy] = useState(false);
  // Imported profiles without login: invite them from their profile instead of creating a second one
  const same = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
  const existing = useStore(x => x.team.find(m => !m.email && d.name.trim() && same(m.name, d.name)));
  const valid = d.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()) && d.city;

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    const r = await act(() => inviteMember(d), x => (x.mailError ? `Account created, but the email failed: ${x.mailError}. Use “Send invitation again”.` : `Invitation sent to ${d.email.trim()}`));
    setBusy(false);
    if (r) onDone(r.id);
  };

  return (
    <Modal title="Invite a team member" onClose={onClose} wide>
      <form class="stack" onSubmit={submit}>
        <p class="muted small">They get an email with a link to set their own password. If they already applied to OneAIM, use the same email and name, so their team profile is linked to their network profile.</p>
        <div class="grid-2">
          <Field label="Full name" required><input class="input" value={d.name} onInput={e => setD({ ...d, name: e.currentTarget.value })} /></Field>
          <Field label="Email" required><input class="input" type="email" value={d.email} onInput={e => setD({ ...d, email: e.currentTarget.value })} /></Field>
        </div>
        <div class="grid-2">
          <Field label="City" required>
            <select class="input" value={d.city} onChange={e => setD({ ...d, city: e.currentTarget.value, departmentId: undefined })}>
              {cities.map(c => <option>{c}</option>)}
            </select>
          </Field>
          <Field label="Position" help="Optional, replaces the role label. Leads show as “Team Lead | Department”."><input class="input" value={d.position} onInput={e => setD({ ...d, position: e.currentTarget.value })} /></Field>
        </div>
        <RoleFields city={d.city} role={d.role} departmentId={d.departmentId} onChange={p => setD({ ...d, ...p })} />
        {existing && (
          <div class="demo-banner" role="status">
            <span><strong>{existing.name}</strong> already has a profile in {existing.city} without a login. Add the email there instead, so there's no second profile.</span>
            <button type="button" class="btn btn--secondary btn--sm" onClick={() => onDone(existing.id)}>Open profile</button>
          </div>
        )}
        <div class="row" style="justify-content:flex-end">
          <button type="button" class="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button class="btn btn--primary" disabled={!valid || busy}>{busy ? "Sending…" : "Send invitation"}</button>
        </div>
      </form>
    </Modal>
  );
}


function DepartmentsModal({ city: preset, onClose }: { city: string; onClose: () => void }) {
  const s = useStore(x => x);
  const [city, setCity] = useState(preset);
  const [draft, setDraft] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const depts = s.departments.filter(d => d.city === city).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const remove = async (d: Department) => {
    const n = s.team.filter(m => m.departmentId === d.id).length;
    if (await confirmDialog({
      title: `Remove “${d.name}”?`, danger: true, confirmLabel: "Remove department",
      message: n ? `${n} member${n > 1 ? "s" : ""} stay in the team, listed under “Other members”.` : "Nobody is in this department.",
    })) act(() => removeDepartment(d.id), `Removed ${d.name}`);
  };

  return (
    <Modal title="Departments" onClose={onClose}>
      <div class="stack">
        <Field label="City">
          <select class="input" value={city} onChange={e => setCity(e.currentTarget.value)}>
            {s.tagLists.locations.map(c => <option>{c}</option>)}
          </select>
        </Field>
        <div class="stack-s">
          {depts.map(d => {
            const v = names[d.id] ?? d.name;
            const demo = isDemoId(d.id);
            return (
              <div class="row" style="flex-wrap:nowrap">
                <input class="input input--sm" value={v} disabled={demo} aria-label={`Name of ${d.name}`}
                  onInput={e => setNames({ ...names, [d.id]: e.currentTarget.value })} />
                {v.trim() && v !== d.name && <button class="btn btn--secondary btn--sm" onClick={() => act(() => renameDepartment(d.id, v), "Renamed")}>Save</button>}
                <span class="muted small" style="white-space:nowrap">{s.team.filter(m => m.departmentId === d.id).length} people</span>
                {!demo && <button class="icon-btn" title="Remove" aria-label={`Remove ${d.name}`} onClick={() => remove(d)}><IconTrash width={17} /></button>}
              </div>
            );
          })}
          {depts.length === 0 && <p class="muted small">No departments in {city} yet.</p>}
        </div>
        <form class="row" style="flex-wrap:nowrap" onSubmit={async e => {
          e.preventDefault();
          if ((await act(() => addDepartment(city, draft), `Added ${draft.trim()}`)) !== undefined) setDraft("");
        }}>
          <input class="input input--sm" placeholder="New department, e.g. Finance" value={draft} onInput={e => setDraft(e.currentTarget.value)} aria-label="New department" />
          <button class="btn btn--secondary btn--sm" disabled={!draft.trim()}>Add</button>
        </form>
      </div>
    </Modal>
  );
}
