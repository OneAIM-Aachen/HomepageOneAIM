import { useStore } from "../../lib/store";
import { appPhase, appTitle, fmtShort, fmtSlot, PIPELINES } from "../../lib/fields";
import { TeamShell, PageHead } from "./TeamShell";
import { Avatar, PhaseChip, StatusChip } from "../ui/Ui";
import { IconPlus } from "../ui/Icons";

export default function OverviewPage() {
  const s = useStore(x => x);
  const live = s.applications.filter(a => appPhase(a) === "open");
  const toScreen = s.submissions.filter(x => x.status === "new");
  const invitedNoSlot = s.submissions.filter(x => x.status === "invited" && !x.slotId);
  const now = new Date().toISOString().slice(0, 16);
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
          <PageHead overline={`OneAIM ${acc.city}`} title={`Welcome back, ${acc.city} team`}
            sub="Everything that needs your attention across all cities."
            actions={<a class="btn btn--primary" href="/team/applications?new=1"><IconPlus width={18} />New application</a>} />

          <div class="stats">
            <div class="card stat"><span class="stat__num">{live.length}</span><span class="stat__label">Open applications</span><span class="muted small">accepting applicants right now</span></div>
            <div class="card stat"><span class="stat__num">{toScreen.length}</span><span class="stat__label">Waiting for screening</span><span class="muted small">new, not yet decided</span></div>
            <div class="card stat"><span class="stat__num">{upcomingInterviews.length}</span><span class="stat__label">Upcoming interviews</span><span class="muted small">{invitedNoSlot.length} invited without a slot yet</span></div>
            <div class="card stat"><span class="stat__num">{s.people.length}</span><span class="stat__label">People in network</span><span class="muted small">every applicant, one profile each</span></div>
          </div>

          <div class="grid-2" style="align-items:start">
            <section class="card">
              <div class="card__head"><h2>Needs attention</h2></div>
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
                        <span class="chip chip--purple">{fmtSlot(slot.start)}</span>
                      </a>
                    ))}
                  </div>}
            </section>
          </div>

          <section class="card card--flush">
            <div class="card__head" style="padding:20px 24px 0"><h2>Latest applicants</h2><a href="/team/network" class="small">Open network →</a></div>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Person</th><th>Application</th><th>Status</th><th>Submitted</th></tr></thead>
                <tbody>
                  {recent.map(x => {
                    const p = s.people.find(pp => pp.id === x.personId)!;
                    const app = s.applications.find(a => a.id === x.applicationId)!;
                    return (
                      <tr class="is-clickable" onClick={() => (location.href = `/team/application?id=${app.id}&s=${x.id}`)}>
                        <td><div class="cell-person"><Avatar name={p.name} /><div><strong>{p.name}</strong><span class="muted small">{p.university ?? p.email}</span></div></div></td>
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
