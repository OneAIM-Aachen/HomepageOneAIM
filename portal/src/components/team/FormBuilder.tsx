// Form builder used by blueprints and by the form tab of an application.
import { useState } from "preact/hooks";
import type { Field as FieldT, FieldKind } from "../../lib/types";
import { CUSTOM_KINDS, FEEDBACK_KINDS, KINDS, LOCKED_KINDS, PROFILE_KINDS, newField } from "../../lib/fields";
import { Field } from "../ui/Ui";
import { IconDown, IconTrash, IconUp } from "../ui/Icons";

const SHORT: Record<FieldKind, string> = {
  name: "Aa", email: "@", cv: "CV", phone: "☎", linkedin: "in", university: "Uni", studyProgram: "Sp", company: "Co",
  semester: "#", degree: "Dg", shortText: "T", longText: "¶", single: "◉", multi: "☑", dropdown: "▾",
  file: "⇪", url: "↗", number: "12", date: "📅", yesno: "Y/N",
};

export function FormBuilder({ fields, onChange, readOnly, note, feedback }: {
  fields: FieldT[]; onChange: (f: FieldT[]) => void; readOnly?: boolean; note?: string;
  /** Feedback form: questions only, no profile fields, no data storage consent */
  feedback?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const update = (id: string, patch: Partial<FieldT>) => onChange(fields.map(f => (f.id === id ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...fields];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange(next);
  };
  const add = (kind: FieldKind) => {
    const f = newField(kind);
    onChange([...fields, f]);
    setOpen(f.id);
  };
  const has = (k: FieldKind) => fields.some(f => f.kind === k);

  return (
    <div class="fb">
      <div class="fb__list">
        {note && <div class="card card--tint small">{note}</div>}
        {fields.map((f, i) => {
          const locked = LOCKED_KINDS.includes(f.kind);
          const profile = KINDS[f.kind].profile;
          const isOpen = open === f.id && !readOnly;
          return (
            <div class={`fb__item ${isOpen ? "is-open" : ""}`}>
              <div class="fb__item-head">
                <span class={`fb__icon ${locked ? "fb__icon--lock" : profile ? "fb__icon--profile" : ""}`} aria-hidden="true">{SHORT[f.kind]}</span>
                <button class="fb__toggle" type="button" onClick={() => setOpen(isOpen ? null : f.id)} aria-expanded={isOpen}>
                  <strong>{f.label}{f.required && <span style="color:var(--color-accent-pink)"> *</span>}</strong>
                  <span class="muted small">
                    {KINDS[f.kind].label}
                    {locked ? " · always included, mandatory" : profile ? " · fills the CRM profile" : ""}
                    {f.kind === "university" || f.kind === "studyProgram" ? " · list, several allowed" : f.kind === "semester" || f.kind === "degree" ? " · fixed options" : ""}
                    {f.options ? ` · ${f.options.length} options` : ""}
                    {f.maxWords ? ` · max ${f.maxWords} words` : ""}
                  </span>
                </button>
                {!readOnly && <>
                  <button class="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><IconUp /></button>
                  <button class="icon-btn" disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><IconDown /></button>
                  <button class="icon-btn" disabled={locked} onClick={() => onChange(fields.filter(x => x.id !== f.id))} aria-label="Remove field" title={locked ? "Part of every form (needed for the network statistics)" : "Remove"}><IconTrash /></button>
                </>}
              </div>
              {isOpen && (
                <div class="stack" style="gap:12px">
                  <div class="grid-2">
                    <Field label="Question / label" help={f.kind === "university" ? "Fixed for all forms." : undefined}>
                      <input class="input input--sm" value={f.label} disabled={f.kind === "university"} onInput={e => update(f.id, { label: e.currentTarget.value })} />
                    </Field>
                    <Field label="Help text (optional)" help={f.kind === "university" ? "Fixed: tells applicants to list every affiliation." : undefined}>
                      <input class="input input--sm" value={f.help ?? ""} disabled={f.kind === "university"} onInput={e => update(f.id, { help: e.currentTarget.value || undefined })} />
                    </Field>
                  </div>
                  {f.kind === "longText" && (
                    <Field label="Word limit">
                      <input class="input input--sm" type="number" min={0} style="max-width:140px" value={f.maxWords ?? ""}
                        onInput={e => update(f.id, { maxWords: Number(e.currentTarget.value) || undefined })} />
                    </Field>
                  )}
                  {f.options && (
                    <div class="stack-s">
                      <span class="field__label">Options</span>
                      {f.options.map((o, oi) => (
                        <div class="option-row">
                          <input class="input input--sm" value={o} aria-label={`Option ${oi + 1}`}
                            onInput={e => update(f.id, { options: f.options!.map((x, xi) => (xi === oi ? e.currentTarget.value : x)) })} />
                          <button class="icon-btn" disabled={f.options!.length <= 1} aria-label="Remove option"
                            onClick={() => update(f.id, { options: f.options!.filter((_, xi) => xi !== oi) })}><IconTrash /></button>
                        </div>
                      ))}
                      <button class="btn btn--ghost btn--sm" style="align-self:flex-start"
                        onClick={() => update(f.id, { options: [...f.options!, `Option ${f.options!.length + 1}`] })}>+ Add option</button>
                    </div>
                  )}
                  <label class="check">
                    <input type="checkbox" checked={f.required} disabled={locked} onChange={e => update(f.id, { required: e.currentTarget.checked })} />
                    <span><strong>Mandatory</strong> <span class="muted small">{locked ? "(core profile fields are always mandatory)" : feedback ? "participants must answer this" : "applicants must answer this"}</span></span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
        {feedback && fields.length === 0 && <div class="empty">No questions yet. Add some with the question types.</div>}
        {!feedback && <div class="fb__item" style="border-style:dashed;background:#FAFBFE">
          <div class="fb__item-head">
            <span class="fb__icon fb__icon--lock" aria-hidden="true">✓</span>
            <div style="flex:1">
              <strong>Data storage consent</strong>
              <div class="muted small">Always at the end of every form, mandatory: "I agree that OneAIM stores my data … and keeps it in OneAIM's internal talent network, which the OneAIM teams in all cities can access …"</div>
            </div>
          </div>
        </div>}
      </div>

      {!readOnly && (
        <aside class="palette">
          {!feedback && <div class="card stack-s">
            <h3>Optional profile fields</h3>
            <p class="muted small">Saved to the person's CRM profile. University, study program, semester and degree level are always included.</p>
            <div class="palette__grid">
              {PROFILE_KINDS.map(k => (
                <button class="palette__btn" disabled={has(k)} onClick={() => add(k)}>+ {KINDS[k].label}</button>
              ))}
            </div>
          </div>}
          <div class="card stack-s">
            <h3>Questions</h3>
            <div class="palette__grid">
              {(feedback ? FEEDBACK_KINDS : CUSTOM_KINDS).map(k => <button class="palette__btn" onClick={() => add(k)}>+ {KINDS[k].label}</button>)}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
