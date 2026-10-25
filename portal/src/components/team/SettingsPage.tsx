import { useEffect, useState } from "preact/hooks";
import type { Account } from "../../lib/types";
import {
  addTag, changePassword, loadEmailSettings, removeTag, saveEmailSettings, sendQueuedNow, useStore,
  type EmailSettings, type TagListKey,
} from "../../lib/store";
import { TeamShell, PageHead } from "./TeamShell";
import { act, Field } from "../ui/Ui";
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
      <PageHead overline="Settings" title="Settings" sub="Tag lists, emails and city accounts." />

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
          <h2>City accounts</h2>
          <p class="muted small">One login per city. All accounts have full access to all cities.</p>
          <table class="table" style="margin-top:8px">
            <tbody>
              {s.teamCities.map(c => (
                <tr><td><strong style="color:var(--color-text-heading)">{c}</strong></td>
                  <td class="small">{c === acc.city ? acc.email : ""}</td>
                  <td class="num">{c === acc.city ? <span class="chip chip--blue">You</span> : null}</td></tr>
              ))}
            </tbody>
          </table>
          <p class="muted small">New city: create a user in the Supabase dashboard (Authentication → Users) and add it to <span class="mono">team_accounts</span>, see docs/supabase-setup.md.</p>
        </div>
        <form class="card stack" onSubmit={e => {
          e.preventDefault();
          act(() => changePassword(pw), "Password changed").then(() => { setPw(""); setPw2(""); });
        }}>
          <h2>Change password ({acc.city})</h2>
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
