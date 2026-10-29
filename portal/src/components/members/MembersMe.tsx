// Members site: your own profile. Name and email come from OneAIM; contact
// data, studies and photo you can edit. Everything here is visible to the
// other members of the network.
import { useEffect, useState } from "preact/hooks";
import { fetchFormOptions } from "../../lib/store";
import { updateMe, uploadMemberPhoto, type Member } from "../../lib/members";
import { DEGREE_OPTIONS, SEMESTER_OPTIONS } from "../../lib/fields";
import type { FormOptions } from "../../lib/types";
import { ProfileDrawer } from "../network/Profile";
import { MembersShell } from "./MembersShell";
import { act, Avatar, Field } from "../ui/Ui";
import { ListPicker } from "../apply/ListPicker";

export default function MembersMe() {
  return <MembersShell active="me">{(me, reload) => <Me me={me} reload={reload} />}</MembersShell>;
}

function Me({ me, reload }: { me: Member; reload: () => void }) {
  const initial = {
    phone: me.phone ?? "", linkedin: me.linkedin ?? "", universities: me.universities, studyPrograms: me.studyPrograms,
    semester: me.semester ?? "", degree: me.degree ?? "",
  };
  const [d, setD] = useState(initial);
  const [options, setOptions] = useState<FormOptions>({ universities: [], studyPrograms: [] });
  const [preview, setPreview] = useState(false);
  const welcome = new URLSearchParams(location.search).get("welcome") === "1";
  useEffect(() => { fetchFormOptions().then(setOptions); }, []);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);

  const photo = (e: Event) => {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { act(() => Promise.reject(new Error("Please use a photo under 3 MB."))); return; }
    act(async () => { await updateMe({ photo: await uploadMemberPhoto(f) }); reload(); }, "Photo updated");
  };

  return (
    <div class="stack" style="gap:20px;max-width:760px">
      {welcome && (
        <div class="team-note">
          <div><span class="overline">Welcome to the OneAIM network</span>
            <p>Complete your profile, so other members can find you: add a photo, your studies and your LinkedIn.</p></div>
        </div>
      )}
      <header class="row" style="flex-wrap:nowrap;gap:16px">
        <Avatar name={me.name} src={me.photo} large />
        <div class="stack-s" style="min-width:0">
          <h1 style="font-size:1.7rem">{me.name}</h1>
          <span class="muted small">{me.email} · Name and email are managed by OneAIM.</span>
        </div>
        <span class="spacer" />
        <button class="btn btn--secondary btn--sm" onClick={() => setPreview(true)}>See how others see me</button>
      </header>

      <section class="card stack">
        <div class="row">
          <label class="btn btn--secondary btn--sm" style="cursor:pointer">
            {me.photo ? "Change photo" : "Upload photo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" style="display:none" onChange={photo} />
          </label>
          {me.photo && <button class="btn btn--ghost btn--sm" onClick={() => act(async () => { await updateMe({ photo: "" }); reload(); }, "Photo removed")}>Remove photo</button>}
        </div>
        <div class="grid-2">
          <Field label="Phone"><input class="input" type="tel" value={d.phone} onInput={e => setD({ ...d, phone: e.currentTarget.value })} /></Field>
          <Field label="LinkedIn"><input class="input" type="url" placeholder="https://linkedin.com/in/…" value={d.linkedin} onInput={e => setD({ ...d, linkedin: e.currentTarget.value })} /></Field>
        </div>
        <ListPicker label="University affiliations" placeholder="Start typing your university…" minChars={2}
          options={options.universities.map(u => ({ name: u.name, hint: u.country, terms: u.aliases }))}
          value={d.universities} onChange={v => setD({ ...d, universities: v })} />
        <ListPicker label="Study programs" placeholder="Search your study program…"
          options={options.studyPrograms.map(o => ({ name: o.name, group: o.category }))}
          value={d.studyPrograms} onChange={v => setD({ ...d, studyPrograms: v })} />
        <div class="grid-2">
          <Field label="Semester">
            <select class="input" value={d.semester} onChange={e => setD({ ...d, semester: e.currentTarget.value })}>
              <option value="">–</option>{SEMESTER_OPTIONS.map(x => <option>{x}</option>)}
            </select>
          </Field>
          <Field label="Degree level">
            <select class="input" value={d.degree} onChange={e => setD({ ...d, degree: e.currentTarget.value })}>
              <option value="">–</option>{DEGREE_OPTIONS.map(x => <option>{x}</option>)}
            </select>
          </Field>
        </div>
        <p class="muted small">Your profile, including email, phone and LinkedIn, is visible to all members of the OneAIM network.</p>
        <div class="row" style="justify-content:flex-end">
          <button class="btn btn--primary" disabled={!dirty} onClick={() => act(async () => { await updateMe(d); reload(); }, "Profile saved")}>Save profile</button>
        </div>
      </section>

      {preview && <ProfileDrawer r={me} onClose={() => setPreview(false)} />}
    </div>
  );
}
