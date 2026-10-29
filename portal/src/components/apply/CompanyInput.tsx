// Company affiliations: one entry per company, with the company from the
// list (or "Other"), the position and start / end month (no end = today).
// In application forms "I haven't worked at a company yet" is an answer too.
import type { CompanyEntry, FormOptions } from "../../lib/types";
import { NO_COMPANY } from "../../lib/fields";
import { ListPicker } from "./ListPicker";
import { IconPlus, IconTrash } from "../ui/Icons";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = (() => { const y = new Date().getFullYear(); return Array.from({ length: y - 1989 }, (_, i) => String(y - i)); })();

/** "Mar 2025 – today" */
export function companyPeriod(e: Pick<CompanyEntry, "from" | "to">): string {
  const f = (v: string) => `${MONTHS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}`;
  return `${f(e.from)} – ${e.to ? f(e.to) : "today"}`;
}

/** Problem with an entry, for validation messages (null = fine) */
export function companyProblem(v: CompanyEntry[] | string | undefined, required: boolean): string | null {
  if (v === NO_COMPANY) return null;
  const list = Array.isArray(v) ? v : [];
  if (!list.length) return required ? "Add a company, or tick “I haven't worked at a company yet”." : null;
  for (const e of list) {
    if (!e.company.trim() || !e.position.trim() || !/^\d{4}-\d{2}$/.test(e.from)) return "Please fill in company, position and start for every entry.";
    if (e.to && e.to < e.from) return "The end can't be before the start.";
  }
  return null;
}

function MonthYear({ value, onChange, label, allowEmpty }: { value?: string; onChange: (v: string | undefined) => void; label: string; allowEmpty?: string }) {
  const [y, m] = value ? [value.slice(0, 4), value.slice(5, 7)] : ["", ""];
  // Clearing either part clears the date ("Today" for the end); otherwise the
  // missing part starts at the current year / January
  const set = (yy: string, mm: string) => onChange(!yy || !mm ? (yy || mm ? `${yy || YEARS[0]}-${mm || "01"}` : undefined) : `${yy}-${mm}`);
  const clearOr = (part: "y" | "m", v: string) => (v ? set(part === "y" ? v : y, part === "m" ? v : m) : onChange(undefined));
  return (
    <div class="row" style="gap:6px;flex-wrap:nowrap" role="group" aria-label={label}>
      <select class="input input--sm" value={m} onChange={e => clearOr("m", e.currentTarget.value)} aria-label={`${label} month`}>
        <option value="">{allowEmpty ?? "Month"}</option>
        {MONTHS.map((n, i) => <option value={String(i + 1).padStart(2, "0")}>{n}</option>)}
      </select>
      <select class="input input--sm" value={y} onChange={e => clearOr("y", e.currentTarget.value)} aria-label={`${label} year`}>
        <option value="">{allowEmpty ? "" : "Year"}</option>
        {YEARS.map(n => <option>{n}</option>)}
      </select>
    </div>
  );
}

export function CompanyInput({ options, value, onChange, allowNone, invalid }: {
  options: FormOptions["companies"];
  value: CompanyEntry[] | string | undefined;
  onChange: (v: CompanyEntry[] | string) => void;
  /** Application forms: "I haven't worked at a company yet" */
  allowNone?: boolean;
  invalid?: boolean;
}) {
  const none = value === NO_COMPANY;
  const list: CompanyEntry[] = Array.isArray(value) ? value : [];
  const set = (i: number, patch: Partial<CompanyEntry>) => onChange(list.map((e, k) => (k === i ? { ...e, ...patch } : e)));
  const add = () => onChange([...list, { company: "", position: "", from: "" }]);
  const pickerOptions = options.map(c => ({ name: c.name, group: c.category, terms: c.aliases }));

  return (
    <div class={`stack-s company-input ${invalid ? "company-input--invalid" : ""}`}>
      {!none && list.map((e, i) => (
        <div class="company-entry">
          <div class="company-entry__grid">
            <div class="stack-s">
              <span class="field__help">Company</span>
              <ListPicker single label={`Company ${i + 1}`} placeholder="Start typing the company…" minChars={2} hint="“healthineers”, “bcg” or “roche”"
                options={pickerOptions} value={e.company ? [e.company] : []} onChange={v => set(i, { company: v[v.length - 1] ?? "" })} />
            </div>
            <label class="stack-s">
              <span class="field__help">Position</span>
              <input class="input" placeholder="e.g. Working student AI imaging" maxLength={120} value={e.position}
                onInput={ev => set(i, { position: ev.currentTarget.value })} />
            </label>
            <div class="stack-s">
              <span class="field__help">Start</span>
              <MonthYear label="Start" value={e.from || undefined} onChange={v => set(i, { from: v ?? "" })} />
            </div>
            <div class="stack-s">
              <span class="field__help">End</span>
              <MonthYear label="End" allowEmpty="Today" value={e.to} onChange={v => set(i, { to: v })} />
            </div>
          </div>
          <button type="button" class="icon-btn" title="Remove" aria-label={`Remove company ${i + 1}`} onClick={() => onChange(list.filter((_, k) => k !== i))}><IconTrash width={17} /></button>
        </div>
      ))}
      <div class="row">
        {!none && <button type="button" class="btn btn--secondary btn--sm" onClick={add}><IconPlus width={16} />{list.length ? "Add another company" : "Add company"}</button>}
        {allowNone && (
          <label class="row small" style="gap:6px">
            <input type="checkbox" checked={none} onChange={ev => onChange(ev.currentTarget.checked ? NO_COMPANY : [])} />
            I haven't worked at a company yet
          </label>
        )}
      </div>
    </div>
  );
}
