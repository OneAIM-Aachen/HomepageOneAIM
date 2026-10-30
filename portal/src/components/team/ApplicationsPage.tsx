import { useState } from "preact/hooks";
import type { Account, Pipeline } from "../../lib/types";
import { actorLabel, createApplication, useStore } from "../../lib/store";
import { appPhase, appTitle, fmtShort, PIPELINES, type AppPhase } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { act, Field, Modal, PhaseChip, useParam } from "../ui/Ui";
import { IconPlus } from "../ui/Icons";

export default function ApplicationsPage() {
  const startNew = useParam("new") === "1";
  return (
    <TeamShell active="applications">
      {acc => <Applications acc={acc} startNew={startNew} />}
    </TeamShell>
  );
}

const PHASES: (AppPhase | "all")[] = ["all", "open", "upcoming", "draft", "closed"];

function Applications({ acc, startNew }: { acc: Account; startNew: boolean }) {
  const s = useStore(x => x);
  const [creating, setCreating] = useState(startNew);
  const [phase, setPhase] = useState<AppPhase | "all">("all");
  const [loc, setLoc] = useState("");
  const [prog, setProg] = useState("");
  const [sem, setSem] = useState("");

  const list = s.applications
    .filter(a => phase === "all" || appPhase(a) === phase)
    .filter(a => !loc || a.tags.location === loc)
    .filter(a => !prog || a.tags.program === prog)
    .filter(a => !sem || a.tags.semester === sem);

  // By time: latest application deadline first (demo and real mixed)
  list.sort((a, b) => b.dates.deadline.localeCompare(a.dates.deadline) || b.dates.opensAt.localeCompare(a.dates.opensAt));

  return (
    <div class="stack" style="gap:22px">
      <PageHead overline="Applications" title="Applications"
        sub="Each application is one round for a program, city and semester. Create it from a blueprint, then manage applicants through its pipeline."
        actions={<button class="btn btn--primary" onClick={() => setCreating(true)}><IconPlus width={18} />New application</button>} />

      <div class="row">
        {PHASES.map(p => (
          <button class={`chip-btn ${phase === p ? "is-active" : ""}`} onClick={() => setPhase(p)}>
            {p === "all" ? "All" : p[0]!.toUpperCase() + p.slice(1)}
            <span style="opacity:.7;margin-left:6px">{p === "all" ? s.applications.length : s.applications.filter(a => appPhase(a) === p).length}</span>
          </button>
        ))}
        <span class="spacer" />
        <select class="input input--sm" style="width:auto" value={loc} onChange={e => setLoc(e.currentTarget.value)} aria-label="Location">
          <option value="">All locations</option>{s.tagLists.locations.map(t => <option>{t}</option>)}
        </select>
        <select class="input input--sm" style="width:auto" value={prog} onChange={e => setProg(e.currentTarget.value)} aria-label="Program">
          <option value="">All programs</option>{s.tagLists.programs.map(t => <option>{t}</option>)}
        </select>
        <select class="input input--sm" style="width:auto" value={sem} onChange={e => setSem(e.currentTarget.value)} aria-label="Semester">
          <option value="">All semesters</option>{s.tagLists.semesters.map(t => <option>{t}</option>)}
        </select>
      </div>

      {list.length === 0
        ? <div class="empty">No applications match these filters.</div>
        : <div class="app-grid">
            {list.map(a => {
              const subs = s.submissions.filter(x => x.applicationId === a.id);
              const c = (st: string) => subs.filter(x => x.status === st).length;
              const total = subs.length || 1;
              return (
                <a class="app-card" href={`/team/application?id=${a.id}`}>
                  <div class="app-card__img" style={a.image ? `background-image:url(${a.image})` : ""}>
                    <PhaseChip phase={appPhase(a)} />
                  </div>
                  <div class="app-card__body">
                    <span class="app-card__title">{appTitle(a)}</span>
                    <div class="app-card__meta">
                      <span class="chip chip--outline">{a.tags.program}</span>
                      <span class="chip chip--outline">{a.tags.location}</span>
                      <span class="chip chip--outline">{a.tags.semester}</span>
                      <span class="chip chip--purple">{PIPELINES[a.pipeline].short}</span>
                    </div>
                    <div class="funnel" title="New · Interview · Accepted/Confirmed · Rejected">
                      <span style={`width:${(c("new") / total) * 100}%;background:var(--color-brand-blue)`} />
                      <span style={`width:${(c("invited") / total) * 100}%;background:var(--color-accent-purple)`} />
                      <span style={`width:${((c("accepted") + c("confirmed")) / total) * 100}%;background:var(--p-green)`} />
                      <span style={`width:${(c("rejected") / total) * 100}%;background:#E8A0AA`} />
                    </div>
                    <div class="app-card__foot">
                      <span><strong>{subs.length}</strong> applicants{a.spots ? ` · ${a.spots} spots` : ""}</span>
                      <span>Deadline <strong>{fmtShort(a.dates.deadline)}</strong></span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>}

      {creating && <NewApplicationModal acc={acc} onClose={() => setCreating(false)} />}
    </div>
  );
}

function NewApplicationModal({ acc, onClose }: { acc: Account; onClose: () => void }) {
  const s = useStore(x => x);
  const [bp, setBp] = useState(s.blueprints[0]?.id ?? "");
  const [semester, setSemester] = useState(s.tagLists.semesters.find(x => x.startsWith("SS 27")) ?? s.tagLists.semesters[0] ?? "");
  const [program, setProgram] = useState(s.tagLists.programs[0] ?? "");
  const [location, setLocation] = useState(s.tagLists.locations.includes(acc.city) ? acc.city : s.tagLists.locations[0] ?? "");
  const [pipeline, setPipeline] = useState<Pipeline>("interview");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const id = await act(() => createApplication({ blueprintId: bp, tags: { semester, program, location }, pipeline, title, createdBy: actorLabel(acc) }));
    if (id) window.location.href = `/team/application?id=${id}&tab=setup&created=1`;
    else setBusy(false);
  };

  return (
    <Modal title="New application" onClose={onClose} wide>
      <div class="stack-s">
        <span class="field__label">1. Start from a blueprint</span>
        <span class="field__help">The blueprint's form is copied. Later changes to the blueprint don't affect this application.</span>
        <div class="grid-2">
          {s.blueprints.map(b => (
            <button type="button" class={`slot ${bp === b.id ? "is-active" : ""}`} onClick={() => setBp(b.id)}>
              <strong>{b.name}</strong>
              <span class="muted small">{b.fields.length} fields · {b.description || "No description"}</span>
            </button>
          ))}
        </div>
        <a class="small" href="/team/blueprints?new=1">+ Create a new blueprint first</a>
      </div>

      <div class="stack-s">
        <span class="field__label">2. Tags</span>
        <div class="grid-3">
          <Field label="Semester" required>
            <select class="input" value={semester} onChange={e => setSemester(e.currentTarget.value)}>{s.tagLists.semesters.map(t => <option>{t}</option>)}</select>
          </Field>
          <Field label="Program" required>
            <select class="input" value={program} onChange={e => setProgram(e.currentTarget.value)}>{s.tagLists.programs.map(t => <option>{t}</option>)}</select>
          </Field>
          <Field label="Location" required>
            <select class="input" value={location} onChange={e => setLocation(e.currentTarget.value)}>{s.tagLists.locations.map(t => <option>{t}</option>)}</select>
          </Field>
        </div>
        <span class="field__help">Missing an option? Add it under <a href="/team/settings">Settings → Tags</a>.</span>
      </div>

      <div class="stack-s">
        <span class="field__label">3. Pipeline</span>
        <div class="grid-3">
          {(Object.keys(PIPELINES) as Pipeline[]).map(p => (
            <button type="button" class={`slot ${pipeline === p ? "is-active" : ""}`} onClick={() => setPipeline(p)}>
              <strong>{PIPELINES[p].label}</strong>
              <span class="muted small">{PIPELINES[p].description}</span>
            </button>
          ))}
        </div>
      </div>

      <Field label="Custom title (optional)" help={`Default: "${program} ${location} – ${semester}". Useful for events.`}>
        <input class="input" value={title} placeholder="e.g. Health AI Summit Frankfurt" onInput={e => setTitle(e.currentTarget.value)} />
      </Field>

      <div class="row" style="justify-content:flex-end">
        <button class="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button class="btn btn--primary" disabled={busy || !bp || !semester || !program || !location} onClick={create}>{busy ? "Creating…" : "Create application"}</button>
      </div>
    </Modal>
  );
}
