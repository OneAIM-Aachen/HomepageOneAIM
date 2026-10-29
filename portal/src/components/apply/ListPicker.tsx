// Type-ahead field for list values (university affiliations, study programs,
// companies): start typing, pick a suggestion. Several values show as chips
// below the field; with `single` the chosen name stays in the field and can
// be typed over. A name that isn't in the list can be used as it is
// ("Other"); the team can later merge it into the list.
import { useMemo, useRef, useState } from "preact/hooks";
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

export function ListPicker({ options, value, onChange, invalid, placeholder, label, minChars = 1, maxResults = 12, single, small, allowOther = true }: {
  options: PickerOption[];
  value: string[];
  onChange: (v: string[]) => void;
  invalid?: boolean;
  placeholder: string;
  label: string;
  /** Suggestions appear after this many typed letters; 0 = also show the whole (short) list on focus */
  minChars?: number;
  maxResults?: number;
  /** Exactly one value, shown in the field itself */
  single?: boolean;
  /** Compact field (filter bars) */
  small?: boolean;
  /** Offer "Use “typed text”" for names not in the list */
  allowOther?: boolean;
}) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const indexed = useMemo(() => options.map(index), [options]);
  const query = q.trim();
  const matches = useMemo(() => {
    const ql = norm(query);
    const taken = (n: string) => !single && value.includes(n);
    if (!ql) return minChars === 0 ? options.filter(o => !taken(o.name)) : [];
    return indexed
      .filter(x => !taken(x.o.name))
      .map(x => ({ o: x.o, sc: score(x, ql) }))
      .filter((x): x is { o: PickerOption; sc: number } => x.sc !== null)
      .sort((a, b) => a.sc - b.sc || a.o.name.length - b.o.name.length)
      .slice(0, maxResults)
      .map(x => x.o);
  }, [query, indexed, value, minChars, maxResults, single]);

  // Typed text that isn't exactly a list entry can be used as it is
  const exact = (t: string) => {
    const n = norm(t.trim());
    return options.find(o => norm(o.name) === n || (o.terms ?? []).some(x => norm(x) === n))?.name;
  };
  const canUseTyped = allowOther && query.length > 0 && !matches.some(o => norm(o.name) === norm(query));
  const showMenu = open && (query.length >= Math.max(minChars, 1) || minChars === 0);

  const choose = (v: string) => {
    const t = v.trim();
    if (!t) return;
    if (single) onChange([t]);
    else if (!value.some(x => x.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setQ("");
    setEditing(false);
    setOpen(false);
    setActive(0);
  };
  const remove = (v: string) => onChange(value.filter(x => x !== v));

  // Leaving the field: in single mode the typed text is the value (list name if it matches)
  const commit = () => {
    if (single && editing) {
      if (!query) onChange([]);
      else if (query !== value[0]) onChange([exact(query) ?? query]);
    }
    setEditing(false);
    setOpen(false);
    setQ("");
  };

  const onKey = (e: KeyboardEvent) => {
    const n = matches.length + (canUseTyped ? 1 : 0);
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, n - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (active < matches.length && matches[active]) choose(matches[active]!.name);
      else if (query && (allowOther || exact(query))) choose(exact(query) ?? query);
    } else if (e.key === "Escape") { setOpen(false); }
  };

  const inList = (v: string) => options.some(o => o.name === v);
  const shown = single && !editing ? (value[0] ?? "") : q;
  let lastGroup: string | undefined;
  return (
    <div class="picker" ref={box}
      onFocusOut={e => { if (!box.current?.contains(e.relatedTarget as Node)) commit(); }}>
      <input class={`input ${small ? "input--sm" : ""} ${invalid ? "input--invalid" : ""}`} value={shown} placeholder={placeholder}
        role="combobox" aria-expanded={showMenu} aria-label={label} aria-autocomplete="list" autoComplete="off"
        onFocus={e => {
          setEditing(true);
          if (single) { setQ(value[0] ?? ""); e.currentTarget.select(); }
          if (minChars === 0) setOpen(true);
        }}
        onInput={e => { setEditing(true); setQ(e.currentTarget.value); setOpen(true); setActive(0); }}
        onKeyDown={onKey} />

      {showMenu && (matches.length > 0 || canUseTyped) && (
        <div class="picker__menu" role="listbox">
          {matches.map((o, i) => {
            const head = !query && o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            return (
              <>
                {head && <div class="picker__group">{head}</div>}
                <button type="button" role="option" aria-selected={i === active} class={`picker__opt ${i === active ? "is-active" : ""}`}
                  onMouseDown={e => e.preventDefault()} onClick={() => choose(o.name)}>
                  {o.name}{o.hint && <span class="picker__hint"> · {o.hint}</span>}
                </button>
              </>
            );
          })}
          {canUseTyped && (
            <button type="button" class={`picker__opt picker__opt--other ${active === matches.length ? "is-active" : ""}`}
              onMouseDown={e => e.preventDefault()} onClick={() => choose(query)}>
              {matches.length ? "Not in the list? " : "Not in the list: "}Use “{query}”
            </button>
          )}
        </div>
      )}

      {single && !small && !editing && value[0] && !inList(value[0]) && (
        <span class="field__help">Not in our list yet; we'll add it.</span>
      )}
      {!single && value.length > 0 && (
        <div class="picker__chips">
          {value.map(v => (
            <span class={`chip ${inList(v) ? "chip--blue" : "chip--purple"}`}>
              {v}
              <button type="button" class="picker__remove" aria-label={`Remove ${v}`} onClick={() => remove(v)}><IconX /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Filter field: type to search a list (e.g. universities), pick a suggestion.
 * A picked list entry matches exactly; typed text that isn't picked filters by
 * "contains" (so "Siemens" also finds "Siemens Healthineers"). Empty = no filter.
 */
export function FilterSearch({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: PickerOption[];
}) {
  return (
    <div class="filter-search">
      <ListPicker single small label={label} placeholder={label} options={options}
        value={value ? [value] : []} onChange={v => onChange(v[0] ?? "")} />
      {value && <button type="button" class="filter-search__clear" aria-label={`Clear ${label}`} onClick={() => onChange("")}><IconX /></button>}
    </div>
  );
}

/** Match for FilterSearch values: exact for list entries (`known`), otherwise "contains" */
export function matchesFilter(values: string[], filter: string, known: { name: string }[]): boolean {
  if (!filter) return true;
  if (known.some(k => k.name === filter)) return values.includes(filter);
  const f = norm(filter.trim());
  return values.some(v => norm(v).includes(f));
}
