import { useState } from "preact/hooks";
import type { Blueprint } from "../../lib/types";
import { createBlueprint, deleteBlueprint, saveBlueprint, useStore } from "../../lib/store";
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
  const [creating, setCreating] = useState(startNew);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");

  const create = async () => {
    const src = s.blueprints.find(b => b.id === from);
    const id = await act(() => createBlueprint(name, src));
    if (id) window.location.href = `/team/blueprints?id=${id}`;
  };

  return (
    <div class="stack" style="gap:22px">
      <PageHead overline="Blueprints" title="Blueprints"
        sub="Reusable application forms. Pick one when creating a new application; its form is copied, so editing a blueprint never changes existing applications."
        actions={<button class="btn btn--primary" onClick={() => setCreating(true)}><IconPlus width={18} />New blueprint</button>} />

      <div class="app-grid">
        {s.blueprints.map(b => {
          const used = s.applications.filter(a => a.blueprintName === b.name).length;
          return (
            <div class="card stack-s" style="gap:12px">
              <div class="row row--between" style="align-items:flex-start">
                <a href={`/team/blueprints?id=${b.id}`} style="font-weight:800;font-size:1.05rem;color:var(--color-text-heading)">{b.name}</a>
                <span class="chip">{b.fields.length} fields</span>
              </div>
              <p class="muted small" style="min-height:40px">{b.description || "No description."}</p>
              <div class="row" style="flex-wrap:wrap;gap:6px">
                {b.fields.slice(2, 7).map(f => <span class="chip chip--outline">{f.label.length > 26 ? f.label.slice(0, 24) + "…" : f.label}</span>)}
                {b.fields.length > 7 && <span class="chip chip--outline">+{b.fields.length - 7}</span>}
              </div>
              <div class="app-card__foot" style="align-items:center">
                <span>Updated {fmtDate(b.updatedAt)}{used ? ` · used ${used}×` : ""}</span>
                <span class="row" style="gap:2px">
                  <button class="icon-btn" title="Duplicate" aria-label="Duplicate"
                    onClick={() => act(() => createBlueprint(`${b.name} (copy)`, b), "Blueprint duplicated")}><IconCopy /></button>
                  <button class="icon-btn" title="Delete" aria-label="Delete"
                    onClick={async () => {
                      if (await confirmDialog({ title: "Delete blueprint?", danger: true, confirmLabel: "Delete blueprint",
                        message: `Do you really want to delete the blueprint "${b.name}"?\n\nApplications created from it keep their form.` }))
                        act(() => deleteBlueprint(b.id), "Blueprint deleted");
                    }}><IconTrash /></button>
                  <a class="btn btn--secondary btn--sm" href={`/team/blueprints?id=${b.id}`}>Edit</a>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {creating && (
        <Modal title="New blueprint" onClose={() => setCreating(false)}>
          <Field label="Name" required>
            <input class="input" value={name} placeholder="e.g. AIM Connect – short form" onInput={e => setName(e.currentTarget.value)} autoFocus />
          </Field>
          <Field label="Start from">
            <select class="input" value={from} onChange={e => setFrom(e.currentTarget.value)}>
              <option value="">Empty form (name + email)</option>
              {s.blueprints.map(b => <option value={b.id}>Copy of “{b.name}”</option>)}
            </select>
          </Field>
          <div class="row" style="justify-content:flex-end">
            <button class="btn btn--ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button class="btn btn--primary" disabled={!name.trim()} onClick={create}>Create blueprint</button>
          </div>
        </Modal>
      )}
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

  return (
    <div class="stack" style="gap:22px">
      <PageHead crumbs={[{ label: "Blueprints", href: "/team/blueprints" }, { label: original.name }]}
        title={draft.name || "Untitled blueprint"}
        actions={<>
          <button class="btn btn--secondary" onClick={() => setPreview(true)}>Preview form</button>
          <a class="btn btn--secondary" href="/team/applications?new=1">Use for new application</a>
          <button class="btn btn--primary" disabled={!dirty} onClick={save}>{dirty ? "Save changes" : "Saved"}</button>
        </>} />

      <div class="card grid-2">
        <Field label="Blueprint name" required>
          <input class="input" value={draft.name} onInput={e => setDraft({ ...draft, name: e.currentTarget.value })} />
        </Field>
        <Field label="Description" help="Shown when choosing a blueprint, and used as default intro text.">
          <input class="input" value={draft.description} onInput={e => setDraft({ ...draft, description: e.currentTarget.value })} />
        </Field>
      </div>

      <FormBuilder fields={draft.fields} onChange={fields => setDraft({ ...draft, fields })} />

      {preview && (
        <Modal title="Form preview" onClose={() => setPreview(false)} wide>
          <FormRenderer fields={draft.fields} preview />
        </Modal>
      )}
    </div>
  );
}
