// apply.one-aim.org: open applications, the form, interview booking.
// Uses only the public database functions (no table access).
import type { ComponentChildren } from "preact";
import type { FormOptions } from "../../lib/types";
import { useEffect, useState } from "preact/hooks";
import {
  bookSlot, fetchFormOptions, fetchPublicTagLists, fetchPublishedApplications, getBooking, getFeedback, submitApplication, submitFeedback,
  type Booking, type PublicApplication, type PublicFeedback,
} from "../../lib/store";
import { appTitle, fmtDate, fmtSlot, firstName, formatFee } from "../../lib/fields";
import { FormRenderer } from "./FormRenderer";
import { useParam } from "../ui/Ui";
import { IconCalendar } from "../ui/Icons";

function Frame({ children }: { children: ComponentChildren }) {
  return (
    <>
      <header class="apply-top">
        <div class="apply-top__inner">
          <a href="/apply"><img src="/logo.png" alt="OneAIM" /></a>
          <span>Apply</span>
          <span class="spacer" style="background:none" />
          <a class="small" href="https://one-aim.org" style="font-weight:700">one-aim.org →</a>
        </div>
      </header>
      <main class="apply-wrap">{children}</main>
    </>
  );
}

const Loading = () => <div class="loading" style="min-height:40vh" role="status" aria-label="Loading"><span /></div>;

function usePublished() {
  const [apps, setApps] = useState<PublicApplication[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetchPublishedApplications().then(setApps).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  return { apps, error };
}

function Facts({ app }: { app: PublicApplication }) {
  return (
    <div class="facts">
      <div class="fact">Deadline<strong>{fmtDate(app.dates.deadline)}, 23:59</strong></div>
      {app.dates.startsAt && <div class="fact">{app.pipeline === "instant" ? "Date" : "Program start"}<strong>{fmtDate(app.dates.startsAt)}</strong></div>}
      {app.spots && <div class="fact">Spots<strong>{app.spots}</strong></div>}
      {app.fee && <div class="fact">Participation fee<strong>{formatFee(app.fee)}</strong></div>}
    </div>
  );
}

const applyHref = (a: PublicApplication) => `/apply/form?a=${a.slug}`;

/** Filter value from the URL (?location=Aachen&program=AIM%20Connect), case-insensitive. */
function initialFilter(name: string): string {
  return typeof window === "undefined" ? "" : new URLSearchParams(location.search).get(name) ?? "";
}

export function ApplyHome() {
  const { apps, error } = usePublished();
  const [loc, setLoc] = useState(initialFilter("location"));
  const [prog, setProg] = useState(initialFilter("program"));
  const [tags, setTags] = useState<{ locations: string[]; programs: string[] }>({ locations: [], programs: [] });
  useEffect(() => { fetchPublicTagLists().then(setTags); }, []);

  // Keep the filters in the URL so the page can be linked/shared filtered
  useEffect(() => {
    const u = new URL(location.href);
    loc ? u.searchParams.set("location", loc) : u.searchParams.delete("location");
    prog ? u.searchParams.set("program", prog) : u.searchParams.delete("program");
    history.replaceState(null, "", u);
  }, [loc, prog]);

  if (error) return <Frame><div class="empty">Could not load applications. Please try again later.</div></Frame>;
  if (!apps) return <Frame><Loading /></Frame>;

  const live = apps.filter(a => a.phase === "open" || a.phase === "upcoming");
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  // All locations/programs from the managed lists (also those without an open round right now)
  const locations = tags.locations.length ? tags.locations : [...new Set(live.map(a => a.tags.location))].sort();
  const programs = tags.programs.length ? tags.programs : [...new Set(live.map(a => a.tags.program))].sort();
  const match = (a: PublicApplication) => (!loc || eq(a.tags.location, loc)) && (!prog || eq(a.tags.program, prog));
  const open = apps.filter(a => a.phase === "open" && match(a));
  const soon = apps.filter(a => a.phase === "upcoming" && match(a));
  const filtered = !!(loc || prog);

  const chips = (label: string, options: string[], value: string, set: (v: string) => void) => (
    <div class="filter-row" role="group" aria-label={label}>
      <span class="filter-row__label">{label}</span>
      <div class="filter-row__chips">
        <button class={`chip-btn ${!value ? "is-active" : ""}`} onClick={() => set("")} aria-pressed={!value}>All</button>
        {options.map(o => (
          <button class={`chip-btn ${eq(value, o) ? "is-active" : ""}`} onClick={() => set(eq(value, o) ? "" : o)} aria-pressed={eq(value, o)}>{o}</button>
        ))}
      </div>
    </div>
  );
  return (
    <Frame>
      <div class="stack" style="gap:28px">
        <div class="stack-s">
          <p class="overline">Join OneAIM</p>
          <h1>Open applications</h1>
          <p class="muted" style="max-width:620px">Europe's biggest student-led initiative in MedTech. Pick a program in your city and apply in a few minutes.</p>
        </div>
        {(locations.length > 1 || programs.length > 1) && (
          <div class="card filters">
            {locations.length > 1 && chips("Location", locations, loc, setLoc)}
            {programs.length > 1 && chips("Program", programs, prog, setProg)}
          </div>
        )}
        {open.length === 0 && (filtered
          ? <div class="empty">No open applications for this selection. <button class="btn btn--ghost btn--sm" onClick={() => { setLoc(""); setProg(""); }}>Show all</button></div>
          : <div class="empty">No applications are open right now. Follow us on Instagram to hear about the next round.</div>)}
        <div class="app-grid">
          {open.map(a => (
            <a class="app-card" href={applyHref(a)}>
              <div class="app-card__img" style={a.image ? `background-image:url(${a.image})` : ""}><span class="chip chip--green chip--dot">Open</span></div>
              <div class="app-card__body">
                <span class="app-card__title">{appTitle(a)}</span>
                {a.intro && <p class="small muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{a.intro}</p>}
                <div class="app-card__foot"><span>{a.tags.location}</span><span>Apply by <strong>{fmtDate(a.dates.deadline)}</strong></span></div>
              </div>
            </a>
          ))}
        </div>
        {soon.length > 0 && (
          <section class="stack-s">
            <h2>Opening soon</h2>
            {soon.map(a => <div class="card row row--between"><strong style="color:var(--color-text-heading)">{appTitle(a)}</strong><span class="muted small">Opens {fmtDate(a.dates.opensAt)}</span></div>)}
          </section>
        )}
      </div>
    </Frame>
  );
}

export function ApplyForm() {
  const slug = useParam("a");
  const { apps, error } = usePublished();
  const [done, setDone] = useState<string | null>(null);
  const [options, setOptions] = useState<FormOptions>({ universities: [], studyPrograms: [], companies: [] });
  useEffect(() => { fetchFormOptions().then(setOptions); }, []);

  if (error) return <Frame><div class="empty">Could not load this application. Please try again later.</div></Frame>;
  if (!apps) return <Frame><Loading /></Frame>;
  const app = apps.find(a => a.slug === slug);
  if (!app) return <Frame><div class="empty">This application doesn't exist or isn't published. <a href="/apply">See open applications</a></div></Frame>;

  const nameField = app.fields.find(f => f.kind === "name");

  if (done) {
    return (
      <Frame>
        <div class="apply-narrow card stack" style="align-items:center;text-align:center;padding:48px 28px;gap:14px">
          <div class="success-icon">✓</div>
          <h1>{app.pipeline === "instant" ? `You're in, ${done}!` : `Thanks, ${done}!`}</h1>
          <p class="muted" style="max-width:480px">
            {app.pipeline === "instant"
              ? "Your registration is confirmed. We'll send you a confirmation email."
              : `We received your application for ${appTitle(app)}. We'll get back to you after the deadline (${fmtDate(app.dates.deadline)}).`}
          </p>
          <a class="btn btn--secondary" href="/apply">See other applications</a>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div class="apply-narrow">
        <div class="apply-hero" style={app.image ? `background-image:url(${app.image})` : ""}>
          <p class="overline">{app.tags.location} · {app.tags.semester}</p>
          <h1>{appTitle(app)}</h1>
          {app.intro && <p>{app.intro}</p>}
          <Facts app={app} />
          <div style="height:30px" />
        </div>
        <div class="form-card">
          {app.phase === "open" ? (
            <>
              <div class="stack-s">
                <h2>{app.pipeline === "instant" ? "Register" : "Your application"}</h2>
                <p class="muted small">
                  Fields marked <span style="color:var(--color-accent-pink)">*</span> are required.
                </p>
              </div>
              <FormRenderer fields={app.fields} options={options} submitLabel={app.pipeline === "instant" ? "Register" : "Submit application"}
                onSubmit={async (answers, files) => {
                  const err = await submitApplication(app, answers, files, true);
                  if (err) return err;
                  setDone(firstName(String((nameField && answers[nameField.id]) ?? "")));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }} />
            </>
          ) : (
            <div class="empty">
              {app.phase === "upcoming" ? `Applications open on ${fmtDate(app.dates.opensAt)}.` : "Applications for this round are closed."}
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}

export function BookSlot() {
  const token = useParam("t");
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  const [pick, setPick] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => (token ? getBooking(token) : Promise.resolve(null)).then(setBooking);
  useEffect(() => { load(); }, []);

  if (booking === undefined) return <Frame><Loading /></Frame>;
  if (!booking || !token) return <Frame><div class="empty">This booking link is not valid.</div></Frame>;
  const booked = booking.slots.find(x => x.id === booking.slot_id);

  // Parallel interviews (several slots at the same time and place) show as one option
  const groups = [...booking.slots.reduce((m, sl) => {
    const key = `${sl.starts_at}|${sl.location}`;
    const g = m.get(key) ?? { key, starts_at: sl.starts_at, location: sl.location, ids: [] as string[], free: [] as string[] };
    g.ids.push(sl.id);
    if (sl.available) g.free.push(sl.id);
    return m.set(key, g);
  }, new Map<string, { key: string; starts_at: string; location: string; ids: string[]; free: string[] }>()).values()]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const bookedKey = groups.find(g => g.ids.includes(booking.slot_id ?? ""))?.key ?? null;

  const book = async () => {
    const g = groups.find(x => x.key === pick);
    if (!g) return;
    setBusy(true);
    // Take a free slot of this time; if someone was faster, try the next one
    let err: string | null = "This slot was just taken. Please pick another one.";
    for (const id of g.free) {
      err = await bookSlot(token, id);
      if (!err || !/just taken/.test(err)) break;
    }
    setBusy(false);
    if (err) { setError(err); await load(); return; }
    setPick(null);
    await load();
  };

  return (
    <Frame>
      <div class="apply-narrow stack" style="gap:20px">
        <div class="stack-s">
          <p class="overline">Interview · {booking.application}</p>
          <h1>Hi {booking.first_name}, pick your interview slot</h1>
          <p class="muted">About 15 minutes. After booking you get a confirmation email with all details(for online interviews incl. the meeting link). You can change your slot here until the interview.</p>
        </div>
        {booking.status !== "invited" ? (
          <div class="empty">{booking.status === "accepted" || booking.status === "rejected" ? "The interviews for this application are finished." : "You haven't been invited to an interview for this application."}</div>
        ) : (
          <div class="card stack">
            {booked && (
              <div class="card card--tint row">
                <IconCalendar width={22} />
                <span style="flex:1"><strong>Booked: {fmtSlot(booked.starts_at)}</strong><br /><span class="small">{booked.location} · Details are in your confirmation email.</span></span>
              </div>
            )}
            <div class="slot-grid">
              {groups.map(g => {
                const mine = g.key === bookedKey;
                const active = (pick ?? bookedKey) === g.key;
                const taken = !g.free.length && !mine;
                return (
                  <button type="button" class={`slot ${active ? "is-active" : ""}`} disabled={taken}
                    onClick={() => { setPick(g.key); setError(""); }}>
                    <strong>{fmtSlot(g.starts_at)}</strong>
                    <span class="muted small">{g.location}{taken ? " · taken" : ""}</span>
                  </button>
                );
              })}
            </div>
            {booking.slots.length === 0 && <p class="muted">No slots available yet. We'll email you when there are.</p>}
            {error && <p class="field__error">{error}</p>}
            <button class="btn btn--gradient btn--lg" style="align-self:flex-start" disabled={busy || !pick || pick === bookedKey} onClick={book}>
              {busy ? "Booking…" : booked ? "Change slot" : "Book this slot"}
            </button>
          </div>
        )}
      </div>
    </Frame>
  );
}

/** Feedback form for participants, opened with the personal link from the email */
export function FeedbackPage() {
  const token = useParam("t");
  const [fb, setFb] = useState<PublicFeedback | null | undefined>(undefined);
  const [done, setDone] = useState(false);
  useEffect(() => { (token ? getFeedback(token) : Promise.resolve(null)).then(setFb); }, []);

  if (fb === undefined) return <Frame><Loading /></Frame>;
  if (!fb || !token) return <Frame><div class="empty">This feedback link is not valid.</div></Frame>;
  return (
    <Frame>
      <div class="apply-narrow stack" style="gap:20px">
        <div class="stack-s">
          <p class="overline">Feedback · {fb.application}</p>
          <h1>Hi {fb.first_name}, how was it?</h1>
          {fb.intro && fb.state === "open" && !done && <p class="muted" style="white-space:pre-line">{fb.intro}</p>}
        </div>
        {done || fb.state === "done" ? (
          <div class="card card--tint stack-s">
            <strong>Thank you for your feedback!</strong>
            <span class="small">It helps us make the next round even better.</span>
          </div>
        ) : fb.state === "closed" ? (
          <div class="empty">This feedback form is not open.</div>
        ) : (
          <div class="card">
            <FormRenderer fields={fb.fields} consent={false} submitLabel="Send feedback"
              onSubmit={async answers => {
                const err = await submitFeedback(token, answers);
                if (err) return err;
                setDone(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }} />
          </div>
        )}
      </div>
    </Frame>
  );
}
