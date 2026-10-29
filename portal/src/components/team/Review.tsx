// Review workflow pieces: picking team members (interviewers, reviewers),
// editing scorecards (templates and an application's copies) and filling
// in a scorecard (1–5 per criterion).
import { useState } from "preact/hooks";
import type { Criterion, Scorecard, ScoreSheet, SubmissionStatus, TeamMember } from "../../lib/types";
import { sheetScore, useStore } from "../../lib/store";
import { uid } from "../../lib/fields";
import { Avatar, Field } from "../ui/Ui";
import { IconDown, IconPlus, IconTrash, IconUp, IconX } from "../ui/Icons";
import { ListPicker } from "../apply/ListPicker";

/** Stage of the process, from the applicant's status at that time */
export const STAGE_LABEL: Record<SubmissionStatus, string> = {
  new: "Screening", invited: "Interview", accepted: "Decision: accepted", rejected: "Decision: rejected", confirmed: "Registered",
};

export const fmtScore = (n?: number) => (n === undefined ? "–" : n.toFixed(1));

/** Active team members, own city first */
export function useActiveMembers(city?: string): TeamMember[] {
  return useStore(s => s.team.filter(m => m.status === "active"))
    .sort((a, b) => (a.city === city ? 0 : 1) - (b.city === city ? 0 : 1) || a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
}

export function MemberChips({ ids, onRemove, empty }: { ids: string[]; onRemove?: (id: string) => void; empty?: string }) {
  const team = useStore(s => s.team);
  if (!ids.length) return empty ? <span class="muted small">{empty}</span> : null;
  return (
    <span class="row" style="gap:6px">
      {ids.map(id => {
        const m = team.find(x => x.id === id);
        return (
          <span class="chip chip--outline member-chip">
            <Avatar name={m?.name ?? "?"} src={m?.photo} />{m?.name ?? "Former member"}
            {onRemove && <button type="button" class="picker__remove" aria-label={`Remove ${m?.name}`} onClick={() => onRemove(id)}><IconX /></button>}
          </span>
        );
      })}
    </span>
  );
}

/** Type a name, pick a team member (own city first in the suggestions) */
export function AddMember({ exclude, onAdd, label, city }: { exclude: string[]; onAdd: (id: string) => void; label: string; city?: string }) {
  const members = useActiveMembers(city).filter(m => !exclude.includes(m.id));
  // Names are the picker's keys; the city tells apart people with the same name
  const options = members.map(m => ({ name: `${m.name} · ${m.city}`, hint: m.email ? undefined : "no login yet", terms: [m.name] }));
  return (
    <div class="member-search">
      <ListPicker small allowOther={false} label={label} placeholder={label} options={options} value={[]}
        onChange={v => {
          const m = members.find(x => `${x.name} · ${x.city}` === v[v.length - 1]);
          if (m) onAdd(m.id);
        }} />
    </div>
  );
}

// ── Scorecard editor ─────────────────────────────────────────────────────

export function ScorecardEditor({ value, onChange, withName = true }: { value: Scorecard; onChange: (c: Scorecard) => void; withName?: boolean }) {
  const set = (i: number, patch: Partial<Criterion>) => onChange({ ...value, criteria: value.criteria.map((c, k) => (k === i ? { ...c, ...patch } : c)) });
  const move = (i: number, d: -1 | 1) => {
    const list = [...value.criteria];
    const [c] = list.splice(i, 1);
    list.splice(i + d, 0, c!);
    onChange({ ...value, criteria: list });
  };
  return (
    <div class="stack-s">
      {withName && (
        <div class="grid-2">
          <Field label="Name" required><input class="input" value={value.name} onInput={e => onChange({ ...value, name: e.currentTarget.value })} /></Field>
          <Field label="Description"><input class="input" value={value.description ?? ""} onInput={e => onChange({ ...value, description: e.currentTarget.value })} /></Field>
        </div>
      )}
      <span class="field__help">Each category is rated from 1 (weak) to 5 (excellent). The weight sets how much it counts in the total.</span>
      {value.criteria.map((c, i) => (
        <div class="criterion-row">
          <input class="input input--sm" placeholder="Category, e.g. Motivation" value={c.label} onInput={e => set(i, { label: e.currentTarget.value })} aria-label={`Category ${i + 1}`} />
          <input class="input input--sm" placeholder="What to look for (optional)" value={c.help ?? ""} onInput={e => set(i, { help: e.currentTarget.value })} aria-label={`Guidance ${i + 1}`} />
          <select class="input input--sm" value={String(c.weight)} onChange={e => set(i, { weight: Number(e.currentTarget.value) })} aria-label={`Weight ${i + 1}`}>
            {[1, 2, 3].map(w => <option value={String(w)}>×{w}</option>)}
          </select>
          <span class="row" style="gap:0;flex-wrap:nowrap">
            <button type="button" class="icon-btn" disabled={i === 0} aria-label="Move up" onClick={() => move(i, -1)}><IconUp width={16} /></button>
            <button type="button" class="icon-btn" disabled={i === value.criteria.length - 1} aria-label="Move down" onClick={() => move(i, 1)}><IconDown width={16} /></button>
            <button type="button" class="icon-btn" aria-label="Remove category" onClick={() => onChange({ ...value, criteria: value.criteria.filter((_, k) => k !== i) })}><IconTrash width={16} /></button>
          </span>
        </div>
      ))}
      <button type="button" class="btn btn--secondary btn--sm" style="align-self:flex-start"
        onClick={() => onChange({ ...value, criteria: [...value.criteria, { id: uid("c_"), label: "", weight: 1 }] })}>
        <IconPlus width={16} />Add category
      </button>
    </div>
  );
}

export const scorecardValid = (c: Scorecard) => c.name.trim().length > 0 && c.criteria.length > 0 && c.criteria.every(x => x.label.trim());

// ── Filling in a scorecard ───────────────────────────────────────────────

export function ScoreSheetForm({ card, sheet, onSave, onCancel }: {
  card: Scorecard; sheet?: ScoreSheet; onSave: (scores: Record<string, number>, note: string) => Promise<unknown>; onCancel?: () => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(sheet?.scores ?? {});
  const [note, setNote] = useState(sheet?.note ?? "");
  const [busy, setBusy] = useState(false);
  const total = sheetScore(card, { scores });
  const complete = card.criteria.every(c => scores[c.id]);
  return (
    <div class="stack-s scoresheet">
      {card.criteria.map(c => (
        <div class="scoresheet__row">
          <div style="min-width:0">
            <strong style="color:var(--color-text-heading)">{c.label}</strong>{c.weight > 1 && <span class="muted small"> ×{c.weight}</span>}
            {c.help && <div class="muted small">{c.help}</div>}
          </div>
          <div class="scale" role="radiogroup" aria-label={c.label}>
            {[1, 2, 3, 4, 5].map(n => (
              <button type="button" role="radio" aria-checked={scores[c.id] === n} class={scores[c.id] === n ? "is-on" : ""}
                onClick={() => setScores({ ...scores, [c.id]: n })}>{n}</button>
            ))}
          </div>
        </div>
      ))}
      <textarea class="input" style="min-height:60px" placeholder="Short justification (optional)" value={note} onInput={e => setNote(e.currentTarget.value)} />
      <div class="row">
        <span class="small"><strong>Total {fmtScore(total)}</strong> <span class="muted">/ 5{complete ? "" : " · not all categories rated"}</span></span>
        <span class="spacer" />
        {onCancel && <button type="button" class="btn btn--ghost btn--sm" onClick={onCancel}>Cancel</button>}
        <button type="button" class="btn btn--primary btn--sm" disabled={busy || !Object.keys(scores).length}
          onClick={async () => { setBusy(true); await onSave(scores, note); setBusy(false); }}>Save scorecard</button>
      </div>
    </div>
  );
}
