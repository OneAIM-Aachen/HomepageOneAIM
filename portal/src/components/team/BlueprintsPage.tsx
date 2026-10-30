import { useState } from "preact/hooks";
import type { Blueprint, Scorecard } from "../../lib/types";
import { createBlueprint, deleteBlueprint, deleteScorecardTemplate, formOptionsFromState, getState, saveBlueprint, saveScorecardTemplate, useStore } from "../../lib/store";
import { ScorecardEditor, scorecardValid } from "./Review";
import { fmtDate } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { FormBuilder } from "./FormBuilder";
import { FormRenderer } from "../apply/FormRenderer";
import { act, confirmDialog, Field, Modal, useParam } from "../ui/Ui";
import { IconCopy, IconPlus, IconTrash } from "../ui/Icons";

export default function BlueprintsPage() {
  const id = useParam("id");
  const startNew = useParam("new") === "1";
  return (
    <TeamShell active="blueprints">
      {() => (id ? <Editor id={id} /> : <List startNew={startNew} />)}
    </TeamShell>
  );
}

function List({ startNew }: { startNew: boolean }) {
  const s = useStore(x => x);
  const [creating, setCreating] = useState<Blueprint["kind"] | null>(startNew ? "application" : null);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");

  const create = async () => {
    const src = s.blueprints.find(b => b.id === from);
    const id = await act(() => createBlueprint(name, src, creating ?? "application"));
    if (id) window.location.href = `/team/blueprints?id=${id}`;
  };
  const open = (kind: Blueprint["kind"]) => { setName(""); setFrom(""); setCreating(kind); };

  return (
    <div class="stack" style="gap:22px">
      <PageHead overline="Blueprints" title="Blueprints"
        sub="Reusable forms: application forms, feedback forms for participants and scorecards. Applications get a copy, so editing a blueprint never changes existing applications."
        actions={<button class="btn btn--primary" onClick={() => open("application")}><IconPlus width={18} />New blueprint</button>} />

      <BlueprintGrid kind="application" />

      <section class="stack">
        <div class="row row--between" style="align-items:flex-end">
          <div class="stack-s">
            <h2>Feedback forms</h2>
            <p class="muted small">Questions for the participants after a program. Pick one in an application under “Participant feedback”; it's copied there and the link is sent at the time you set.</p>
          </div>
          <button class="btn btn--secondary" onClick={() => open("feedback")}><IconPlus width={18} />New feedback form</button>
        </div>
        <BlueprintGrid kind="feedback" />
      </section>

      <ScorecardTemplates />

      {creating && (
        <Modal title={creating === "feedback" ? "New feedback form" : "New blueprint"} onClose={() => setCreating(null)}>
          <Field label="Name" required>
            <input class="input" value={name} placeholder={creating === "feedback" ? "e.g. AIM Connect – feedback" : "e.g. AIM Connect – short form"} onInput={e => setName(e.currentTarget.value)} autoFocus />
          </Field>
          <Field label="Start from">
            <select class="input" value={from} onChange={e => setFrom(e.currentTarget.value)}>
              <option value="">{creating === "feedback" ? "Empty form" : "Empty form (name + email)"}</option>
              {s.blueprints.filter(b => b.kind === creating).map(b => <option value={b.id}>Copy of “{b.name}”</option>)}
            </select>
          </Field>
          <div class="row" style="justify-content:flex-end">
            <button class="btn btn--ghost" onClick={() => setCreating(null)}>Cancel</button>
            <button class="btn btn--primary" disabled={!name.trim()} onClick={create}>{creating === "feedback" ? "Create feedback form" : "Create blueprint"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function BlueprintGrid({ kind }: { kind: Blueprint["kind"] }) {
  const s = useStore(x => x);
  const list = s.blueprints.filter(b => b.kind === kind);
  if (!list.length) return <div class="empty">No {kind === "feedback" ? "feedback forms" : "blueprints"} yet.</div>;
  return (
      <div class="app-grid">
        {list.map(b => {
          const used = kind === "feedback"
            ? s.feedbacks.filter(f => f.blueprintName === b.name).length
            : s.applications.filter(a => a.blueprintName === b.name).length;
          return (
            <div class="card stack-s" style="gap:12px">
              <div class="row row--between" style="align-items:flex-start">
                <a href={`/team/blueprints?id=${b.id}`} style="font-weight:800;font-size:1.05rem;color:var(--color-text-heading)">{b.name}</a>
                <span class="chip">{b.fields.length} {kind === "feedback" ? "questions" : "fields"}</span>
              </div>
              <p class="muted small" style="min-height:40px">{b.description || "No description."}</p>
              <div class="row" style="flex-wrap:wrap;gap:6px">
                {b.fields.slice(kind === "feedback" ? 0 : 2, kind === "feedback" ? 5 : 7).map(f => <span class="chip chip--outline">{f.label.length > 26 ? f.label.slice(0, 24) + "…" : f.label}</span>)}
                {b.fields.length > 7 && <span class="chip chip--outline">+{b.fields.length - 7}</span>}
              </div>
              <div class="app-card__foot" style="align-items:center">
                <span>Updated {fmtDate(b.updatedAt)}{used ? ` · used ${used}×` : ""}</span>
                <span class="row" style="gap:2px">
                  <button class="icon-btn" title="Duplicate" aria-label="Duplicate"
                    onClick={() => act(() => createBlueprint(`${b.name} (copy)`, b), kind === "feedback" ? "Feedback form duplicated" : "Blueprint duplicated")}><IconCopy /></button>
                  <button class="icon-btn" title="Delete" aria-label="Delete"
                    onClick={async () => {
                      if (await confirmDialog({ title: "Delete blueprint?", danger: true, confirmLabel: "Delete blueprint",
                        message: `Do you really want to delete the ${kind === "feedback" ? "feedback form" : "blueprint"} "${b.name}"?\n\nApplications that use it keep their copy.` }))
                        act(() => deleteBlueprint(b.id), "Blueprint deleted");
                    }}><IconTrash /></button>
                  <a class="btn btn--secondary btn--sm" href={`/team/blueprints?id=${b.id}`}>Edit</a>
                </span>
              </div>
            </div>
          );
        })}
      </div>
  );
}

function Editor({ id }: { id: string }) {
  const original = useStore(s => s.blueprints.find(b => b.id === id));
  const [draft, setDraft] = useState<Blueprint | undefined>(original ? structuredClone(original) : undefined);
  const [preview, setPreview] = useState(false);

  if (!original || !draft) return <div class="empty">This blueprint does not exist. <a href="/team/blueprints">Back to blueprints</a></div>;

  const content = (b: Blueprint) => JSON.stringify([b.name, b.description, b.fields]);
  const dirty = content(draft) !== content(original);
  const save = () => act(() => saveBlueprint(draft), "Blueprint saved");

  const feedback = original.kind === "feedback";
  return (
    <div class="stack" style="gap:22px">
      <PageHead crumbs={[{ label: "Blueprints", href: "/team/blueprints" }, { label: original.name }]}
        overline={feedback ? "Feedback form" : undefined}
        title={draft.name || "Untitled blueprint"}
        actions={<>
          <button class="btn btn--secondary" onClick={() => setPreview(true)}>Preview form</button>
          {!feedback && <a class="btn btn--secondary" href="/team/applications?new=1">Use for new application</a>}
          <button class="btn btn--primary" disabled={!dirty} onClick={save}>{dirty ? "Save changes" : "Saved"}</button>
        </>} />

      <div class="card grid-2">
        <Field label="Blueprint name" required>
          <input class="input" value={draft.name} onInput={e => setDraft({ ...draft, name: e.currentTarget.value })} />
        </Field>
        <Field label={feedback ? "Intro text" : "Description"} help={feedback ? "Shown above the questions, e.g. a thank-you and how long it takes." : "Shown when choosing a blueprint, and used as default intro text."}>
          <input class="input" value={draft.description} onInput={e => setDraft({ ...draft, description: e.currentTarget.value })} />
        </Field>
      </div>

      <FormBuilder fields={draft.fields} onChange={fields => setDraft({ ...draft, fields })} feedback={feedback} />

      {preview && (
        <Modal title="Form preview" onClose={() => setPreview(false)} wide>
          {feedback && draft.description && <p>{draft.description}</p>}
          <FormRenderer fields={draft.fields} preview consent={!feedback} submitLabel={feedback ? "Send feedback" : undefined} options={formOptionsFromState(getState())} />
        </Modal>
      )}
    </div>
  );
}

/** Scorecard templates: rating forms with weighted categories, copied into applications */
function ScorecardTemplates() {
  const cards = useStore(x => x.scorecards);
  const apps = useStore(x => x.applications);
  const [edit, setEdit] = useState<Scorecard | null>(null);
  const usedBy = (name: string) => apps.filter(a => Object.values(a.scorecards).some(c => c?.name === name)).length;

  return (
    <section class="stack">
      <div class="row row--between" style="align-items:flex-end">
        <div class="stack-s">
          <h2>Scorecards</h2>
          <p class="muted small">Rating forms for screening and interviews: categories rated 1–5, with weights. Applications get a copy, so editing a template never changes running applications.</p>
        </div>
        <button class="btn btn--secondary" onClick={() => setEdit({ name: "", description: "", criteria: [] })}><IconPlus width={18} />New scorecard</button>
      </div>
      <div class="app-grid">
        {cards.map(c => (
          <div class="card stack-s" style="gap:12px">
            <div class="row row--between" style="align-items:flex-start">
              <strong style="font-size:1.05rem;color:var(--color-text-heading)">{c.name}</strong>
              <span class="chip">{c.criteria.length} categories</span>
            </div>
            <p class="muted small">{c.description || "No description."}</p>
            <div class="row" style="gap:6px">{c.criteria.map(x => <span class="chip chip--outline">{x.label}{x.weight > 1 ? ` ×${x.weight}` : ""}</span>)}</div>
            <div class="app-card__foot" style="align-items:center">
              <span>{usedBy(c.name) ? `used in ${usedBy(c.name)} application${usedBy(c.name) > 1 ? "s" : ""}` : "not used yet"}</span>
              <span class="row" style="gap:2px">
                <button class="icon-btn" title="Duplicate" aria-label="Duplicate"
                  onClick={() => setEdit({ name: `${c.name} (copy)`, description: c.description, criteria: structuredClone(c.criteria) })}><IconCopy /></button>
                <button class="icon-btn" title="Delete" aria-label="Delete" onClick={async () => {
                  if (await confirmDialog({ title: "Delete scorecard?", danger: true, confirmLabel: "Delete", message: `Delete the template “${c.name}”? Applications keep their copy.` }))
                    act(() => deleteScorecardTemplate(c.id!), "Scorecard deleted");
                }}><IconTrash /></button>
                <button class="btn btn--secondary btn--sm" onClick={() => setEdit(structuredClone(c))}>Edit</button>
              </span>
            </div>
          </div>
        ))}
      </div>
      {edit && (
        <Modal title={edit.id ? "Edit scorecard" : "New scorecard"} onClose={() => setEdit(null)} wide>
          <ScorecardEditor value={edit} onChange={setEdit} />
          <div class="row" style="justify-content:flex-end">
            <button class="btn btn--ghost" onClick={() => setEdit(null)}>Cancel</button>
            <button class="btn btn--primary" disabled={!scorecardValid(edit)}
              onClick={() => act(() => saveScorecardTemplate(edit), "Scorecard saved").then(r => { if (r !== undefined) setEdit(null); })}>Save scorecard</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
