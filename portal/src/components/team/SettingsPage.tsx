import { useEffect, useMemo, useState } from "preact/hooks";
import type { Account } from "../../lib/types";
import {
  addCompany, addStudyProgram, addTag, addUniversity, changePassword, loadEmailSettings, mergeProfileValue, removeListEntry, removeProfileValue, removeTag,
  saveEmailSettings, sendQueuedNow, useStore, type EmailSettings, type ListKind, type TagListKey,
} from "../../lib/store";
import { TeamShell, PageHead } from "./TeamShell";
import { act, confirmDialog, Field } from "../ui/Ui";
import { IconX } from "../ui/Icons";
import { ListPicker, type PickerOption } from "../apply/ListPicker";

export default function SettingsPage() {
  return <TeamShell active="settings">{acc => <Settings acc={acc} />}</TeamShell>;
}

const LISTS: { key: TagListKey; label: string; help: string; placeholder: string }[] = [
  { key: "semesters", label: "Semesters", help: "WS = winter semester, SS = summer semester.", placeholder: "e.g. WS 27/28" },
  { key: "programs", label: "Programs", help: "Programs applications can be tagged with.", placeholder: "e.g. AIM Science" },
  { key: "locations", label: "Locations", help: "Cities with a OneAIM chapter.", placeholder: "e.g. Berlin" },
];

function Settings({ acc }: { acc: Account }) {
  const s = useStore(x => x);
  const [drafts, setDrafts] = useState<Record<TagListKey, string>>({ semesters: "", programs: "", locations: "" });
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const used = (key: TagListKey, v: string) => s.applications.some(a =>
    (key === "semesters" && a.tags.semester === v) || (key === "programs" && a.tags.program === v) || (key === "locations" && a.tags.location === v));

  return (
    <div class="stack" style="gap:22px">
      <PageHead overline="Settings" title="Lists, emails & accounts" sub="Tag lists, university and study program lists, emails and city accounts." />

      <ProfileLists />

      <EmailSection />

      <section class="stack">
        <h2>Tags</h2>
        <div class="grid-3" style="align-items:start">
          {LISTS.map(l => (
            <div class="card stack-s">
              <h3>{l.label}</h3>
              <p class="muted small">{l.help}</p>
              <div class="row" style="gap:6px;margin:6px 0">
                {s.tagLists[l.key].map(t => (
                  <span class="chip chip--blue" style="padding-right:4px">
                    {t}
                    <button class="icon-btn" style="width:20px;height:20px" aria-label={`Remove ${t}`} disabled={used(l.key, t)}
                      title={used(l.key, t) ? "Used by an application" : "Remove"} onClick={() => act(() => removeTag(l.key, t), `Removed ${t}`)}><IconX /></button>
                  </span>
                ))}
              </div>
              <form class="row" style="flex-wrap:nowrap" onSubmit={async e => {
                e.preventDefault();
                const v = drafts[l.key];
                if ((await act(() => addTag(l.key, v), `Added ${v}`)) !== undefined) setDrafts({ ...drafts, [l.key]: "" });
              }}>
                <input class="input input--sm" placeholder={l.placeholder} value={drafts[l.key]} onInput={e => setDrafts({ ...drafts, [l.key]: e.currentTarget.value })} aria-label={`New ${l.label}`} />
                <button class="btn btn--secondary btn--sm" disabled={!drafts[l.key].trim()}>Add</button>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section class="grid-2" style="align-items:start">
        <div class="card stack-s">
          <h2>Your account</h2>
          <p class="muted small">Every team member has their own login. All members have the same rights: everyone sees all cities and can invite or remove team members.</p>
          <table class="table" style="margin-top:8px">
            <tbody>
              <tr><td class="muted small">Name</td><td><strong style="color:var(--color-text-heading)">{acc.name}</strong></td></tr>
              <tr><td class="muted small">Email</td><td class="small">{acc.email}</td></tr>
              <tr><td class="muted small">City</td><td class="small">{acc.city}</td></tr>
            </tbody>
          </table>
          <div class="row">
            {acc.memberId && <a class="btn btn--secondary btn--sm" href={`/team?member=${acc.memberId}`}>Edit my team profile</a>}
            <a class="btn btn--ghost btn--sm" href="/team">Team overview</a>
          </div>
        </div>
        <form class="card stack" onSubmit={e => {
          e.preventDefault();
          act(() => changePassword(pw), "Password changed").then(() => { setPw(""); setPw2(""); });
        }}>
          <h2>Change password</h2>
          <Field label="New password" help="At least 10 characters."><input class="input" type="password" autoComplete="new-password" value={pw} onInput={e => setPw(e.currentTarget.value)} /></Field>
          <Field label="Repeat password" error={pw2 && pw !== pw2 ? "Passwords don't match." : undefined}><input class="input" type="password" autoComplete="new-password" value={pw2} onInput={e => setPw2(e.currentTarget.value)} /></Field>
          <button class="btn btn--primary" style="align-self:flex-start" disabled={pw.length < 10 || pw !== pw2}>Change password</button>
        </form>
      </section>
    </div>
  );
}

function EmailSection() {
  const [saved, setSaved] = useState<EmailSettings | null>(null);
  const [d, setD] = useState<EmailSettings | null>(null);
  useEffect(() => { act(loadEmailSettings).then(x => { if (x) { setSaved(x); setD(x); } }); }, []);
  if (!d || !saved) return null;

  const dirty = JSON.stringify(d) !== JSON.stringify(saved);
  const set = (patch: Partial<EmailSettings>) => setD({ ...d, ...patch });
  const save = () => act(async () => { await saveEmailSettings(d); setSaved(d); }, "Email settings saved");

  return (
    <section class="card stack">
      <div class="row row--between">
        <div class="stack-s">
          <h2>Emails</h2>
          <p class="muted small">Sent through Brevo from one address. Placeholder {"{location}"} in the sender name becomes the city of the application.</p>
        </div>
        <span class={`chip ${d.test_mode ? "chip--amber" : "chip--green"}`}>{d.test_mode ? "Test mode" : "Live: sending to applicants"}</span>
      </div>

      <div class="card card--tint stack-s" style="box-shadow:none">
        <label class="check">
          <input type="checkbox" checked={d.test_mode} onChange={e => set({ test_mode: e.currentTarget.checked })} />
          <span><strong>Test mode</strong> <span class="muted small">Every email goes to the test inbox below instead of the applicant. The real recipient is shown in the subject.</span></span>
        </label>
        <Field label="Test inbox" help={d.test_mode && !d.test_recipient ? "Required in test mode: without it, no email is sent at all." : undefined}>
          <input class="input" type="email" placeholder="you@example.com" value={d.test_recipient ?? ""} onInput={e => set({ test_recipient: e.currentTarget.value })} />
        </Field>
      </div>

      <div class="grid-2">
        <Field label="Sender address" help="Must be a verified sender in Brevo. Later: applications@one-aim.org.">
          <input class="input" type="email" value={d.sender_email} onInput={e => set({ sender_email: e.currentTarget.value })} />
        </Field>
        <Field label="Sender name" help='e.g. "OneAIM {location}" → "OneAIM Aachen"'>
          <input class="input" value={d.sender_name} onInput={e => set({ sender_name: e.currentTarget.value })} />
        </Field>
        <Field label="Reply-to address" help="Empty = replies go to the sender address.">
          <input class="input" type="email" value={d.reply_to ?? ""} onInput={e => set({ reply_to: e.currentTarget.value })} />
        </Field>
        <Field label="Link base for emails" help="Address of the website in email links (booking, feedback, invitations). Later: https://one-aim.org">
          <input class="input" type="url" value={d.apply_base_url} onInput={e => set({ apply_base_url: e.currentTarget.value })} />
        </Field>
        <Field label="Daily limit" help="Brevo free plan: 300/day. Emails above it go out the next day.">
          <input class="input" type="number" min={1} value={d.daily_limit} onInput={e => set({ daily_limit: Math.max(1, Number(e.currentTarget.value) || 1) })} />
        </Field>
      </div>

      <div class="row">
        <button class="btn btn--primary" disabled={!dirty} onClick={save}>{dirty ? "Save email settings" : "Saved"}</button>
        <button class="btn btn--secondary" onClick={() => act(sendQueuedNow, r => r.skipped ? `Not sent: ${r.skipped}` : `${r.sent ?? 0} sent, ${r.failed ?? 0} failed`)}>Send queued emails now</button>
      </div>
    </section>
  );
}

// ── University & study program lists ─────────────────────────────────────

/** Field (study programs) or sector (companies): pick an existing one, or type a new one */
function GroupSelect({ label, groups, value, onChange }: { label: string; groups: string[]; value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(false);
  if (custom) {
    return (
      <span class="row" style="gap:4px;flex-wrap:nowrap;max-width:210px">
        <input class="input input--sm" placeholder={`New ${label.toLowerCase()}`} value={value} onInput={e => onChange(e.currentTarget.value)} aria-label={`New ${label.toLowerCase()}`} autoFocus />
        <button type="button" class="icon-btn" aria-label={`Choose an existing ${label.toLowerCase()}`} title={`Choose an existing ${label.toLowerCase()}`}
          onClick={() => { setCustom(false); onChange(""); }}><IconX /></button>
      </span>
    );
  }
  return (
    <select class="input input--sm" style="max-width:190px" value={value} aria-label={label}
      onChange={e => { const v = e.currentTarget.value; if (v === "__new") { setCustom(true); onChange(""); } else onChange(v); }}>
      <option value="">{label}…</option>
      {groups.map(g => <option value={g}>{g}</option>)}
      <option value="__new">+ New {label.toLowerCase()}…</option>
    </select>
  );
}

/**
 * One value entered via "Other": create a list entry from it (name can be
 * cleaned up, e.g. "Information Systems is close to CS" → "Information
 * Systems"; field / sector required), merge it into an existing entry, or
 * deny it (removed from the profiles, the entry is then empty there).
 */
function UnlistedRow({ kind, value, n, options, pickerOptions, groups }: {
  kind: ListKind; value: string; n: number; options: string[]; pickerOptions: PickerOption[]; groups: string[];
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(value);
  const [group, setGroup] = useState("");      // field / sector; for universities: the country
  const [city, setCity] = useState("");
  const add = (entry: string, grp: string) => kind === "university" ? addUniversity(entry, city, grp) : kind === "company" ? addCompany(entry, grp)
    : addStudyProgram(entry, grp);
  const groupLabel = kind === "company" ? "Sector" : kind === "university" ? "Country" : "Field";
  const missing = kind === "university" ? !city.trim() || !group.trim() : !group.trim();
  const people = `${n} ${n === 1 ? "person" : "people"}`;
  const exists = options.some(o => o.toLowerCase() === name.trim().toLowerCase());
  const create = async () => {
    const entry = name.trim();
    if (!entry) return;
    const existing = options.find(o => o.toLowerCase() === entry.toLowerCase());
    const r = await act(async () => {
      if (!existing) await add(entry, group);
      return entry === value ? 0 : mergeProfileValue(kind, value, existing ?? entry);
    }, k => existing ? `Merged into ${existing} for ${k} ${k === 1 ? "person" : "people"}` : `Created “${entry}”${entry === value ? "" : ` and used it for ${people}`}`);
    if (r !== undefined) setCreating(false);
  };
  return (
    <div class="stack-s" style="padding:8px 10px;border-radius:12px;background:#FAFBFE">
      <div class="row" style="justify-content:space-between;gap:8px">
        <span><strong style="color:var(--color-text-heading)">{value}</strong> <span class="muted small">· {people}</span></span>
        <span class="row" style="gap:6px">
          <button class="btn btn--secondary btn--sm" aria-expanded={creating} onClick={() => { setCreating(!creating); setName(value); }}>New entry…</button>
          <div style="width:230px">
            <ListPicker small allowOther={false} label={`Merge ${value} into`} placeholder="Merge into… (type to search)"
              options={pickerOptions} value={[]}
              onChange={async v => {
                const to = v[v.length - 1];
                if (to && await confirmDialog({ title: "Merge entry?", confirmLabel: "Merge",
                  message: `Replace “${value}” with “${to}” for ${people}?` }))
                  act(() => mergeProfileValue(kind, value, to), k => `Merged for ${k} ${k === 1 ? "person" : "people"}`);
              }} />
          </div>
          <button class="btn btn--ghost btn--sm" onClick={async () => {
            if (await confirmDialog({ title: "Deny entry?", danger: true, confirmLabel: "Deny",
              message: `Remove “${value}” from the profile of ${people}? Their other entries stay; the original application answers aren't changed.` }))
              act(() => removeProfileValue(kind, value), k => `Removed “${value}” from ${k} ${k === 1 ? "profile" : "profiles"}`);
          }}>Deny</button>
        </span>
      </div>
      {creating && (
        <form class="row" style="flex-wrap:nowrap;gap:6px" onSubmit={e => { e.preventDefault(); create(); }}>
          <input class="input input--sm" value={name} onInput={e => setName(e.currentTarget.value)} aria-label="Name of the new entry" autoFocus />
          {kind === "university" && <input class="input input--sm" style="max-width:120px" placeholder="City" value={city} onInput={e => setCity(e.currentTarget.value)} aria-label="City" />}
          <GroupSelect label={groupLabel} groups={groups} value={group} onChange={setGroup} />
          <button class="btn btn--primary btn--sm" disabled={!name.trim() || (!exists && missing)}
            title={exists ? "This entry exists already: the value is merged into it" : missing ? (kind === "university" ? "City and country are required" : `Choose a ${groupLabel.toLowerCase()} first`) : ""}>
            {exists ? "Use existing" : "Create & use"}
          </button>
        </form>
      )}
      {creating && name.trim() && name.trim() !== value && (
        <span class="muted small">{people} will have “{exists ? options.find(o => o.toLowerCase() === name.trim().toLowerCase()) : name.trim()}” instead of “{value}”.</span>
      )}
    </div>
  );
}

function ProfileLists() {
  const s = useStore(x => x);
  const [uniName, setUniName] = useState("");
  const [uniCity, setUniCity] = useState("");
  const [uniCountry, setUniCountry] = useState("");
  const [progName, setProgName] = useState("");
  const [progCat, setProgCat] = useState("");
  const [qU, setQU] = useState("");
  const [qP, setQP] = useState("");
  const [qC, setQC] = useState("");
  const [coName, setCoName] = useState("");
  const [coCat, setCoCat] = useState("");
  const coCategories = [...new Set(s.companies.map(c => c.category))].sort();
  const categories = [...new Set(s.studyPrograms.map(p => p.category))].sort();
  const countries = [...new Set(s.universities.map(u => u.country).filter((c): c is string => !!c))].sort();

  // Values entered via "Other" that aren't in the lists yet, with how many people use them
  const listOf = (kind: ListKind) => (kind === "university" ? s.universities : kind === "company" ? s.companies : s.studyPrograms);
  const valuesOf = (p: (typeof s.people)[number], kind: ListKind) =>
    kind === "university" ? p.universities : kind === "company" ? [...new Set(p.companies.map(c => c.company))]
    : p.studyPrograms;
  const unlisted = (kind: ListKind) => {
    const list = new Set(listOf(kind).map(x => x.name));
    const counts = new Map<string, number>();
    for (const p of s.people) for (const v of valuesOf(p, kind)) {
      if (!list.has(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  };
  // How many people use each entry (computed once per data load)
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of s.people) for (const k of ["university", "studyProgram", "company"] as ListKind[]) for (const v of valuesOf(p, k)) m.set(`${k}:${v}`, (m.get(`${k}:${v}`) ?? 0) + 1);
    return m;
  }, [s.people]);
  const used = (kind: ListKind, name: string) => usage.get(`${kind}:${name}`) ?? 0;
  const uniMatches = useMemo(() => {
    const ql = qU.trim().toLowerCase();
    const list = ql
      ? s.universities.filter(u => u.name.toLowerCase().includes(ql) || u.aliases.some(a => a.toLowerCase().includes(ql)) || (u.country ?? "").toLowerCase().includes(ql))
      : s.universities.filter(u => used("university", u.name) > 0);
    return list.slice(0, 200);
  }, [qU, s.universities, usage]);

  const remove = async (kind: ListKind, id: string, name: string) => {
    const n = used(kind, name);
    if (await confirmDialog({
      title: "Remove from list?", danger: true, confirmLabel: "Remove",
      message: `Remove “${name}” from the list?` + (n ? `\n\n${n} ${n === 1 ? "person keeps" : "people keep"} it in their profile; it then shows up under “Entered via Other”.` : ""),
    })) act(() => removeListEntry(kind, id), `Removed ${name}`);
  };

  const Unlisted = ({ kind }: { kind: ListKind }) => {
    const rows = unlisted(kind);
    const options = listOf(kind).map(x => x.name).sort();
    // For "Merge into…": search by name, abbreviation, country / field
    const pickerOptions: PickerOption[] = kind === "university"
      ? s.universities.map(u => ({ name: u.name, hint: u.country ?? u.city, terms: u.aliases }))
      : kind === "company"
      ? s.companies.map(c => ({ name: c.name, hint: c.category, terms: c.aliases }))
      : s.studyPrograms.map(p => ({ name: p.name, hint: p.category }));
    if (!rows.length) return <p class="muted small">Nothing entered via “Other” yet.</p>;
    return (
      <div class="stack-s">
        {rows.map(([value, n]) => (
          <UnlistedRow kind={kind} value={value} n={n} options={options} pickerOptions={pickerOptions}
            groups={kind === "company" ? coCategories : kind === "studyProgram" ? categories : countries} />
        ))}
      </div>
    );
  };

  return (
    <section class="stack">
      <div class="stack-s">
        <h2>Universities, study programs & companies</h2>
        <p class="muted small">The choices for “University affiliations”, “Study program(s)”, and “Company affiliations” in forms (research groups are free text with a university from this list). Applicants can pick several, or “Other (please specify)”; those entries appear below: make a new list entry from them, merge them into an existing one, or deny them.</p>
      </div>
      <div class="grid-2" style="align-items:start">
        <div class="card stack-s">
          <div class="row row--between"><h3>Universities</h3><span class="chip">{s.universities.length}</span></div>
          <input class="input input--sm" placeholder="Search name, local name, abbreviation or country…" value={qU} onInput={e => setQU(e.currentTarget.value)} aria-label="Search universities" />
          <div class="list-box">
            {!qU.trim() && <p class="muted small" style="padding:6px 8px">{uniMatches.length ? "Universities people chose so far. Search to see all." : "Search to see the list."}</p>}
            {uniMatches.map(u => (
              <div class="list-row">
                <span>{u.name}{(u.country || u.city) && <span class="muted small"> · {u.country ?? u.city}</span>}<span class="muted small"> · {used("university", u.name)} people</span></span>
                <button class="icon-btn" aria-label={`Remove ${u.name}`} onClick={() => remove("university", u.id, u.name)}><IconX /></button>
              </div>
            ))}
          </div>
          <form class="row" style="flex-wrap:nowrap" onSubmit={e => { e.preventDefault(); act(() => addUniversity(uniName, uniCity, uniCountry), `Added ${uniName}`).then(() => { setUniName(""); setUniCity(""); }); }}>
            <input class="input input--sm" placeholder="New university" value={uniName} onInput={e => setUniName(e.currentTarget.value)} aria-label="New university" />
            <input class="input input--sm" style="max-width:110px" placeholder="City" value={uniCity} onInput={e => setUniCity(e.currentTarget.value)} aria-label="City" />
            <GroupSelect label="Country" groups={countries} value={uniCountry} onChange={setUniCountry} />
            <button class="btn btn--secondary btn--sm" disabled={!uniName.trim() || !uniCity.trim() || !uniCountry.trim()} title={uniCity.trim() && uniCountry.trim() ? "" : "City and country are required"}>Add</button>
          </form>
          <h3 style="margin-top:10px">Entered via “Other”</h3>
          <Unlisted kind="university" />
        </div>

        <div class="card stack-s">
          <div class="row row--between"><h3>Study programs</h3><span class="chip">{s.studyPrograms.length}</span></div>
          <input class="input input--sm" placeholder="Search…" value={qP} onInput={e => setQP(e.currentTarget.value)} aria-label="Search study programs" />
          <div class="list-box">
            {categories.map(cat => {
              const items = s.studyPrograms.filter(p => p.category === cat && (!qP || p.name.toLowerCase().includes(qP.toLowerCase())));
              if (!items.length) return null;
              return (
                <>
                  <div class="picker__group">{cat}</div>
                  {items.map(p => (
                    <div class="list-row">
                      <span>{p.name}<span class="muted small"> · {used("studyProgram", p.name)}</span></span>
                      <button class="icon-btn" aria-label={`Remove ${p.name}`} onClick={() => remove("studyProgram", p.id, p.name)}><IconX /></button>
                    </div>
                  ))}
                </>
              );
            })}
          </div>
          <form class="row" style="flex-wrap:nowrap" onSubmit={e => { e.preventDefault(); act(() => addStudyProgram(progName, progCat), `Added ${progName}`).then(() => setProgName("")); }}>
            <input class="input input--sm" placeholder="New study program" value={progName} onInput={e => setProgName(e.currentTarget.value)} aria-label="New study program" />
            <GroupSelect label="Field" groups={categories} value={progCat} onChange={setProgCat} />
            <button class="btn btn--secondary btn--sm" disabled={!progName.trim() || !progCat.trim()} title={progCat.trim() ? "" : "Choose a field first"}>Add</button>
          </form>
          <h3 style="margin-top:10px">Entered via “Other”</h3>
          <Unlisted kind="studyProgram" />
        </div>
      </div>

      <div class="card stack-s">
        <div class="row row--between"><h3>Companies</h3><span class="chip">{s.companies.length}</span></div>
        <input class="input input--sm" placeholder="Search name, abbreviation or sector…" value={qC} onInput={e => setQC(e.currentTarget.value)} aria-label="Search companies" />
        <div class="list-box">
          {coCategories.map(cat => {
            const ql = qC.trim().toLowerCase();
            const items = s.companies.filter(c => c.category === cat && (!ql || c.name.toLowerCase().includes(ql) || c.aliases.some(a => a.toLowerCase().includes(ql)) || cat.toLowerCase().includes(ql)));
            if (!items.length) return null;
            return (
              <>
                <div class="picker__group">{cat}</div>
                {items.map(c => (
                  <div class="list-row">
                    <span>{c.name}{c.aliases.length > 0 && <span class="muted small"> · {c.aliases.join(", ")}</span>}<span class="muted small"> · {used("company", c.name)} people</span></span>
                    <button class="icon-btn" aria-label={`Remove ${c.name}`} onClick={() => remove("company", c.id, c.name)}><IconX /></button>
                  </div>
                ))}
              </>
            );
          })}
        </div>
        <form class="row" style="flex-wrap:nowrap" onSubmit={e => { e.preventDefault(); act(() => addCompany(coName, coCat), `Added ${coName}`).then(() => setCoName("")); }}>
          <input class="input input--sm" placeholder="New company" value={coName} onInput={e => setCoName(e.currentTarget.value)} aria-label="New company" />
          <GroupSelect label="Sector" groups={coCategories} value={coCat} onChange={setCoCat} />
          <button class="btn btn--secondary btn--sm" disabled={!coName.trim() || !coCat.trim()} title={coCat.trim() ? "" : "Choose a sector first"}>Add</button>
        </form>
        <h3 style="margin-top:10px">Entered via “Other”</h3>
        <Unlisted kind="company" />
      </div>

    </section>
  );
}
