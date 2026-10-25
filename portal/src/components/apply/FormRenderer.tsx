// Renders an application form from its field list. Used on apply.one-aim.org
// and as a preview in the team area.
import { useState } from "preact/hooks";
import type { Answer, Field as FieldT, FileRef } from "../../lib/types";
import { Field } from "../ui/Ui";
import { IconFile } from "../ui/Icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function words(s: string) { return s.trim() ? s.trim().split(/\s+/).length : 0; }

export function FormRenderer({ fields, preview, onSubmit, submitLabel = "Submit application" }: {
  fields: FieldT[];
  preview?: boolean;
  /** Returns an error text to show, or nothing on success. Gets the chosen files for upload. */
  onSubmit?: (answers: Record<string, Answer>, files: Record<string, File>) => Promise<string | null | void> | string | null | void;
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (id: string, v: Answer) => {
    setAnswers(a => ({ ...a, [id]: v }));
    setErrors(e => { const n = { ...e }; delete n[id]; return n; });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const v = answers[f.id];
      const empty = v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
      if (f.required && empty && f.kind !== "yesno") e[f.id] = "This field is required.";
      if (f.required && f.kind === "yesno" && v === undefined) e[f.id] = "Please answer yes or no.";
      if (!empty && f.kind === "email" && !EMAIL_RE.test(String(v))) e[f.id] = "Please enter a valid email address.";
      if (!empty && (f.kind === "url" || f.kind === "linkedin") && !/^https?:\/\/\S+\.\S+/.test(String(v))) e[f.id] = "Please enter a full link starting with https://";
      if (!empty && f.kind === "longText" && f.maxWords && words(String(v)) > f.maxWords) e[f.id] = `Please stay within ${f.maxWords} words.`;
    }
    if (!consent) e.__consent = "Please agree to the data storage to submit.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: Event) => {
    ev.preventDefault();
    if (preview) return;
    setFormError("");
    if (!validate()) {
      setFormError("Please check the highlighted fields.");
      return;
    }
    setBusy(true);
    const err = await onSubmit?.(answers, files);
    if (err) { setFormError(err); setBusy(false); }
  };

  const input = (f: FieldT) => {
    const v = answers[f.id];
    const invalid = errors[f.id] ? "input--invalid" : "";
    switch (f.kind) {
      case "longText":
        return (
          <>
            <textarea class={`input ${invalid}`} value={(v as string) ?? ""} onInput={e => set(f.id, e.currentTarget.value)} />
            {f.maxWords && <span class="field__help" style="text-align:right">{words(String(v ?? ""))} / {f.maxWords} words</span>}
          </>
        );
      case "single":
      case "degree":
        return (
          <div class="stack-s" role="radiogroup">
            {f.options?.map(o => (
              <label class="check"><input type="radio" name={f.id} checked={v === o} onChange={() => set(f.id, o)} /><span>{o}</span></label>
            ))}
          </div>
        );
      case "multi":
        return (
          <div class="stack-s">
            {f.options?.map(o => {
              const arr = (v as string[]) ?? [];
              return (
                <label class="check">
                  <input type="checkbox" checked={arr.includes(o)}
                    onChange={e => set(f.id, e.currentTarget.checked ? [...arr, o] : arr.filter(x => x !== o))} />
                  <span>{o}</span>
                </label>
              );
            })}
          </div>
        );
      case "dropdown":
        return (
          <select class={`input ${invalid}`} value={(v as string) ?? ""} onChange={e => set(f.id, e.currentTarget.value)}>
            <option value="">Please choose…</option>
            {f.options?.map(o => <option>{o}</option>)}
          </select>
        );
      case "yesno":
        return (
          <div class="row">
            {[true, false].map(b => (
              <button type="button" class={`chip-btn ${v === b ? "is-active" : ""}`} onClick={() => set(f.id, b)}>{b ? "Yes" : "No"}</button>
            ))}
          </div>
        );
      case "cv":
      case "file": {
        const file = v as FileRef | undefined;
        return (
          <label class="upload" style={errors[f.id] ? "border-color:var(--p-red)" : ""}>
            <input type="file" accept={f.kind === "cv" ? ".pdf,application/pdf" : ".pdf,.png,.jpg,.jpeg,.docx,.pptx"}
              onChange={e => {
                const x = e.currentTarget.files?.[0];
                if (!x) return;
                if (x.size > 10 * 1024 * 1024) { setErrors(er => ({ ...er, [f.id]: "This file is larger than 10 MB." })); return; }
                setFiles(fs => ({ ...fs, [f.id]: x }));
                set(f.id, { fileName: x.name, size: x.size });
              }} />
            {file
              ? <span class="file-pill"><IconFile width={18} />{file.fileName} · {Math.round(file.size / 1024)} KB</span>
              : <span><strong style="color:var(--color-brand-blue)">Choose a file</strong> <span class="muted">{f.kind === "cv" ? "PDF, max. 10 MB" : "max. 10 MB"}</span></span>}
          </label>
        );
      }
      default: {
        const type = f.kind === "email" ? "email" : f.kind === "phone" ? "tel" : f.kind === "number" || f.kind === "semester" ? "number"
          : f.kind === "date" ? "date" : f.kind === "url" || f.kind === "linkedin" ? "url" : "text";
        const ph = f.kind === "linkedin" ? "https://linkedin.com/in/…" : f.kind === "url" ? "https://…" : "";
        return <input class={`input ${invalid}`} type={type as "text"} placeholder={ph} min={type === "number" ? 0 : undefined}
          value={(v as string) ?? ""} onInput={e => set(f.id, e.currentTarget.value)} />;
      }
    }
  };

  // Fieldsets (radio/checkbox groups) must not be wrapped in <label>.
  const grouped = (f: FieldT) => ["single", "multi", "yesno", "degree", "cv", "file"].includes(f.kind);

  return (
    <form class="stack" style="gap:22px" onSubmit={submit} noValidate>
      {fields.map(f =>
        grouped(f) ? (
          <div class="field">
            <span class="field__label">{f.label}{f.required && <span class="req">*</span>}</span>
            {f.help && <span class="field__help">{f.help}</span>}
            {input(f)}
            {errors[f.id] && <span class="field__error">{errors[f.id]}</span>}
          </div>
        ) : (
          <Field label={f.label} required={f.required} help={f.help} error={errors[f.id]}>{input(f)}</Field>
        ),
      )}
      <div class="consent">
        <label class="check">
          <input type="checkbox" checked={consent} onChange={e => { setConsent(e.currentTarget.checked); setErrors(x => { const n = { ...x }; delete n.__consent; return n; }); }} />
          <span>
            <strong>I agree that OneAIM stores my data</strong> from this application to process my application and keeps it
            in OneAIM's <strong>internal talent network</strong>, which the OneAIM teams in all cities can access, to contact me
            about future programs, events and opportunities. I can ask for my data to be deleted at any time by email to
            contact@one-aim.org. See our <a href="https://one-aim.org/datenschutz" target="_blank" rel="noopener">privacy policy</a>.<span class="req" style="color:var(--color-accent-pink)">*</span>
          </span>
        </label>
        {errors.__consent && <p class="field__error" style="margin-top:8px">{errors.__consent}</p>}
      </div>
      {formError && <p class="field__error" role="alert">{formError}</p>}
      {preview
        ? <p class="muted small">Preview: submitting is disabled.</p>
        : <button class="btn btn--gradient btn--lg" type="submit" disabled={busy} style="align-self:flex-start">{busy ? "Submitting…" : `${submitLabel} →`}</button>}
    </form>
  );
}
