// Searchable multi-select for list fields (university affiliations, study
// programs). Selected values show as chips; "Other (please specify)" adds a
// free-text value the team can later merge into the list.
import { useMemo, useRef, useState } from "preact/hooks";
import { OTHER_LABEL } from "../../lib/fields";
import { IconX } from "../ui/Icons";

export interface PickerOption {
  name: string;
  group?: string;
  /** Shown muted next to the name, e.g. the country */
  hint?: string;
  /** Extra search terms: original local name, abbreviations */
  terms?: string[];
}

// Case- and accent-insensitive ("Universität" matches "universitat")
const norm = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const SMALL = new Set(["of", "the", "and", "for", "in", "at", "de", "du", "des", "la", "le", "di", "del", "der", "und", "y", "e"]);
const words = (t: string) => norm(t).split(/[\s\-–(),./&]+/).filter(Boolean);
/** "Massachusetts Institute of Technology" → "mit"; also for the part before a comma
 *  ("University College London, University of London" → "ucl"). */
const initials = (t: string) => words(t).filter(w => !SMALL.has(w)).map(w => w[0]).join("");
const acronym = (t: string) => initials(t);
const acronyms = (t: string) => [...new Set([initials(t), initials(t.split(",")[0]!), initials(t.replace(/\(.*?\)/g, ""))])];

interface Indexed { o: PickerOption; name: string; words: string[]; acr: string; acrs: string[]; terms: string[]; termWords: string[][]; termAcr: string[] }
function index(o: PickerOption): Indexed {
  const terms = (o.terms ?? []).map(norm);
  return { o, name: norm(o.name), words: words(o.name), acr: acronym(o.name), acrs: acronyms(o.name), terms,
    termWords: (o.terms ?? []).map(words), termAcr: (o.terms ?? []).map(acronym) };
}

/** Every typed word must match the start of a word (or the abbreviation). */
const tokensMatch = (tokens: string[], ws: string[], acr: string) =>
  tokens.every(t => ws.some(w => w.startsWith(t)) || (t.length >= 2 && acr.startsWith(t)));

/** Lower = better (exact abbreviations are negative = top). null = no match. */
function score(x: Indexed, q: string): number | null {
  const tokens = q.split(/\s+/).filter(Boolean);
  if (x.terms.includes(q)) return -1;                       // a stored abbreviation/local name, typed exactly
  if (q.length <= 6 && x.acrs.includes(q)) return -0.5;     // exact initials: "mit", "ucla"
  if (x.name.startsWith(q)) return 0;
  if (x.termAcr.includes(q)) return 0.5;
  if (tokensMatch(tokens, x.words, x.acr)) return 1;
  if (x.termWords.some((tw, i) => tokensMatch(tokens, tw, x.termAcr[i]!))) return 1.5;
  if (x.name.includes(q)) return 2;
  if (x.terms.some(t => t.includes(q))) return 3;
  return null;
}

export function ListPicker({ options, value, onChange, invalid, placeholder, label, minChars = 0, maxResults = 60 }: {
  options: PickerOption[];
  value: string[];
  onChange: (v: string[]) => void;
  invalid?: boolean;
  placeholder: string;
  label: string;
  /** Show suggestions only after this many typed characters (long lists) */
  minChars?: number;
  maxResults?: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const typed = q.trim().length >= minChars;
  const indexed = useMemo(() => options.map(index), [options]);
  const matches = useMemo(() => {
    const ql = norm(q.trim());
    if (!ql) return minChars ? [] : options.filter(o => !value.includes(o.name));
    return indexed
      .filter(x => !value.includes(x.o.name))
      .map(x => ({ o: x.o, sc: score(x, ql) }))
      .filter((x): x is { o: PickerOption; sc: number } => x.sc !== null)
      .sort((a, b) => a.sc - b.sc || a.o.name.length - b.o.name.length)
      .slice(0, minChars ? 12 : maxResults)
      .map(x => x.o);
  }, [q, indexed, value, minChars, maxResults]);

  const add = (v: string) => {
    const t = v.trim();
    if (t && !value.some(x => x.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setQ("");
    setActive(0);
  };
  const remove = (v: string) => onChange(value.filter(x => x !== v));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, matches.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (active < matches.length && matches[active]) add(matches[active]!.name);
      else { setOther(q); setOpen(false); }
    } else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Backspace" && !q && value.length) remove(value[value.length - 1]!);
  };

  let lastGroup: string | undefined;
  return (
    <div class="picker" ref={box}
      onFocusOut={e => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <div class={`picker__box input ${invalid ? "input--invalid" : ""}`} onClick={() => box.current?.querySelector("input")?.focus()}>
        {value.map(v => (
          <span class={`chip ${options.some(o => o.name === v) ? "chip--blue" : "chip--purple"}`}>
            {v}
            <button type="button" class="picker__remove" aria-label={`Remove ${v}`} onClick={e => { e.stopPropagation(); remove(v); }}><IconX /></button>
          </span>
        ))}
        <input class="picker__input" value={q} placeholder={value.length ? "Add more…" : placeholder}
          role="combobox" aria-expanded={open} aria-label={label} aria-autocomplete="list"
          onInput={e => { setQ(e.currentTarget.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey} />
      </div>

      {open && !typed && (
        <div class="picker__menu"><div class="picker__empty">Type at least {minChars} letters, e.g. “rwth”, “oxford” or “munich”.</div></div>
      )}
      {open && typed && (
        <div class="picker__menu" role="listbox">
          {matches.map((o, i) => {
            const head = !q.trim() && o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            return (
              <>
                {head && <div class="picker__group">{head}</div>}
                <button type="button" role="option" aria-selected={i === active} class={`picker__opt ${i === active ? "is-active" : ""}`}
                  onMouseDown={e => e.preventDefault()} onClick={() => add(o.name)}>
                  {o.name}{o.hint && <span class="picker__hint"> · {o.hint}</span>}
                </button>
              </>
            );
          })}
          {matches.length === 0 && q && <div class="picker__empty">No match in the list.</div>}
          <button type="button" class={`picker__opt picker__opt--other ${active === matches.length ? "is-active" : ""}`}
            onMouseDown={e => e.preventDefault()} onClick={() => { setOther(q); setOpen(false); }}>
            + {OTHER_LABEL}{q ? `: “${q}”` : ""}
          </button>
        </div>
      )}

      {other !== null && (
        <div class="row" style="margin-top:8px;flex-wrap:nowrap">
          <input class="input input--sm" value={other} placeholder="Please specify" aria-label={`${label}: other`} autoFocus
            onInput={e => setOther(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(other); setOther(null); } }} />
          <button type="button" class="btn btn--secondary btn--sm" disabled={!other.trim()} onClick={() => { add(other); setOther(null); }}>Add</button>
          <button type="button" class="btn btn--ghost btn--sm" onClick={() => setOther(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
