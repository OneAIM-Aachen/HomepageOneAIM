import { useEffect, useMemo, useState } from "preact/hooks";
import type { Account } from "../../lib/types";
import {
  addStudyProgram, addTag, addUniversity, changePassword, loadEmailSettings, mergeProfileValue, removeListEntry, removeTag,
  saveEmailSettings, sendQueuedNow, useStore, type EmailSettings, type TagListKey,
} from "../../lib/store";
import { TeamShell, PageHead } from "./TeamShell";
import { act, confirmDialog, Field } from "../ui/Ui";
import { IconX } from "../ui/Icons";

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
      <PageHead overline="Settings" title="Settings" sub="Tag lists, university and study program lists, emails and city accounts." />

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
            {acc.memberId && <a class="btn btn--secondary btn--sm" href={`/team/team?member=${acc.memberId}`}>Edit my team profile</a>}
            <a class="btn btn--ghost btn--sm" href="/team/team">Team overview</a>
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
        <Field label="Link base for emails" help="Where interview booking links point. Later: https://apply.one-aim.org">
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

function ProfileLists() {
  const s = useStore(x => x);
  const [uniName, setUniName] = useState("");
  const [uniCity, setUniCity] = useState("");
  const [progName, setProgName] = useState("");
  const [progCat, setProgCat] = useState("");
  const [qU, setQU] = useState("");
  const [qP, setQP] = useState("");
  const categories = [...new Set(s.studyPrograms.map(p => p.category))].sort();

  // Values entered via "Other" that aren't in the lists yet, with how many people use them
  const unlisted = (kind: "university" | "studyProgram") => {
    const list = new Set((kind === "university" ? s.universities : s.studyPrograms).map(x => x.name));
    const counts = new Map<string, number>();
    for (const p of s.people) for (const v of kind === "university" ? p.universities : p.studyPrograms) {
      if (!list.has(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1]);
  };
  // How many people use each entry (computed once per data load)
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of s.people) for (const v of [...p.universities.map(u => `u:${u}`), ...p.studyPrograms.map(x => `p:${x}`)]) m.set(v, (m.get(v) ?? 0) + 1);
    return m;
  }, [s.people]);
  const used = (kind: "university" | "studyProgram", name: string) => usage.get(`${kind === "university" ? "u" : "p"}:${name}`) ?? 0;
  const uniMatches = useMemo(() => {
    const ql = qU.trim().toLowerCase();
    const list = ql
      ? s.universities.filter(u => u.name.toLowerCase().includes(ql) || u.aliases.some(a => a.toLowerCase().includes(ql)) || (u.country ?? "").toLowerCase().includes(ql))
      : s.universities.filter(u => used("university", u.name) > 0);
    return list.slice(0, 200);
  }, [qU, s.universities, usage]);

  const remove = async (kind: "university" | "studyProgram", id: string, name: string) => {
    const n = used(kind, name);
    if (await confirmDialog({
      title: "Remove from list?", danger: true, confirmLabel: "Remove",
      message: `Remove “${name}” from the list?` + (n ? `\n\n${n} ${n === 1 ? "person keeps" : "people keep"} it in their profile; it then shows up under “Entered via Other”.` : ""),
    })) act(() => removeListEntry(kind, id), `Removed ${name}`);
  };

  const Unlisted = ({ kind }: { kind: "university" | "studyProgram" }) => {
    const rows = unlisted(kind);
    const options = (kind === "university" ? s.universities : s.studyPrograms).map(x => x.name).sort();
    if (!rows.length) return <p class="muted small">Nothing entered via “Other” yet.</p>;
    return (
      <div class="stack-s">
        {rows.map(([value, n]) => (
          <div class="row" style="justify-content:space-between;gap:8px;padding:8px 10px;border-radius:12px;background:#FAFBFE">
            <span><strong style="color:var(--color-text-heading)">{value}</strong> <span class="muted small">· {n} {n === 1 ? "person" : "people"}</span></span>
            <span class="row" style="gap:6px">
              <button class="btn btn--secondary btn--sm" onClick={() => act(() => kind === "university" ? addUniversity(value) : addStudyProgram(value, "Other"), `Added ${value} to the list`)}>Add to list</button>
              <select class="input input--sm" style="width:auto;max-width:220px" aria-label={`Merge ${value} into`} value=""
                onChange={async e => {
                  const to = e.currentTarget.value;
                  if (to && await confirmDialog({ title: "Merge entry?", confirmLabel: "Merge",
                    message: `Replace “${value}” with “${to}” for ${n} ${n === 1 ? "person" : "people"}?` }))
                    act(() => mergeProfileValue(kind, value, to), k => `Merged for ${k} ${k === 1 ? "person" : "people"}`);
                }}>
                <option value="">Merge into…</option>
                {options.map(o => <option>{o}</option>)}
              </select>
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section class="stack">
      <div class="stack-s">
        <h2>Universities & study programs</h2>
        <p class="muted small">The choices for “University affiliations” and “Study program(s)” in every form. Applicants can pick several, or “Other (please specify)”; those entries appear below and can be added or merged.</p>
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
          <form class="row" style="flex-wrap:nowrap" onSubmit={e => { e.preventDefault(); act(() => addUniversity(uniName, uniCity), `Added ${uniName}`).then(() => { setUniName(""); setUniCity(""); }); }}>
            <input class="input input--sm" placeholder="New university" value={uniName} onInput={e => setUniName(e.currentTarget.value)} aria-label="New university" />
            <input class="input input--sm" style="max-width:120px" placeholder="City (optional)" value={uniCity} onInput={e => setUniCity(e.currentTarget.value)} aria-label="City" />
            <button class="btn btn--secondary btn--sm" disabled={!uniName.trim()}>Add</button>
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
            <input class="input input--sm" style="max-width:170px" list="prog-cats" placeholder="Field" value={progCat} onInput={e => setProgCat(e.currentTarget.value)} aria-label="Field" />
            <datalist id="prog-cats">{categories.map(c => <option value={c} />)}</datalist>
            <button class="btn btn--secondary btn--sm" disabled={!progName.trim()}>Add</button>
          </form>
          <h3 style="margin-top:10px">Entered via “Other”</h3>
          <Unlisted kind="studyProgram" />
        </div>
      </div>
    </section>
  );
}
