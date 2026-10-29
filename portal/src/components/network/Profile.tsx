// A network profile: name, photo, contact data, studies, the OneAIM
// programs/events someone took part in and their team history. Nothing
// else (no emails, CVs, answers, declined applications).
// Used by the team portal (Network page) and the members site (/members),
// where the data comes from the database function network_directory().
import type { ComponentChildren } from "preact";
import type { CompanyEntry, RoleEntry, TeamMember } from "../../lib/types";
import { companyPeriod } from "../apply/CompanyInput";
import { Avatar, Drawer } from "../ui/Ui";
import { fmtMonth, roleLabel } from "../team/MemberDrawer";

export interface Participation {
  title: string;
  program: string;
  city: string;
  semester: string;
  /** Event without selection (instant registration) */
  event: boolean;
}

export interface NetworkProfile {
  key: string;
  name: string;
  photo?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  universities: string[];
  studyPrograms: string[];
  companies: CompanyEntry[];
  semester?: string;
  degree?: string;
  /** Accepted / confirmed only, newest first */
  participations: Participation[];
  team?: { status: TeamMember["status"]; city: string; label: string; alumniSince?: string; history: RoleEntry[] };
  /** Team area only: links to the full CRM profile and the team profile */
  personId?: string;
  memberId?: string;
}


/** Network profile: contact, studies, OneAIM history. Nothing from applications beyond what they took part in. */
export function ProfileDrawer({ r, onClose, foot }: { r: NetworkProfile; onClose: () => void; foot?: ComponentChildren }) {
  const contact: [string, string | undefined, "mail" | "tel" | "link"][] = [
    ["Email", r.email, "mail"], ["Phone", r.phone, "tel"], ["LinkedIn", r.linkedin, "link"],
  ];
  const studies: [string, string | undefined][] = [
    ["University affiliations", r.universities.join(", ") || undefined], ["Study programs", r.studyPrograms.join(", ") || undefined],
    ["Semester", r.semester], ["Degree level", r.degree],
  ];
  const programs = r.participations.filter(x => !x.event);
  const events = r.participations.filter(x => x.event);
  const list = (items: Participation[]) => (
    <ul class="stack-s" style="list-style:none;padding:0;margin:0">
      {items.map(x => <li><strong style="color:var(--color-text-heading)">{x.title}</strong><span class="muted small"> · {x.city} · {x.semester}</span></li>)}
    </ul>
  );

  return (
    <Drawer onClose={onClose}
      head={<div class="row" style="flex-wrap:nowrap">
        <Avatar name={r.name} src={r.photo} large />
        <div style="min-width:0">
          <h2 style="font-size:1.25rem">{r.name}</h2>
          <span class="muted small">
            {r.team ? (r.team.status === "active" ? `${r.team.label} · OneAIM ${r.team.city}` : `Team alumni · OneAIM ${r.team.city}`) : "OneAIM network"}
          </span>
        </div>
      </div>}
      foot={foot}>

      <section class="stack-s">
        <h3>Contact</h3>
        <dl class="qa" style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px">
          {contact.map(([k, v, kind]) => (
            <div><dt>{k}</dt><dd>{!v ? "–"
              : kind === "mail" ? <a href={`mailto:${v}`}>{v}</a>
              : kind === "tel" ? <a href={`tel:${v.replace(/\s+/g, "")}`}>{v}</a>
              : <a href={v} target="_blank" rel="noopener">{v.replace(/^https?:\/\/(www\.)?/, "")}</a>}</dd></div>
          ))}
        </dl>
      </section>

      <section class="stack-s">
        <h3>Studies</h3>
        <dl class="qa" style="display:grid;grid-template-columns:1fr 1fr;gap:14px 20px">
          {studies.map(([k, v]) => <div><dt>{k}</dt><dd>{v ?? "–"}</dd></div>)}
        </dl>
      </section>

      <section class="stack-s">
        <h3>Companies</h3>
        {r.companies.length
          ? <ol class="history">
              {[...r.companies].sort((a, b) => (b.to ?? "9999").localeCompare(a.to ?? "9999") || b.from.localeCompare(a.from)).map(c => (
                <li class="history__item">
                  <span class="history__dot" />
                  <div style="flex:1;min-width:0">
                    <strong style="color:var(--color-text-heading)">{c.company}</strong><span class="muted"> · {c.position}</span>
                    <div class="muted small">{companyPeriod(c)}</div>
                  </div>
                </li>
              ))}
            </ol>
          : <p class="muted small">No company affiliations yet.</p>}
      </section>

      <section class="stack-s">
        <h3>OneAIM programs</h3>
        {programs.length ? list(programs) : <p class="muted small">No program participation yet.</p>}
      </section>

      {events.length > 0 && (
        <section class="stack-s">
          <h3>Events attended</h3>
          {list(events)}
        </section>
      )}

      {r.team && (
        <section class="stack-s">
          <h3>In the OneAIM team</h3>
          {r.team.status === "alumni" && <p class="muted small">Team alumni{r.team.alumniSince ? ` since ${fmtMonth(r.team.alumniSince)}` : ""}.</p>}
          <ol class="history">
            {[...r.team.history].reverse().map(e => (
              <li class="history__item">
                <span class="history__dot" />
                <div style="flex:1;min-width:0">
                  <strong style="color:var(--color-text-heading)">{roleLabel(e)}</strong>
                  <span class="muted"> · {e.city}{e.department && e.role !== "lead" ? ` · ${e.department}` : ""}</span>
                  <div class="muted small">{fmtMonth(e.from)} – {e.to ? fmtMonth(e.to) : "today"}</div>
                </div>
              </li>
            ))}
            {r.team.history.length === 0 && <li class="muted small">No positions recorded yet.</li>}
          </ol>
        </section>
      )}
    </Drawer>
  );
}
