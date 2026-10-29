// Members site: everyone in the OneAIM network, as cards. Clicking opens the
// network profile (contact, studies, OneAIM programs and team history).
import { useEffect, useMemo, useState } from "preact/hooks";
import { fetchDirectory } from "../../lib/members";
import { fetchFormOptions, fetchPublicTagLists } from "../../lib/store";
import type { FormOptions } from "../../lib/types";
import { FilterSearch, matchesFilter } from "../apply/ListPicker";
import { isDemo } from "../../lib/demo";
import { demoProfiles } from "../../lib/demoNetwork";
import type { NetworkProfile } from "../network/Profile";
import { ProfileDrawer } from "../network/Profile";
import { MembersShell } from "./MembersShell";
import { Avatar } from "../ui/Ui";
import { IconSearch } from "../ui/Icons";

export default function MembersDirectory() {
  return <MembersShell active="directory">{() => <Directory />}</MembersShell>;
}

type Who = "" | "participants" | "team" | "alumni";

function Directory() {
  const [all, setAll] = useState<NetworkProfile[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [who, setWho] = useState<Who>("");
  const [city, setCity] = useState("");
  const [program, setProgram] = useState("");
  const [uni, setUni] = useState("");
  const [company, setCompany] = useState("");
  const [study, setStudy] = useState("");
  const [formOptions, setFormOptions] = useState<FormOptions | null>(null);
  useEffect(() => { fetchFormOptions().then(setFormOptions); }, []);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const real = await fetchDirectory();
      // Demo data (test site only): made-up members from all cities, only in this browser
      const demo = isDemo() ? demoProfiles(await fetchPublicTagLists(), real.some(r => r.team?.status === "active")) : [];
      setAll([...real, ...demo].sort((a, b) => a.name.localeCompare(b.name)));
    })().catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const opts = useMemo(() => {
    const list = all ?? [];
    return {
      cities: [...new Set(list.flatMap(r => [r.team?.city, ...r.participations.map(x => x.city)].filter(Boolean) as string[]))].sort(),
      programs: [...new Set(list.flatMap(r => r.participations.map(x => x.program)))].sort(),
      // Search options: names that occur in the network, with abbreviations from the lists
      unis: [...new Set(list.flatMap(r => r.universities))].sort()
        .map(name => ({ name, terms: formOptions?.universities.find(u => u.name === name)?.aliases })),
      studies: [...new Set(list.flatMap(r => r.studyPrograms))].sort()
        .map(name => ({ name, group: formOptions?.studyPrograms.find(p => p.name === name)?.category })),
      companies: [...new Set(list.flatMap(r => r.companies.map(c => c.company)))].sort()
        .map(name => ({ name, terms: formOptions?.companies.find(c => c.name === name)?.aliases })),
    };
  }, [all, formOptions]);

  if (error) return <div class="empty">{error}</div>;
  if (!all) return <div class="loading" role="status" aria-label="Loading"><span /></div>;

  const isParticipant = (r: NetworkProfile) => r.participations.some(x => !x.event);
  const filtered = all.filter(r => {
    const ql = q.trim().toLowerCase();
    if (ql && !r.name.toLowerCase().includes(ql)) return false;
    if (!matchesFilter(r.companies.map(c => c.company), company, opts.companies)) return false;
    if (!matchesFilter(r.studyPrograms, study, opts.studies)) return false;
    if (who === "participants" && !isParticipant(r)) return false;
    if (who === "team" && r.team?.status !== "active") return false;
    if (who === "alumni" && r.team?.status !== "alumni") return false;
    if (city && r.team?.city !== city && !r.participations.some(x => x.city === city)) return false;
    if (program && !r.participations.some(x => x.program === program)) return false;
    if (!matchesFilter(r.universities, uni, opts.unis)) return false;
    return true;
  });
  const sel = (label: string, value: string, set: (v: string) => void, o: string[]) => (
    <select class="input input--sm" style="width:auto" value={value} onChange={e => set(e.currentTarget.value)} aria-label={label}>
      <option value="">{label}</option>{o.map(x => <option>{x}</option>)}
    </select>
  );
  const whoBtn = (v: Who, text: string, n: number) => (
    <button class={`chip-btn ${who === v ? "is-active" : ""}`} onClick={() => setWho(v)}>{text} <span class="chip-btn__count">{n}</span></button>
  );
  const openRow = all.find(r => r.key === open);

  return (
    <div class="stack" style="gap:20px">
      <header class="stack-s">
        <p class="overline">OneAIM network</p>
        <h1>Members</h1>
        <p class="muted">{all.length} participants, team members and alumni. Find people, see what they study and get in touch.</p>
      </header>

      <div class="row">
        <div style="position:relative;flex:1;min-width:220px">
          <IconSearch width={17} style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-text-muted)" />
          <input class="input input--sm" style="padding-left:36px" placeholder="Search name…" value={q} onInput={e => setQ(e.currentTarget.value)} aria-label="Search members by name" />
        </div>
        {sel("All cities", city, setCity, opts.cities)}
        {sel("All programs", program, setProgram, opts.programs)}
      </div>
      <div class="row">
        <FilterSearch label="Study program" value={study} onChange={setStudy} options={opts.studies} />
        <FilterSearch label="University" value={uni} onChange={setUni} options={opts.unis} />
        <FilterSearch label="Company" value={company} onChange={setCompany} options={opts.companies} />
      </div>
      <div class="row" style="gap:6px" role="group" aria-label="Who">
        {whoBtn("", "Everyone", all.length)}
        {whoBtn("participants", "Participants", all.filter(isParticipant).length)}
        {whoBtn("team", "Team", all.filter(r => r.team?.status === "active").length)}
        {whoBtn("alumni", "Alumni", all.filter(r => r.team?.status === "alumni").length)}
      </div>

      <div class="member-grid">
        {filtered.map(r => (
          <button class="member-card" onClick={() => setOpen(r.key)}>
            <Avatar name={r.name} src={r.photo} large />
            <strong>{r.name}</strong>
            <span class="muted small">
              {r.team ? (r.team.status === "active" ? `${r.team.label} · ${r.team.city}` : `Team alumni · ${r.team.city}`)
                : r.participations.filter(x => !x.event).map(x => `${x.program} ${x.semester}`).slice(0, 2).join(", ")}
            </span>
            <span class="small member-card__study">{[r.studyPrograms[0], r.universities[0]].filter(Boolean).join(" · ") || " "}</span>
          </button>
        ))}
      </div>
      {filtered.length === 0 && <div class="empty">Nobody matches these filters.</div>}

      {openRow && <ProfileDrawer r={openRow} onClose={() => setOpen(null)} />}
    </div>
  );
}
