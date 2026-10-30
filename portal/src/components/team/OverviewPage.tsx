import type { Account, Application, State } from "../../lib/types";
import { useStore } from "../../lib/store";
import { appPhase, appTitle, fmtDate, fmtShort, fmtSlot, nowLocal, PIPELINES, today } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { Avatar, PhaseChip, StatusChip } from "../ui/Ui";
import { IconPlus } from "../ui/Icons";

export default function OverviewPage() {
  const s = useStore(x => x);
  const live = s.applications.filter(a => appPhase(a) === "open");
  const toScreen = s.submissions.filter(x => x.status === "new");
  const invitedNoSlot = s.submissions.filter(x => x.status === "invited" && !x.slotId);
  const now = nowLocal();
  const upcomingInterviews = s.submissions
    .filter(x => x.status === "invited" && x.slotId)
    .map(x => {
      const app = s.applications.find(a => a.id === x.applicationId)!;
      const slot = app.slots.find(sl => sl.id === x.slotId)!;
      return { sub: x, app, slot, person: s.people.find(p => p.id === x.personId)! };
    })
    .filter(x => x.slot && x.slot.start >= now)
    .sort((a, b) => a.slot.start.localeCompare(b.slot.start));
  const recent = [...s.submissions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6);

  const attention = s.applications
    .map(a => ({
      app: a,
      fresh: s.submissions.filter(x => x.applicationId === a.id && x.status === "new").length,
      waiting: s.submissions.filter(x => x.applicationId === a.id && x.status === "invited" && !x.slotId).length,
    }))
    .filter(x => x.fresh || x.waiting);

  return (
    <TeamShell active="overview">
      {acc => (
        <div class="stack" style="gap:24px">
          <PageHead overline={`OneAIM ${acc.city}`} title={acc.legacy ? `Welcome back, ${acc.city} team` : `Welcome back, ${acc.name.split(" ")[0]}`}
            sub="Everything that needs your attention across all cities."
            actions={<a class="btn btn--primary" href="/team/applications?new=1"><IconPlus width={18} />New application</a>} />

          <div class="stats">
            <div class="card stat"><span class="stat__num">{live.length}</span><span class="stat__label">Open applications</span><span class="muted small">accepting applicants right now</span></div>
            <div class="card stat"><span class="stat__num">{toScreen.length}</span><span class="stat__label">Waiting for screening</span><span class="muted small">new, not yet decided</span></div>
            <div class="card stat"><span class="stat__num">{upcomingInterviews.length}</span><span class="stat__label">Upcoming interviews</span><span class="muted small">{invitedNoSlot.length} invited without a slot yet</span></div>
            <div class="card stat"><span class="stat__num">{s.people.length}</span><span class="stat__label">People in network</span><span class="muted small">every applicant, one profile each</span></div>
          </div>

          <div class="grid-2" style="align-items:start">
            {acc.memberId ? <MyTasks s={s} acc={acc} /> : (
            <section class="card">
              <div class="card__head"><h2>Needs attention</h2></div>
              <p class="muted small" style="margin-bottom:10px">Shared city login: showing all open work. With your personal account you see your own to-dos here.</p>
              {attention.length === 0
                ? <p class="muted">Nothing to do right now.</p>
                : <div class="stack-s">
                    {attention.map(({ app, fresh, waiting }) => (
                      <a class="row" href={`/team/application?id=${app.id}`} style="padding:10px 12px;border-radius:12px;background:#F8FAFF;text-decoration:none;color:inherit">
                        <div style="flex:1;min-width:0">
                          <strong style="color:var(--color-text-heading)">{appTitle(app)}</strong>
                          <div class="muted small">{PIPELINES[app.pipeline].label}</div>
                        </div>
                        {fresh > 0 && <span class="chip chip--blue">{fresh} to screen</span>}
                        {waiting > 0 && <span class="chip chip--purple">{waiting} no slot</span>}
                      </a>
                    ))}
                  </div>}
            </section>
            )}

            <section class="card">
              <div class="card__head"><h2>Upcoming interviews</h2></div>
              {upcomingInterviews.length === 0
                ? <p class="muted">No interviews booked.</p>
                : <div class="stack-s">
                    {upcomingInterviews.slice(0, 6).map(({ sub, app, slot, person }) => (
                      <a class="row" href={`/team/application?id=${app.id}&s=${sub.id}`} style="text-decoration:none;color:inherit">
                        <Avatar name={person.name} />
                        <div style="flex:1;min-width:0">
                          <strong style="color:var(--color-text-heading)">{person.name}</strong>
                          <div class="muted small">{appTitle(app)} · {slot.location}</div>
                        </div>
                        {acc.memberId && slot.interviewerIds.includes(acc.memberId) && <span class="chip chip--blue">You</span>}
                        <span class="chip chip--purple">{fmtSlot(slot.start)}</span>
                      </a>
                    ))}
                  </div>}
            </section>
          </div>

          <section class="card card--flush">
            <div class="card__head" style="padding:20px 24px 0"><h2>Latest applicants</h2><a href="/team/crm" class="small">Open CRM →</a></div>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Person</th><th>Application</th><th>Status</th><th>Submitted</th></tr></thead>
                <tbody>
                  {recent.map(x => {
                    const p = s.people.find(pp => pp.id === x.personId)!;
                    const app = s.applications.find(a => a.id === x.applicationId)!;
                    return (
                      <tr class="is-clickable" onClick={() => (location.href = `/team/application?id=${app.id}&s=${x.id}`)}>
                        <td><div class="cell-person"><Avatar name={p.name} /><div><strong>{p.name}</strong><span class="muted small">{p.universities[0] ?? p.email}</span></div></div></td>
                        <td>{appTitle(app)} <PhaseChip phase={appPhase(app)} /></td>
                        <td><StatusChip status={x.status} /></td>
                        <td class="muted">{fmtShort(x.submittedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </TeamShell>
  );
}

// ── My to-dos ────────────────────────────────────────────────────────────

interface Task { key: string; title: string; sub: string; href: string; due?: string; time?: boolean }

/** Screening has to be done before the interviews start (interview pipeline) or by the decision date */
function screeningDue(app: Application): string | undefined {
  return (app.pipeline === "interview" ? app.dates.interviewsFrom ?? app.dates.decisionBy : app.dates.decisionBy) ?? app.dates.deadline;
}

function myTasks(s: State, memberId: string): Task[] {
  const now = nowLocal();
  const tasks: Task[] = [];
  for (const app of s.applications) {
    const subs = s.submissions.filter(x => x.applicationId === app.id);
    // Reviews: assigned to me, still in screening, my scorecard missing (if there is one)
    const toReview = subs.filter(x => x.status === "new" && x.reviewerIds.includes(memberId)
      && !(app.scorecards.screening && x.scoreSheets.some(y => y.memberId === memberId && y.stage === "screening")));
    if (toReview.length) {
      tasks.push({
        key: `r-${app.id}`, title: `Review ${toReview.length} applicant${toReview.length > 1 ? "s" : ""}`,
        sub: `${appTitle(app)}${app.scorecards.screening ? " · fill in the screening scorecard" : ""}`,
        href: `/team/application?id=${app.id}${toReview.length === 1 ? `&s=${toReview[0]!.id}` : ""}`, due: screeningDue(app),
      });
    }
    for (const slot of app.slots.filter(sl => sl.interviewerIds.includes(memberId))) {
      const booked = subs.filter(x => x.slotId === slot.id);
      if (slot.start >= now) {
        // Interviews I lead
        tasks.push({
          key: `i-${slot.id}`, time: true, due: slot.start,
          title: booked.length ? `Interview ${booked.map(b => s.people.find(p => p.id === b.personId)?.name).join(", ")}` : "Interview slot (not booked yet)",
          sub: `${appTitle(app)} · ${slot.mode === "online" ? "Online" : slot.location}`,
          href: `/team/application?id=${app.id}${booked.length === 1 ? `&s=${booked[0]!.id}` : "&tab=slots"}`,
        });
      } else if (app.scorecards.interview) {
        // After the interview: my interview scorecard
        for (const b of booked.filter(x => x.status === "invited" && !x.scoreSheets.some(y => y.memberId === memberId && y.stage === "interview"))) {
          tasks.push({
            key: `is-${b.id}`, title: `Interview scorecard: ${s.people.find(p => p.id === b.personId)?.name}`,
            sub: `${appTitle(app)} · interviewed ${fmtSlot(slot.start)}`, href: `/team/application?id=${app.id}&s=${b.id}`,
            due: app.dates.decisionBy,
          });
        }
      }
    }
  }
  return tasks.sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
}

function DueChip({ due, time }: { due?: string; time?: boolean }) {
  if (!due) return <span class="chip chip--gray">No deadline</span>;
  if (time) return <span class="chip chip--purple">{fmtSlot(due)}</span>;
  const t = today();
  const days = Math.round((Date.parse(due) - Date.parse(t)) / 864e5);
  if (days < 0) return <span class="chip chip--red">Overdue since {fmtDate(due)}</span>;
  if (days === 0) return <span class="chip chip--amber">Due today</span>;
  return <span class={`chip ${days <= 3 ? "chip--amber" : "chip--blue"}`}>Due {fmtDate(due)}</span>;
}

function MyTasks({ s, acc }: { s: State; acc: Account }) {
  const tasks = myTasks(s, acc.memberId!);
  return (
    <section class="card">
      <div class="card__head"><h2>Needs attention</h2><span class="muted small">your to-dos</span></div>
      {tasks.length === 0
        ? <p class="muted">Nothing on your list. Reviews and interviews assigned to you show up here.</p>
        : <div class="stack-s">
            {tasks.map(t => (
              <a class="row" href={t.href} style="padding:10px 12px;border-radius:12px;background:#F8FAFF;text-decoration:none;color:inherit;flex-wrap:nowrap">
                <div style="flex:1;min-width:0">
                  <strong style="color:var(--color-text-heading)">{t.title}</strong>
                  <div class="muted small">{t.sub}</div>
                </div>
                <DueChip due={t.due} time={t.time} />
              </a>
            ))}
          </div>}
    </section>
  );
}
