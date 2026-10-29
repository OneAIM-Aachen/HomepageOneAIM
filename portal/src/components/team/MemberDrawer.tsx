// Profile of one team member as a side drawer: team profile (role,
// department, photo…) plus studies and contact from their network profile.
// Opened from the Team overview and from "my profile" in the sidebar.
import { useState } from "preact/hooks";
import type { Account, Department, RoleEntry, TeamMember, TeamRole } from "../../lib/types";
import { activateMember, checkinNow, removeMember, removeRoleEntry, resendInvite, saveRoleEntry, setMemberStatus, ROLE_LABEL, updateMember, updatePersonDetails, uploadImage, useStore } from "../../lib/store";
import { isDemoId } from "../../lib/demo";
import { DEGREE_OPTIONS, fmtDate, SEMESTER_OPTIONS } from "../../lib/fields";
import { act, Avatar, confirmDialog, Drawer, Field } from "../ui/Ui";
import { IconPlus, IconTrash } from "../ui/Icons";
import { ListPicker } from "../apply/ListPicker";
import { CompanyInput, companyProblem } from "../apply/CompanyInput";

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" });
export const fmtMonth = (iso: string) => monthFmt.format(new Date(`${iso.slice(0, 10)}T12:00:00`)).replace("Sept", "Sep");

/** Label of a past or current position, like subtitle() */
export function roleLabel(e: Pick<RoleEntry, "role" | "department" | "position">): string {
  if (e.position) return e.position;
  return e.role === "lead" && e.department ? `Team Lead | ${e.department}` : ROLE_LABEL[e.role];
}

export // Leads are shown as "Team Lead | Events"; a custom position replaces the label.
function subtitle(m: TeamMember, departments: Department[]): string {
  if (m.position) return m.position;
  const dept = departments.find(d => d.id === m.departmentId)?.name;
  return m.role === "lead" && dept ? `Team Lead | ${dept}` : ROLE_LABEL[m.role];
}

export function RoleFields({ city, role, departmentId, onChange }: {
  city: string; role: TeamRole; departmentId?: string; onChange: (p: { role?: TeamRole; departmentId?: string }) => void;
}) {
  const depts = useStore(x => x.departments.filter(d => d.city === city));
  const top = role === "president" || role === "co_president";
  return (
    <div class="grid-2">
      <Field label="Role" required>
        <select class="input" value={role} onChange={e => onChange({ role: e.currentTarget.value as TeamRole })}>
          {(Object.keys(ROLE_LABEL) as TeamRole[]).map(r => <option value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </Field>
      <Field label="Department" help={top ? "Presidents stand above the departments." : "Optional: people without a department are listed under “Other members”."}>
        <select class="input" value={top ? "" : departmentId ?? ""} disabled={top} onChange={e => onChange({ departmentId: e.currentTarget.value || undefined })}>
          <option value="">No department</option>
          {depts.map(d => <option value={d.id}>{d.name}</option>)}
        </select>
      </Field>
    </div>
  );
}

export function MemberDrawer({ member: m, acc, onClose }: { member: TeamMember; acc: Account; onClose: () => void }) {
  const s = useStore(x => x);
  const person = s.people.find(p => p.id === m.personId);
  const demo = isDemoId(m.id);
  const [d, setD] = useState({
    name: m.name, city: m.city, role: m.role, departmentId: m.departmentId, position: m.position ?? "",
    memberSince: m.memberSince ?? "", about: m.about ?? "", linkedin: m.linkedin ?? "",
  });
  const [email, setEmail] = useState("");
  const [p, setP] = useState({
    universities: person?.universities ?? [], studyPrograms: person?.studyPrograms ?? [], companies: person?.companies ?? [], semester: person?.semester ?? "",
    degree: person?.degree ?? "", phone: person?.phone ?? "", linkedin: person?.linkedin ?? "",
  });
  const dirty = JSON.stringify(d) !== JSON.stringify({
    name: m.name, city: m.city, role: m.role, departmentId: m.departmentId, position: m.position ?? "", memberSince: m.memberSince ?? "", about: m.about ?? "", linkedin: m.linkedin ?? "",
  }) || (!!person && JSON.stringify(p) !== JSON.stringify({
    universities: person.universities, studyPrograms: person.studyPrograms, companies: person.companies, semester: person.semester ?? "",
    degree: person.degree ?? "", phone: person.phone ?? "", linkedin: person.linkedin ?? "",
  }));
  const isMe = acc.memberId === m.id;
  const apps = s.submissions.filter(x => x.personId === m.personId).length;

  const save = () => act(async () => {
    const problem = companyProblem(p.companies, false);
    if (problem) throw new Error(problem);
    await updateMember(m.id, d);
    if (person) await updatePersonDetails(person.id, p);
  }, "Profile saved");

  const photo = (e: Event) => {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { act(() => Promise.reject(new Error("Please use a photo under 3 MB."))); return; }
    act(async () => updateMember(m.id, { photo: await uploadImage(f, "team") }), "Photo updated");
  };

  const remove = async () => {
    if (await confirmDialog({
      title: `Remove ${m.name} from the team?`, danger: true, confirmLabel: "Remove from team",
      message: `Their login is deleted and they disappear from the organigram. They stay in the network with their applications.`,
    })) {
      if (await act(() => removeMember(m.id), `${m.name} was removed from the team`) !== undefined) onClose();
    }
  };

  return (
    <Drawer onClose={onClose}
      head={<div class="row" style="flex-wrap:nowrap">
        <Avatar name={m.name} src={m.photo} large />
        <div style="min-width:0">
          <h2 style="font-size:1.25rem">{m.name}{isMe && <span class="chip chip--blue" style="margin-left:8px;vertical-align:middle">You</span>}</h2>
          <span class="muted small">{subtitle(m, s.departments)} · OneAIM {m.city}</span>
        </div>
      </div>}
      foot={demo
        ? <span class="muted small">Demo member: made up, can't be changed.</span>
        : <>
            <button class="btn btn--primary btn--sm" disabled={!dirty} onClick={save}>Save profile</button>
            {person && <a class="btn btn--secondary btn--sm" href={`/team/crm?p=${person.id}`}>CRM profile{apps ? ` (${apps} application${apps > 1 ? "s" : ""})` : ""}</a>}
            <span class="spacer" />
            {!isMe && <button class="btn btn--ghost btn--sm" style="color:var(--p-red)" onClick={remove}><IconTrash width={16} />Remove</button>}
          </>}>

      <section class="stack-s">
        <h3>Account</h3>
        {!m.email && (
          <form class="stack-s" onSubmit={e => {
            e.preventDefault();
            act(() => activateMember(m.id, email), r => (r.mailError ? `Email saved, but sending failed: ${r.mailError}. Use “Send invitation again”.` : `Invitation sent to ${email.trim()}`))
              .then(r => { if (r) setEmail(""); });
          }}>
            <span class="chip chip--gray" style="align-self:flex-start">No login yet</span>
            <p class="muted small">Add {m.name.split(" ")[0]}'s email to send the invitation. If they applied before, use the same email, so their applications are linked.</p>
            <div class="row" style="flex-wrap:nowrap">
              <input class="input input--sm" type="email" placeholder="name@example.com" value={email} disabled={demo}
                onInput={e => setEmail(e.currentTarget.value)} aria-label={`Email of ${m.name}`} />
              <button class="btn btn--primary btn--sm" style="white-space:nowrap" disabled={demo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}>Add email & invite</button>
            </div>
          </form>
        )}
        {m.email && <div class="row small">
          <a href={`mailto:${m.email}`}>{m.email}</a>
          {m.active
            ? <span class="chip chip--green">Active{m.lastSignInAt ? ` · last login ${fmtDate(m.lastSignInAt)}` : ""}</span>
            : <span class="chip chip--amber">Invited{m.invitedAt ? ` ${fmtDate(m.invitedAt)}` : ""} · no password yet</span>}
          {!demo && !m.active && <button class="btn btn--secondary btn--sm" onClick={() => act(() => resendInvite(m.id), `Invitation sent again to ${m.email}`)}>Send invitation again</button>}
        </div>}
      </section>

      {!demo && <StatusSection m={m} />}

      <HistorySection m={m} demo={demo} />

      <fieldset class="stack" disabled={demo} style="border:none;padding:0;margin:0">
        <section class="stack">
          <h3>Team profile</h3>
          <div class="row">
            <label class="btn btn--secondary btn--sm" style="cursor:pointer">
              {m.photo ? "Change photo" : "Upload photo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" style="display:none" onChange={photo} />
            </label>
            {m.photo && <button class="btn btn--ghost btn--sm" onClick={() => act(() => updateMember(m.id, { photo: undefined }), "Photo removed")}>Remove photo</button>}
          </div>
          <div class="grid-2">
            <Field label="Name" required><input class="input" value={d.name} onInput={e => setD({ ...d, name: e.currentTarget.value })} /></Field>
            <Field label="City" required>
              <select class="input" value={d.city} onChange={e => setD({ ...d, city: e.currentTarget.value, departmentId: undefined })}>
                {s.tagLists.locations.map(c => <option>{c}</option>)}
              </select>
            </Field>
          </div>
          <RoleFields city={d.city} role={d.role} departmentId={d.departmentId} onChange={x => setD({ ...d, ...x })} />
          <div class="grid-2">
            <Field label="Position" help="Optional, replaces the role label (leads show as “Team Lead | Department”)"><input class="input" value={d.position} onInput={e => setD({ ...d, position: e.currentTarget.value })} /></Field>
            <Field label="Member since">
              <select class="input" value={d.memberSince} onChange={e => setD({ ...d, memberSince: e.currentTarget.value })}>
                <option value="">–</option>
                {[...new Set([...s.tagLists.semesters, ...(d.memberSince ? [d.memberSince] : [])])].map(x => <option>{x}</option>)}
              </select>
            </Field>
          </div>
          {!person && (
            <Field label="LinkedIn" help="Moves to their CRM profile once an email is added.">
              <input class="input" type="url" placeholder="https://linkedin.com/in/…" value={d.linkedin} onInput={e => setD({ ...d, linkedin: e.currentTarget.value })} />
            </Field>
          )}
          <Field label="About" help="A few words for the team (max. 600 characters)">
            <textarea class="input" maxLength={600} value={d.about} onInput={e => setD({ ...d, about: e.currentTarget.value })} />
          </Field>
        </section>

        {person && (
          <section class="stack">
            <div class="stack-s">
              <h3>Studies & contact</h3>
              <p class="muted small">Stored once in their CRM profile, the same one their applications update.</p>
            </div>
            <ListPicker label="University affiliations" placeholder="Start typing a university…" minChars={2}
              options={s.universities.map(u => ({ name: u.name, hint: u.country, terms: u.aliases }))}
              value={p.universities} onChange={v => setP({ ...p, universities: v })} />
            <ListPicker label="Study programs" placeholder="Search study programs…"
              options={s.studyPrograms.map(o => ({ name: o.name, group: o.category }))}
              value={p.studyPrograms} onChange={v => setP({ ...p, studyPrograms: v })} />
            <div class="stack-s">
              <span class="field__label">Company affiliations</span>
              <CompanyInput options={s.companies} value={p.companies} onChange={v => setP({ ...p, companies: Array.isArray(v) ? v : [] })} />
            </div>
            <div class="grid-2">
              <Field label="Semester">
                <select class="input" value={p.semester} onChange={e => setP({ ...p, semester: e.currentTarget.value })}>
                  <option value="">–</option>{SEMESTER_OPTIONS.map(x => <option>{x}</option>)}
                </select>
              </Field>
              <Field label="Degree level">
                <select class="input" value={p.degree} onChange={e => setP({ ...p, degree: e.currentTarget.value })}>
                  <option value="">–</option>{DEGREE_OPTIONS.map(x => <option>{x}</option>)}
                </select>
              </Field>
              <Field label="Phone"><input class="input" type="tel" value={p.phone} onInput={e => setP({ ...p, phone: e.currentTarget.value })} /></Field>
              <Field label="LinkedIn"><input class="input" type="url" placeholder="https://linkedin.com/in/…" value={p.linkedin} onInput={e => setP({ ...p, linkedin: e.currentTarget.value })} /></Field>
            </div>
          </section>
        )}
      </fieldset>
    </Drawer>
  );
}

const oneMonthAfter = (iso: string) => {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString();
};

function StatusSection({ m }: { m: TeamMember }) {
  if (m.status === "alumni") {
    return (
      <section class="team-note">
        <div style="flex:1;min-width:0">
          <span class="overline">Alumni</span>
          <p>Left the team{m.alumniSince ? ` on ${fmtDate(m.alumniSince)}` : ""}. Not in the organigram, no portal access.</p>
        </div>
        <button class="btn btn--secondary btn--sm" onClick={async () => {
          if (await confirmDialog({ title: `Bring ${m.name} back to the team?`, message: "They appear in the organigram again with their current role and can sign in again (if they have a login).", confirmLabel: "Back to the team" })) {
            act(() => setMemberStatus(m.id, "active"), `${m.name} is back in the team`);
          }
        }}>Back to the team</button>
      </section>
    );
  }
  const check = m.checkSentAt
    ? `Asked on ${fmtDate(m.checkSentAt)} whether they're still active${m.checkRemindedAt ? `, reminded on ${fmtDate(m.checkRemindedAt)}` : ""}. Without an answer they move to the alumni on ${fmtDate(oneMonthAfter(m.checkSentAt))}.`
    : m.nextCheckAt ? `Next “still active?” email: ${fmtDate(m.nextCheckAt)}${m.lastConfirmedAt ? ` (last confirmed ${fmtDate(m.lastConfirmedAt)})` : ""}.`
    : "The yearly “still active?” email starts one year after an email is added.";
  return (
    <section class="stack-s">
      <h3>Yearly check</h3>
      <p class="muted small">{check}</p>
      <div class="row">
        {m.email && m.active && <button class="btn btn--secondary btn--sm" onClick={() => act(() => checkinNow(m.id), `Asked ${m.name.split(" ")[0]} by email`)}>Ask now</button>}
        <button class="btn btn--ghost btn--sm" onClick={async () => {
          if (await confirmDialog({
            title: `Move ${m.name} to the alumni?`, confirmLabel: "Move to alumni",
            message: "They leave the organigram and can no longer sign in to the portal. Their profile, positions and network entry stay.",
          })) act(() => setMemberStatus(m.id, "alumni"), `${m.name} moved to the alumni`);
        }}>Move to alumni</button>
      </div>
    </section>
  );
}

type Draft = Omit<RoleEntry, "id"> & { id?: string };

const dayBefore = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

function HistorySection({ m, demo }: { m: TeamMember; demo: boolean }) {
  const departments = useStore(x => x.departments);
  const cities = useStore(x => x.tagLists.locations);
  const [edit, setEdit] = useState<Draft | null>(null);
  const entries = [...m.history].reverse();

  const save = (e: Event) => {
    e.preventDefault();
    if (!edit) return;
    act(() => saveRoleEntry(m.id, edit), "Saved").then(r => { if (r !== undefined) setEdit(null); });
  };
  const form = edit && (
    <form class="card stack-s" style="padding:14px" onSubmit={save}>
      <div class="grid-2">
        <Field label="From" required><input class="input input--sm" type="date" required value={edit.from} onInput={e => setEdit({ ...edit, from: e.currentTarget.value })} /></Field>
        <Field label="Until" help="Empty = current position"><input class="input input--sm" type="date" value={edit.to ?? ""} min={edit.from} onInput={e => setEdit({ ...edit, to: e.currentTarget.value || undefined })} /></Field>
        <Field label="City"><select class="input input--sm" value={edit.city} onChange={e => setEdit({ ...edit, city: e.currentTarget.value })}>{cities.map(c => <option>{c}</option>)}</select></Field>
        <Field label="Role"><select class="input input--sm" value={edit.role} onChange={e => setEdit({ ...edit, role: e.currentTarget.value as TeamRole })}>
          {(Object.keys(ROLE_LABEL) as TeamRole[]).map(x => <option value={x}>{ROLE_LABEL[x]}</option>)}</select></Field>
        <Field label="Department"><input class="input input--sm" list={`depts-${m.id}`} value={edit.department ?? ""}
          onInput={e => { const v = e.currentTarget.value; setEdit({ ...edit, department: v, departmentId: departments.find(d => d.city === edit.city && d.name === v)?.id }); }} />
          <datalist id={`depts-${m.id}`}>{departments.filter(d => d.city === edit.city).map(d => <option value={d.name} />)}</datalist></Field>
        <Field label="Position" help="Optional, replaces the role label"><input class="input input--sm" value={edit.position ?? ""} onInput={e => setEdit({ ...edit, position: e.currentTarget.value })} /></Field>
      </div>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn btn--ghost btn--sm" onClick={() => setEdit(null)}>Cancel</button>
        <button class="btn btn--primary btn--sm" disabled={!edit.from}>Save</button>
      </div>
    </form>
  );

  return (
    <section class="stack-s">
      <div class="row row--between">
        <h3>Positions in the team</h3>
        {!demo && !edit && <button class="btn btn--ghost btn--sm" onClick={() => setEdit({
          city: m.city, role: "member", from: "", to: dayBefore(m.history[0]?.from),
        })}><IconPlus width={15} />Add earlier position</button>}
      </div>
      <p class="muted small">Recorded automatically when role, department or position change. Dates can be corrected.</p>
      {edit && !edit.id && form}
      <ol class="history">
        {entries.map(e => (
          <li class="history__item">
            <span class="history__dot" />
            {edit?.id === e.id ? <div style="flex:1">{form}</div> : (
              <div style="flex:1;min-width:0">
                <strong style="color:var(--color-text-heading)">{roleLabel(e)}</strong>
                <span class="muted"> · {e.city}{e.department && e.role !== "lead" ? ` · ${e.department}` : ""}</span>
                <div class="muted small">{fmtMonth(e.from)} – {e.to ? fmtMonth(e.to) : "today"}</div>
              </div>
            )}
            {!demo && edit?.id !== e.id && (
              <span class="row" style="gap:2px;flex-wrap:nowrap">
                <button class="btn btn--ghost btn--sm" onClick={() => setEdit({ ...e })}>Edit</button>
                <button class="icon-btn" title="Delete entry" aria-label="Delete entry" onClick={async () => {
                  if (await confirmDialog({ title: "Delete this entry?", message: `${roleLabel(e)}, ${fmtMonth(e.from)} – ${e.to ? fmtMonth(e.to) : "today"}`, danger: true, confirmLabel: "Delete" })) {
                    act(() => removeRoleEntry(e.id), "Deleted");
                  }
                }}><IconTrash width={15} /></button>
              </span>
            )}
          </li>
        ))}
        {entries.length === 0 && <li class="muted small">No positions recorded yet.</li>}
      </ol>
    </section>
  );
}
