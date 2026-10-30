// Everything an applicant submitted, rendered field by field.
// Used in the applicant drawer and in the network profile.
import type { Answer, Application, CompanyEntry, Field, FileRef, Submission } from "../../lib/types";
import { companyPeriod } from "../apply/CompanyInput";
import { fmtDate, NO_COMPANY } from "../../lib/fields";
import { act } from "../ui/Ui";
import { openFile as openStored } from "../../lib/store";
import { IconDownload, IconFile } from "../ui/Icons";

export function isFile(v: Answer): v is FileRef {
  return !!v && typeof v === "object" && !Array.isArray(v) && "fileName" in v;
}

function answerText(v: Answer): string {
  if (v === undefined || v === null || v === "") return "–";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (v === NO_COMPANY) return "No company yet";
  if (Array.isArray(v)) {
    if (!v.length) return "–";
    // Company affiliations: [{company, position, from, to}]
    if (typeof v[0] === "object") return (v as CompanyEntry[]).map(e => `${e.company}: ${e.position} (${companyPeriod(e)})`).join("\n");
    return (v as string[]).join(", ");
  }
  return String(v);
}

// Opens via a short-lived signed URL from Supabase storage (private bucket).
export function openFile(f: FileRef) {
  act(() => openStored(f));
}

export function FileCard({ file, label, sub }: { file: FileRef; label?: string; sub?: string }) {
  return (
    <div class="file-card">
      <span class="file-card__icon"><IconFile width={22} /></span>
      <div style="flex:1;min-width:0">
        {label && <span class="overline" style="font-size:10.5px">{label}</span>}
        <strong>{file.fileName}</strong>
        <span class="muted small">{Math.round(file.size / 1024)} KB{sub ? ` · ${sub}` : ""}</span>
      </div>
      <button class="btn btn--secondary btn--sm" onClick={() => openFile(file)}>Open</button>
      <button class="icon-btn" aria-label={`Download ${file.fileName}`} onClick={() => openFile(file)}><IconDownload /></button>
    </div>
  );
}

export function Answers({ app, sub }: { app: Application; sub: Submission }) {
  return <FieldAnswers fields={app.fields} answers={sub.answers} at={sub.submittedAt} />;
}

/** Answers to a list of questions (application form, feedback form) */
export function FieldAnswers({ fields, answers, at }: { fields: Field[]; answers: Record<string, Answer>; at: string }) {
  return (
    <dl class="qa">
      {fields.map(f => {
        const v = answers[f.id];
        return (
          <div>
            <dt>{f.label}</dt>
            <dd>
              {isFile(v)
                ? <FileCard file={v} sub={`uploaded ${fmtDate(at)}`} />
                : (f.kind === "url" || f.kind === "linkedin") && v ? <a href={String(v)} target="_blank" rel="noopener">{String(v)}</a>
                : f.kind === "email" && v ? <a href={`mailto:${v}`}>{String(v)}</a>
                : answerText(v)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
