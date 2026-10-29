// Profile of one team member as a side drawer: team profile (role,
// department, photo…) plus studies and contact from their network profile.
// Opened from the Team overview and from "my profile" in the sidebar.
import { useState } from "preact/hooks";
import type { Account, Department, TeamMember, TeamRole } from "../../lib/types";
import { activateMember, removeMember, resendInvite, ROLE_LABEL, updateMember, updatePersonDetails, uploadImage, useStore } from "../../lib/store";
import { isDemoId } from "../../lib/demo";
import { DEGREE_OPTIONS, fmtDate, SEMESTER_OPTIONS } from "../../lib/fields";
import { act, Avatar, confirmDialog, Drawer, Field } from "../ui/Ui";
import { IconTrash } from "../ui/Icons";
import { ListPicker } from "../apply/ListPicker";

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
    universities: person?.universities ?? [], studyPrograms: person?.studyPrograms ?? [], semester: person?.semester ?? "",
    degree: person?.degree ?? "", phone: person?.phone ?? "", linkedin: person?.linkedin ?? "",
  });
  const dirty = JSON.stringify(d) !== JSON.stringify({
    name: m.name, city: m.city, role: m.role, departmentId: m.departmentId, position: m.position ?? "", memberSince: m.memberSince ?? "", about: m.about ?? "", linkedin: m.linkedin ?? "",
  }) || (!!person && JSON.stringify(p) !== JSON.stringify({
    universities: person.universities, studyPrograms: person.studyPrograms, semester: person.semester ?? "",
    degree: person.degree ?? "", phone: person.phone ?? "", linkedin: person.linkedin ?? "",
  }));
  const isMe = acc.memberId === m.id;
  const apps = s.submissions.filter(x => x.personId === m.personId).length;

  const save = () => act(async () => {
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
            {person && <a class="btn btn--secondary btn--sm" href={`/team/network?p=${person.id}`}>Network profile{apps ? ` (${apps} application${apps > 1 ? "s" : ""})` : ""}</a>}
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
            <Field label="LinkedIn" help="Moves to their network profile once an email is added.">
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
              <p class="muted small">Stored once in the network profile, the same one their applications update.</p>
            </div>
            <ListPicker label="University affiliations" placeholder="Start typing a university…" minChars={2}
              options={s.universities.map(u => ({ name: u.name, hint: u.country, terms: u.aliases }))}
              value={p.universities} onChange={v => setP({ ...p, universities: v })} />
            <ListPicker label="Study programs" placeholder="Search study programs…"
              options={s.studyPrograms.map(o => ({ name: o.name, group: o.category }))}
              value={p.studyPrograms} onChange={v => setP({ ...p, studyPrograms: v })} />
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
